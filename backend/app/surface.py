"""Motor de ajuste de superficies z = f(x, y) para el entorno 3D.

A diferencia del ajuste 2D, aquí:

- Los datos son **tres columnas** (x, y, z) de puntos dispersos: no hace falta
  que estén en una rejilla regular.
- **No se manejan barras de error**: el ajuste es por mínimos cuadrados sin
  ponderar y no se calcula χ². Es una decisión de producto, para que el
  entorno 3D sea cómodo y directo.

Modelos:
- `plane`      z = a·x + b·y + c            (lineal exacto)
- `poly2d`     z = Σ c_ij·x^i·y^j, i+j ≤ n  (lineal exacto)
- `gaussian2d` campana 2D                    (no lineal, multi-arranque)
- `custom`     fórmula propia z = f(x, y)    (no lineal, multi-arranque)

Los dos primeros son lineales en los parámetros, así que se resuelven de una
vez con mínimos cuadrados (`numpy.linalg.lstsq`) y su covarianza analítica
σ²·(AᵀA)⁻¹ — sin riesgo de mínimos locales. Los otros dos usan `curve_fit` con
el mismo enfoque de multi-arranque que el ajuste 2D.
"""
from __future__ import annotations

import warnings

import numpy as np
from scipy.optimize import OptimizeWarning, curve_fit

# Reutilizamos las utilidades de bondad del ajuste 2D: son las mismas fórmulas
# (R², R² ajustado, RMSE) evaluadas sobre z en vez de sobre y.
from .fitting import FitError, _goodness, _stderrs
from .formula import FormulaError, build_surface_function, pretty_equation
from .schemas import Parameter, SurfaceFitRequest, SurfaceFitResponse, SurfaceModel


# --------------------------------------------------------------------------- #
# Utilidades comunes
# --------------------------------------------------------------------------- #
def _clean_xyz(req: SurfaceFitRequest) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Valida y limpia los datos, descartando filas incompletas."""
    x = np.asarray(req.x, dtype=float)
    y = np.asarray(req.y, dtype=float)
    z = np.asarray(req.z, dtype=float)
    if not (x.shape == y.shape == z.shape):
        raise FitError("X, Y y Z deben tener el mismo número de puntos.")

    mask = np.isfinite(x) & np.isfinite(y) & np.isfinite(z)
    x, y, z = x[mask], y[mask], z[mask]
    if x.size < 3:
        raise FitError(
            "Hacen falta al menos 3 puntos con X, Y y Z válidos para ajustar "
            "una superficie."
        )
    # Una superficie necesita que los puntos no estén todos alineados: si X o Y
    # es constante, el problema es en realidad 2D.
    if np.ptp(x) == 0 or np.ptp(y) == 0:
        raise FitError(
            "Los valores de X y de Y no pueden ser todos iguales: los puntos "
            "no cubren un plano y no se puede ajustar una superficie."
        )
    return x, y, z


def _grid(
    x: np.ndarray,
    y: np.ndarray,
    f,               # f(X, Y) vectorizada, con los parámetros ya aplicados
    npts: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Evalúa la superficie en una malla regular que cubre los datos.

    Devuelve (gx, gy, gz) con gz[j][i] = f(gx[i], gy[j]), que es exactamente el
    formato que espera el trace `surface` de Plotly.
    """
    gx = np.linspace(float(np.min(x)), float(np.max(x)), npts)
    gy = np.linspace(float(np.min(y)), float(np.max(y)), npts)
    GX, GY = np.meshgrid(gx, gy)
    with np.errstate(all="ignore"):
        GZ = np.asarray(f(GX, GY), dtype=float)
    # La fórmula del usuario puede tener huecos (log de negativo, división por
    # cero…): Plotly dibuja los null como agujeros en la superficie.
    GZ = np.where(np.isfinite(GZ), GZ, np.nan)
    return gx, gy, GZ


