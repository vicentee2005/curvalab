"""Propagación de incertidumbres a una magnitud indirecta z = f(x, y, ...).

Dos caminos independientes, que se calculan a la vez para poder compararlos:

1. **Gaussiana analítica.** SymPy deriva la fórmula de forma simbólica y se
   aplica la fórmula de propagación de errores

       σ_z² = Σ (∂f/∂v_i · σ_i)²

   válida cuando las variables son independientes y f es aproximadamente lineal
   en el entorno ±σ de cada una.

2. **Monte Carlo.** Se sortean N muestras de cada variable con su distribución
   y se evalúa f en todas ellas. No supone linealidad ni normalidad de la
   salida, así que sirve de comprobación: si los dos números no coinciden, la
   fórmula no es lineal a esa escala y la que vale es la simulación.

Las variables se suponen **independientes** (sin covarianzas), que es el caso
habitual en el laboratorio docente.
"""
from __future__ import annotations

import numpy as np

from .formula import FormulaError, build_uncertainty_functions
from .schemas import (
    Contribution,
    Distribution,
    MonteCarloResult,
    PropagateRequest,
    PropagateResponse,
    PropagateTableRequest,
    PropagateTableResponse,
    TableVariable,
)

# Factor que convierte la semiamplitud a de una distribución rectangular en su
# desviación típica: σ = a/√3 (GUM, apartado 4.3.7).
_RECT_FACTOR = float(np.sqrt(3.0))


class PropagationError(ValueError):
    """Los datos de la propagación no permiten calcular un resultado."""


def _sigma_of(uncertainty: float, distribution: Distribution) -> float:
    """Desviación típica equivalente de una incertidumbre declarada."""
    if distribution == Distribution.rectangular:
        return abs(uncertainty) / _RECT_FACTOR
    return abs(uncertainty)


def _check_names(names: list[str]) -> None:
    if not names:
        raise PropagationError("Añade al menos una variable con su valor.")
    if len(set(names)) != len(names):
        raise PropagationError("Hay dos variables con el mismo nombre.")
    for n in names:
        if not n.isidentifier():
            raise PropagationError(
                f"'{n}' no vale como nombre de variable: usa letras, dígitos y _ "
                "(sin espacios ni símbolos)."
            )


def _finite(value: object, what: str) -> float:
    """Convierte a float comprobando que el resultado es utilizable."""
    arr = np.asarray(value, dtype=float)
    if arr.size != 1 or not np.isfinite(arr):
        raise PropagationError(
            f"{what} no está definido con esos valores (¿un logaritmo de un "
            "número negativo, o una división por cero?)."
        )
    return float(arr.reshape(()))


# --------------------------------------------------------------------------- #
# Medida indirecta única
# --------------------------------------------------------------------------- #
def propagate(req: PropagateRequest) -> PropagateResponse:
    """Propaga las incertidumbres de las variables a z = f(variables)."""
    names = [v.name for v in req.variables]
    _check_names(names)

    try:
        func, derivatives = build_uncertainty_functions(req.expression, names)
    except FormulaError as exc:
        raise PropagationError(str(exc)) from exc

    values = [v.value for v in req.variables]
    sigmas = [_sigma_of(v.uncertainty, v.distribution) for v in req.variables]

    # Evaluar fuera de dominio (log de un negativo…) avisa por consola: aquí ya
    # se comprueba a mano con _finite y se convierte en un error legible.
    with np.errstate(all="ignore"):
        value = _finite(func(*values), "La fórmula")

        # Cada término de la suma cuadrática, con su derivada evaluada.
        terms: list[tuple[float, float]] = []  # (derivada, aportación)
        for name, sigma in zip(names, sigmas):
            _, d_func = derivatives[name]
            d_value = _finite(d_func(*values), f"La derivada respecto de '{name}'")
            terms.append((d_value, abs(d_value) * sigma))

    variance = float(sum(t * t for _, t in terms))
    uncertainty = float(np.sqrt(variance))

    contributions = [
        Contribution(
            name=name,
            value=var.value,
            sigma=sigma,
            derivative=derivatives[name][0],
            derivative_value=d_value,
            term=term,
            # Reparto de la varianza: es aquí donde se ve qué medida conviene
            # afinar para bajar el error total.
            percent=(100.0 * term * term / variance) if variance > 0 else 0.0,
        )
        for var, name, sigma, (d_value, term) in zip(req.variables, names, sigmas, terms)
    ]

    mc = _monte_carlo(req, func) if req.monte_carlo else None

    return PropagateResponse(
        expression=req.expression.strip(),
        value=value,
        uncertainty=uncertainty,
        relative=(uncertainty / abs(value)) if value != 0 else None,
        contributions=contributions,
        mc=mc,
    )


