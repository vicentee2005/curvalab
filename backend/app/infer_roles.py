"""Inferencia inteligente de roles de columna al importar datos.

Dado un conjunto de columnas (nombre + valores numéricos) deduce qué columna es
X, cuál Y, cuáles son barras de error, etc. — razonando como lo haría una
persona, a partir de dos fuentes de evidencia:

1. El **nombre de la cabecera** (señal fuerte): "t", "tiempo", "x" → eje X;
   "V", "voltaje", "y" → eje Y; "σ", "error", "Δ", "incertidumbre" → error.
2. La **forma de los datos** (cuando el nombre no ayuda, p. ej. cabeceras
   numéricas): la columna monótona suele ser X; una columna toda positiva y de
   magnitud mucho menor que Y suele ser su barra de error.

Además ignora columnas completamente vacías, de modo que si los datos están en
la 3ª y 4ª columna (con la 1ª y 2ª vacías) se interpretan igualmente como X e Y,
no como errores por su posición literal.
"""
from __future__ import annotations

import re
import unicodedata

import numpy as np

# Palabras clave por eje (tras normalizar: minúsculas, sin acentos, sin unidades
# entre paréntesis). Se comparan como token exacto o como subcadena según el caso.
_X_WORDS = {
    "x", "t", "tiempo", "time", "abscisa", "frecuencia", "freq", "f",
    "posicion", "distancia", "angulo", "longitud", "lambda",
}
_Y_WORDS = {
    "y", "v", "voltaje", "voltage", "tension", "intensidad", "corriente",
    "amplitud", "senal", "signal", "temperatura", "presion", "carga",
    "energia", "potencia", "fuerza", "campo",
}
_Z_WORDS = {"z", "altura", "profundidad"}

# Símbolos y palabras que delatan una columna de error/incertidumbre.
_ERR_TOKENS = ("error", "err", "sigma", "incert", "uncert", "desv", "std", "sd")
_ERR_SYMBOLS = ("σ", "δ", "Δ", "∆", "±", "∓")


def _normalize(name: str) -> str:
    """minúsculas, sin acentos, sin contenido entre paréntesis (unidades)."""
    s = name.lower().strip()
    s = re.sub(r"\(.*?\)", "", s)          # quita "(s)", "(V)"...
    s = re.sub(r"\[.*?\]", "", s)          # quita "[m]"...
    nkfd = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in nkfd if not unicodedata.combining(c))
    return s.strip()


def _tokens(name_norm: str) -> set[str]:
    return set(re.split(r"[\s_\-./]+", name_norm)) - {""}


def _is_error_name(raw: str, norm: str) -> bool:
    """¿El nombre indica que es una columna de error?"""
    low = raw.lower()
    if any(sym in low for sym in _ERR_SYMBOLS):
        return True
    if any(tok in norm for tok in _ERR_TOKENS):
        return True
    # Patrón 's' o 'd' seguido de eje: sx, sy, dx, dy (incertidumbre típica).
    if re.fullmatch(r"[sd][xyz]", norm.replace(" ", "")):
        return True
    return False


def _error_axis(raw: str, norm: str) -> str:
    """Devuelve 'ex' | 'ey' | 'ez' según el eje que mencione el nombre."""
    low = raw.lower()
    # Busca la letra de eje pegada al símbolo/palabra de error.
    if "x" in norm or "x" in low:
        # evita falsos positivos: solo si aparece como token de eje corto
        if re.search(r"\bx\b", norm) or re.search(r"[σδΔ∆s d]?x\b", low):
            return "ex"
    if "z" in norm:
        return "ez"
    if "x" in re.sub(r"[^xyz]", "", norm):
        # heurística final: si tras quitar todo lo no-eje queda una x
        return "ex"
    return "ey"  # por defecto, error del eje Y (lo más común)


def _features(values: list[float | None]) -> dict:
    nums = np.array([v for v in values if v is not None], dtype=float)
    if nums.size == 0:
        return {"n": 0, "empty": True, "all_pos": False, "monotonic": False,
                "mean_abs": 0.0, "std": 0.0}
    diffs = np.diff(nums)
    monotonic = nums.size > 2 and (np.all(diffs > 0) or np.all(diffs < 0))
    return {
        "n": int(nums.size),
        "empty": False,
        "all_pos": bool(np.all(nums > 0)),
        "monotonic": bool(monotonic),
        "mean_abs": float(np.mean(np.abs(nums))),
        "std": float(np.std(nums)),
    }


def infer_roles(names: list[str], columns_values: list[list[float | None]]) -> list[str]:
    """Devuelve una lista de roles sugeridos, alineada con `names`.

    columns_values[i] son los valores (con None para huecos) de la columna i.
    """
    n = len(names)
    roles: list[str] = [""] * n
    feats = [_features(vals) for vals in columns_values]
    norms = [_normalize(nm) for nm in names]

    # Índices de columnas con datos (ignoramos las totalmente vacías).
    data_idx = [i for i in range(n) if not feats[i]["empty"]]

    taken: set[str] = set()

    def assign(i: int, role: str) -> None:
        roles[i] = role
        taken.add(role)

    # --- 1) Errores por nombre (señal fuerte) ------------------------------ #
    for i in data_idx:
        if _is_error_name(names[i], norms[i]):
            ax = _error_axis(names[i], norms[i])
            if ax not in taken:
                assign(i, ax)

    # --- 2) X / Y / Z por nombre ------------------------------------------- #
    def name_matches(i: int, words: set[str]) -> bool:
        toks = _tokens(norms[i])
        return bool(toks & words)

    for i in data_idx:
        if roles[i]:
            continue
        if "x" not in taken and name_matches(i, _X_WORDS):
            assign(i, "x")
    for i in data_idx:
        if roles[i]:
            continue
        if "y" not in taken and name_matches(i, _Y_WORDS):
            assign(i, "y")
    for i in data_idx:
        if roles[i]:
            continue
        if "z" not in taken and name_matches(i, _Z_WORDS):
            assign(i, "z")

    # --- 3) Relleno posicional de X e Y entre las columnas sin asignar ----- #
    unassigned = [i for i in data_idx if not roles[i]]
    if "x" not in taken and unassigned:
        # Preferimos una columna monótona como X; si no, la primera.
        mono = [i for i in unassigned if feats[i]["monotonic"]]
        pick = mono[0] if mono else unassigned[0]
        assign(pick, "x")
        unassigned = [i for i in data_idx if not roles[i]]
    if "y" not in taken and unassigned:
        assign(unassigned[0], "y")
        unassigned = [i for i in data_idx if not roles[i]]

    # --- 4) Errores por forma: columna positiva y pequeña frente a Y ------- #
    y_idx = next((i for i in data_idx if roles[i] == "y"), None)
    x_idx = next((i for i in data_idx if roles[i] == "x"), None)
    if y_idx is not None:
        y_std = feats[y_idx]["std"] or feats[y_idx]["mean_abs"]
        for i in unassigned:
            f = feats[i]
            small = f["mean_abs"] < 0.5 * y_std if y_std > 0 else False
            if f["all_pos"] and small:
                if "ey" not in taken:
                    assign(i, "ey")
                elif "ex" not in taken and x_idx is not None:
                    assign(i, "ex")

    return roles