def _build_response(
    req: SurfaceFitRequest,
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    names: list[str],
    popt: np.ndarray,
    perr: list[float | None],
    model_f,          # f(X, Y) con los parámetros aplicados
    equation: str,
) -> SurfaceFitResponse:
    z_pred = np.asarray(model_f(x, y), dtype=float)
    g = _goodness(z, z_pred, len(names), None)
    gx, gy, gz = _grid(x, y, model_f, req.grid_points)

    params = [
        Parameter(name=n, value=float(v), stderr=e)
        for n, v, e in zip(names, popt, perr)
    ]
    return SurfaceFitResponse(
        model=req.model,
        equation=equation,
        parameters=params,
        r_squared=g["r_squared"],
        adj_r_squared=g["adj_r_squared"],
        rmse=g["rmse"],
        n_points=int(x.size),
        dof=g["dof"],
        grid_x=[float(v) for v in gx],
        grid_y=[float(v) for v in gy],
        # None en vez de NaN: el JSON no admite NaN y Plotly interpreta null
        # como "hueco" en la superficie.
        grid_z=[[(float(v) if np.isfinite(v) else None) for v in row] for row in gz],
        residuals=[float(v) for v in g["residuals"]],
    )


# --------------------------------------------------------------------------- #
# Modelos lineales en los parámetros (plano y polinomio 2D)
# --------------------------------------------------------------------------- #
def _fit_linear_terms(
    req: SurfaceFitRequest,
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    terms: list[tuple[int, int]],
    names: list[str],
    equation: str,
) -> SurfaceFitResponse:
    """Ajusta z = Σ coef_k · x^i · y^j por mínimos cuadrados lineales.

    Al ser lineal en los coeficientes no hay estimación inicial ni mínimos
    locales: la solución es única (si el sistema no es degenerado).
    """
    n_params = len(terms)
    if x.size < n_params:
        raise FitError(
            f"Este modelo tiene {n_params} coeficientes y hacen falta al menos "
            f"otros tantos puntos (hay {x.size})."
        )

    A = np.column_stack([x**i * y**j for (i, j) in terms])
    coeffs, *_ = np.linalg.lstsq(A, z, rcond=None)

    def model_f(X, Y, c=coeffs):
        X = np.asarray(X, dtype=float)
        Y = np.asarray(Y, dtype=float)
        out = np.zeros_like(X, dtype=float)
        for k, (i, j) in enumerate(terms):
            out = out + c[k] * X**i * Y**j
        return out

    # Covarianza de mínimos cuadrados: σ²·(AᵀA)⁻¹, con σ² = SSR/(N − p).
    resid = z - A @ coeffs
    dof = x.size - n_params
    if dof > 0:
        sigma2 = float(np.sum(resid**2)) / dof
        cov = sigma2 * np.linalg.pinv(A.T @ A)
        perr = _stderrs(cov)
    else:
        # Sin grados de libertad el ajuste pasa por todos los puntos y la
        # incertidumbre no es estimable.
        perr = [None] * n_params

    return _build_response(req, x, y, z, names, coeffs, perr, model_f, equation)


def fit_plane(req: SurfaceFitRequest) -> SurfaceFitResponse:
    """z = a·x + b·y + c."""
    x, y, z = _clean_xyz(req)
    terms = [(1, 0), (0, 1), (0, 0)]
    return _fit_linear_terms(
        req, x, y, z, terms, ["a", "b", "c"], "z = a·x + b·y + c"
    )


def _poly_terms(degree: int) -> list[tuple[int, int]]:
    """Exponentes (i, j) con i + j ≤ degree, ordenados por grado total."""
    terms: list[tuple[int, int]] = []
    for total in range(degree + 1):
        for i in range(total, -1, -1):
            terms.append((i, total - i))
    return terms


def _poly_equation(terms: list[tuple[int, int]], names: list[str]) -> str:
    """Escribe la ecuación del polinomio de forma legible."""
    parts: list[str] = []
    for name, (i, j) in zip(names, terms):
        factor = ""
        if i == 1:
            factor += "·x"
        elif i > 1:
            factor += f"·x^{i}"
        if j == 1:
            factor += "·y"
        elif j > 1:
            factor += f"·y^{j}"
        parts.append(f"{name}{factor}")
    return "z = " + " + ".join(parts)