def _monte_carlo(req: PropagateRequest, func) -> MonteCarloResult:
    """Simula la fórmula sorteando muestras de cada variable."""
    rng = np.random.default_rng(req.seed)
    n = req.samples

    samples = []
    for v in req.variables:
        if v.uncertainty == 0:
            samples.append(np.full(n, v.value))
        elif v.distribution == Distribution.rectangular:
            a = abs(v.uncertainty)
            samples.append(rng.uniform(v.value - a, v.value + a, n))
        else:
            samples.append(rng.normal(v.value, abs(v.uncertainty), n))

    with np.errstate(all="ignore"):
        out = np.asarray(func(*samples), dtype=float)
    # Una fórmula sin ninguna variable dentro devolvería un escalar.
    out = np.broadcast_to(out, (n,))
    out = out[np.isfinite(out)]

    if out.size < 2:
        raise PropagationError(
            "La simulación no produjo valores válidos: revisa que la fórmula "
            "esté definida en todo el rango de las variables."
        )

    mean = float(np.mean(out))
    std = float(np.std(out, ddof=1))
    tail = (1.0 - req.confidence) / 2.0
    p_low, p_high = (float(p) for p in np.percentile(out, [100 * tail, 100 * (1 - tail)]))

    # Asimetría de Fisher: si se aleja de 0, la salida ya no es una gaussiana y
    # el intervalo "valor ± σ" deja de ser simétrico de verdad.
    centered = out - mean
    m2 = float(np.mean(centered**2))
    skew = float(np.mean(centered**3) / m2**1.5) if m2 > 0 else 0.0

    counts, edges = np.histogram(out, bins=req.hist_bins)

    return MonteCarloResult(
        samples=int(out.size),
        requested=n,
        mean=mean,
        std=std,
        median=float(np.median(out)),
        p_low=p_low,
        p_high=p_high,
        confidence=req.confidence,
        skewness=skew,
        hist_edges=[float(e) for e in edges],
        hist_counts=[int(c) for c in counts],
    )


# --------------------------------------------------------------------------- #
# Modo tabla: una fila, un resultado
# --------------------------------------------------------------------------- #
def _as_floats(values: list[float | None]) -> np.ndarray:
    """Convierte una columna con huecos (null) en un array con NaN."""
    return np.asarray([np.nan if v is None else v for v in values], dtype=float)


def _column(var: TableVariable, n_rows: int) -> tuple[np.ndarray, np.ndarray]:
    """Devuelve (valores, sigmas) de una variable ya extendidos a n_rows filas."""
    values = _as_floats(var.values)
    if values.size == 0:
        raise PropagationError(f"La variable '{var.name}' no tiene ningún valor.")
    if values.size == 1:
        values = np.full(n_rows, values[0])
    elif values.size != n_rows:
        raise PropagationError(
            f"La variable '{var.name}' tiene {values.size} valores y se esperaban "
            f"{n_rows} (o uno solo, si es una constante)."
        )

    if var.uncertainties is None:
        sigmas = np.zeros(n_rows)
    else:
        sigmas = np.abs(_as_floats(var.uncertainties))
        if sigmas.size == 1:
            sigmas = np.full(n_rows, sigmas[0])
        elif sigmas.size != n_rows:
            raise PropagationError(
                f"La incertidumbre de '{var.name}' tiene {sigmas.size} valores y se "
                f"esperaban {n_rows}."
            )
        if var.distribution == Distribution.rectangular:
            sigmas = sigmas / _RECT_FACTOR

    return values, np.nan_to_num(sigmas, nan=0.0)


def propagate_table(req: PropagateTableRequest) -> PropagateTableResponse:
    """Aplica la fórmula fila a fila, propagando el error en cada una."""
    names = [v.name for v in req.variables]
    _check_names(names)

    # El número de filas lo marca la columna más larga; las de un solo valor
    # son constantes y se difunden.
    n_rows = max((len(v.values) for v in req.variables), default=0)
    if n_rows == 0:
        raise PropagationError("No hay datos en las columnas seleccionadas.")

    try:
        func, derivatives = build_uncertainty_functions(req.expression, names)
    except FormulaError as exc:
        raise PropagationError(str(exc)) from exc

    cols = [_column(v, n_rows) for v in req.variables]
    values = [c[0] for c in cols]
    sigmas = [c[1] for c in cols]

    with np.errstate(all="ignore"):
        z = np.broadcast_to(np.asarray(func(*values), dtype=float), (n_rows,)).copy()
        variance = np.zeros(n_rows)
        for i, name in enumerate(names):
            _, d_func = derivatives[name]
            d = np.broadcast_to(np.asarray(d_func(*values), dtype=float), (n_rows,))
            variance = variance + (d * sigmas[i]) ** 2
        sz = np.sqrt(variance)

    # Una fila con z no finita no tiene resultado, y su error tampoco.
    ok = np.isfinite(z)
    sz = np.where(ok & np.isfinite(sz), sz, np.nan)

    return PropagateTableResponse(
        expression=req.expression.strip(),
        n_rows=n_rows,
        z=[float(v) if np.isfinite(v) else None for v in z],
        sz=[float(v) if np.isfinite(v) else None for v in sz],
        derivatives={name: derivatives[name][0] for name in names},
    )