def fit_poly2d(req: SurfaceFitRequest) -> SurfaceFitResponse:
    """z = Σ c_ij·x^i·y^j con i + j ≤ grado (paraboloides, sillas de montar…)."""
    x, y, z = _clean_xyz(req)
    terms = _poly_terms(req.degree)
    names = [f"c{i}{j}" for (i, j) in terms]
    return _fit_linear_terms(req, x, y, z, terms, names, _poly_equation(terms, names))


# --------------------------------------------------------------------------- #
# Modelos no lineales (gaussiana 2D y fórmula propia)
# --------------------------------------------------------------------------- #
def _fit_nonlinear_surface(
    req: SurfaceFitRequest,
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    f,                        # f(X, Y, *params)
    names: list[str],
    starts: list[list[float]],
    equation: str,
) -> SurfaceFitResponse:
    """Multi-arranque con curve_fit sobre dos variables independientes.

    curve_fit solo admite una `xdata`, así que empaquetamos (x, y) en una
    matriz 2×N y la desempaquetamos dentro del envoltorio.
    """
    if x.size < len(names):
        raise FitError(
            f"Hacen falta al menos {len(names)} puntos para ajustar "
            f"{len(names)} parámetros."
        )

    M = np.vstack([x, y])

    def packed(m, *p):
        return f(m[0], m[1], *p)

    best: tuple[float, np.ndarray, np.ndarray] | None = None
    last_error: Exception | None = None

    # Que algunos arranques no converjan es parte del método, no un aviso útil.
    with np.errstate(all="ignore"), warnings.catch_warnings():
        warnings.simplefilter("ignore", OptimizeWarning)
        for start in starts:
            try:
                popt, pcov = curve_fit(packed, M, z, p0=start, maxfev=20000)
                resid = z - packed(M, *popt)
                if not np.all(np.isfinite(resid)):
                    continue
                ssr = float(np.sum(resid**2))
                if not np.isfinite(ssr):
                    continue
                if best is None or ssr < best[0] * (1 - 1e-12):
                    best = (ssr, popt, pcov)
                    ss_tot = float(np.sum((z - np.mean(z)) ** 2))
                    if ss_tot > 0 and 1.0 - ssr / ss_tot > 0.9999:
                        break
            except (RuntimeError, ValueError, TypeError) as exc:
                last_error = exc
                continue

    if best is None:
        raise FitError(
            "El ajuste no convergió con ninguna estimación inicial. Revisa que "
            "el modelo se corresponda con la forma de los datos, o indica una "
            "estimación inicial de los parámetros."
            + (f" ({last_error})" if last_error else "")
        )

    _, popt, pcov = best
    perr = _stderrs(pcov)
    model_f = lambda X, Y, p=popt: f(X, Y, *p)  # noqa: E731
    return _build_response(req, x, y, z, names, popt, perr, model_f, equation)


def _gaussian2d(X, Y, amp, x0, y0, sx, sy, base):
    """Campana 2D. sx y sy entran al cuadrado: su signo es irrelevante."""
    return (
        amp
        * np.exp(-(((X - x0) ** 2) / (2.0 * sx**2) + ((Y - y0) ** 2) / (2.0 * sy**2)))
        + base
    )


def fit_gaussian2d(req: SurfaceFitRequest) -> SurfaceFitResponse:
    """Campana 2D: z = A·exp(−((x−x₀)²/2σx² + (y−y₀)²/2σy²)) + c."""
    x, y, z = _clean_xyz(req)
    names = ["A", "x0", "y0", "sx", "sy", "c"]

    span_x = float(np.ptp(x))
    span_y = float(np.ptp(y))
    zmin, zmax = float(np.min(z)), float(np.max(z))

    # Dos hipótesis razonables: un pico (amplitud positiva, centro en el máximo)
    # y un valle (amplitud negativa, centro en el mínimo).
    i_max = int(np.argmax(z))
    i_min = int(np.argmin(z))
    hypotheses = [
        (zmax - zmin, float(x[i_max]), float(y[i_max]), zmin),
        (zmin - zmax, float(x[i_min]), float(y[i_min]), zmax),
    ]

    starts: list[list[float]] = []
    for amp, x0, y0, base in hypotheses:
        for k in (4.0, 8.0, 2.0):
            starts.append([amp or 1.0, x0, y0, span_x / k, span_y / k, base])

    result = _fit_nonlinear_surface(
        req, x, y, z, _gaussian2d, names, starts,
        "z = A·exp(−((x−x₀)²/2σx² + (y−y₀)²/2σy²)) + c",
    )
    # σx y σy son anchuras: se informan siempre en positivo (el modelo solo usa
    # su cuadrado, así que el signo que devuelva el optimizador no significa nada).
    for p in result.parameters:
        if p.name in ("sx", "sy"):
            p.value = abs(p.value)
    return result


def _candidate_p0s_surface(
    n: int,
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    base: list[float],
) -> list[list[float]]:
    """Arranques plausibles para la fórmula propia, deducidos de los datos.

    Igual que en el 2D: sin una estimación inicial razonable, un modelo
    correcto puede quedarse en un mínimo local y devolver una superficie plana.
    """
    cands: list[list[float]] = [list(base)]

    amp = float(np.ptp(z)) / 2.0 or 1.0
    mean = float(np.mean(z))
    scale_x = float(np.ptp(x)) or 1.0
    scale_y = float(np.ptp(y)) or 1.0
    pool = [1.0, amp, -amp, mean, 1.0 / scale_x, 1.0 / scale_y, 0.0, 0.5]

    # Arranques estructurados: patrones típicos (amplitud, escalas, offset).
    for a0 in (amp, -amp, 1.0):
        pattern = [a0, 1.0 / scale_x, 1.0 / scale_y, mean, 0.0]
        cands.append([pattern[i % len(pattern)] for i in range(n)])

    rng = np.random.default_rng(0)
    for _ in range(24):
        cands.append([float(rng.choice(pool)) for _ in range(n)])

    seen: set[tuple] = set()
    out: list[list[float]] = []
    for c in cands:
        key = tuple(round(v, 10) for v in c)
        if key not in seen:
            seen.add(key)
            out.append(c)
    return out


def fit_custom_surface(req: SurfaceFitRequest) -> SurfaceFitResponse:
    """Ajuste a la fórmula propia del usuario, z = f(x, y)."""
    if not req.expression or not req.parameters:
        raise FitError(
            "Para un ajuste con fórmula propia indica la expresión y la lista "
            "de parámetros."
        )
    try:
        f = build_surface_function(req.expression, req.parameters)
    except FormulaError as exc:
        raise FitError(str(exc)) from exc

    x, y, z = _clean_xyz(req)
    n = len(req.parameters)
    p0 = list(req.initial_guess) if req.initial_guess and len(req.initial_guess) == n else [1.0] * n
    starts = _candidate_p0s_surface(n, x, y, z, p0)

    return _fit_nonlinear_surface(
        req, x, y, z, f, list(req.parameters), starts,
        pretty_equation(req.expression, lhs="z"),
    )


# --------------------------------------------------------------------------- #
# Despachador
# --------------------------------------------------------------------------- #
def run_surface_fit(req: SurfaceFitRequest) -> SurfaceFitResponse:
    """Ejecuta el ajuste de superficie apropiado según req.model."""
    if req.model == SurfaceModel.plane:
        return fit_plane(req)
    if req.model == SurfaceModel.poly2d:
        return fit_poly2d(req)
    if req.model == SurfaceModel.gaussian2d:
        return fit_gaussian2d(req)
    if req.model == SurfaceModel.custom:
        return fit_custom_surface(req)
    raise FitError(f"Modelo de superficie no soportado: {req.model}")
