"""Motor de ajuste de curvas basado en SciPy/NumPy.

Cada función de ajuste recibe los datos (x, y y opcionalmente σy) y devuelve un
FitResponse con parámetros, incertidumbres y estadísticos de bondad del ajuste.

Convenciones:
- Los parámetros lineales/polinómicos se obtienen con álgebra de mínimos
  cuadrados (`numpy.polyfit` con matriz de covarianza) para robustez.
- Los ajustes no lineales (exponencial, logarítmico, potencia, fórmula propia)
  usan `scipy.optimize.curve_fit` (Levenberg-Marquardt / trust region).
- Las incertidumbres de los parámetros son la raíz de la diagonal de la matriz
  de covarianza.
- Si hay σy se hace mínimos cuadrados ponderados (`sigma=σy`,
  `absolute_sigma=True`) y se calcula χ² y χ²/ν.
"""
from __future__ import annotations

import warnings

import numpy as np
from scipy.optimize import OptimizeWarning, curve_fit

from .formula import FormulaError, build_model_function, pretty_equation
from .schemas import FitModel, FitRequest, FitResponse, Parameter


class FitError(ValueError):
    """Error de dominio del ajuste (datos insuficientes, no converge, ...)."""


# --------------------------------------------------------------------------- #
# Utilidades comunes
# --------------------------------------------------------------------------- #
def _clean_xy(req: FitRequest) -> tuple[np.ndarray, np.ndarray, np.ndarray | None]:
    """Valida y limpia los datos, descartando filas con NaN.

    Returns (x, y, sy) como arrays de NumPy alineados. sy es None si no se
    aportaron incertidumbres o si todas eran no válidas.
    """
    x = np.asarray(req.x, dtype=float)
    y = np.asarray(req.y, dtype=float)
    if x.shape != y.shape:
        raise FitError("X e Y deben tener el mismo número de puntos.")

    sy = None
    if req.sy is not None and len(req.sy) > 0:
        sy = np.asarray(req.sy, dtype=float)
        if sy.shape != x.shape:
            raise FitError("El error de Y debe tener tantos valores como puntos.")

    # Máscara de filas completas (sin NaN en x ni y; sy debe ser >0 si existe).
    mask = np.isfinite(x) & np.isfinite(y)
    if sy is not None:
        mask &= np.isfinite(sy) & (sy > 0)
    x, y = x[mask], y[mask]
    if sy is not None:
        sy = sy[mask]
        if sy.size == 0:
            sy = None

    if x.size < 2:
        raise FitError("Hacen falta al menos 2 puntos válidos para ajustar.")
    return x, y, sy


def _goodness(
    y: np.ndarray,
    y_pred: np.ndarray,
    n_params: int,
    sy: np.ndarray | None,
) -> dict:
    """Calcula R², R² ajustado, RMSE, χ² y χ²/ν."""
    residuals = y - y_pred
    ss_res = float(np.sum(residuals**2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    n = y.size
    dof = n - n_params

    r_squared = 1.0 - ss_res / ss_tot if ss_tot > 0 else float("nan")
    adj = (
        1.0 - (1.0 - r_squared) * (n - 1) / dof
        if dof > 0 and np.isfinite(r_squared)
        else None
    )
    rmse = float(np.sqrt(ss_res / n))

    chi2 = None
    red_chi2 = None
    if sy is not None:
        chi2 = float(np.sum((residuals / sy) ** 2))
        red_chi2 = chi2 / dof if dof > 0 else None

    return {
        "residuals": residuals,
        "r_squared": r_squared,
        "adj_r_squared": adj,
        "rmse": rmse,
        "chi_squared": chi2,
        "reduced_chi_squared": red_chi2,
        "dof": dof,
    }


def _stderrs(pcov: np.ndarray) -> list[float | None]:
    """Errores estándar = raíz de la diagonal de la covarianza (o None)."""
    if pcov is None or np.any(np.isinf(pcov)) or np.any(np.isnan(pcov)):
        diag = None
    else:
        diag = np.diag(pcov)
    out: list[float | None] = []
    n = len(pcov) if pcov is not None else 0
    for i in range(n):
        if diag is not None and diag[i] >= 0 and np.isfinite(diag[i]):
            out.append(float(np.sqrt(diag[i])))
        else:
            out.append(None)
    return out


def _curve(x: np.ndarray, f, npts: int) -> tuple[np.ndarray, np.ndarray]:
    """Genera una curva suave del modelo en el rango de x."""
    xmin, xmax = float(np.min(x)), float(np.max(x))
    if xmin == xmax:
        xmin, xmax = xmin - 0.5, xmax + 0.5
    cx = np.linspace(xmin, xmax, npts)
    cy = f(cx)
    return cx, cy


def _build_response(
    req: FitRequest,
    x: np.ndarray,
    y: np.ndarray,
    sy: np.ndarray | None,
    param_names: list[str],
    popt: np.ndarray,
    perr: list[float | None],
    model_f,           # f(x) ya con los parámetros aplicados
    equation: str,
) -> FitResponse:
    y_pred = model_f(x)
    g = _goodness(y, y_pred, len(param_names), sy)
    cx, cy = _curve(x, model_f, req.curve_points)

    params = [
        Parameter(name=n, value=float(v), stderr=e)
        for n, v, e in zip(param_names, popt, perr)
    ]
    return FitResponse(
        model=req.model,
        equation=equation,
        parameters=params,
        r_squared=g["r_squared"],
        adj_r_squared=g["adj_r_squared"],
        chi_squared=g["chi_squared"],
        reduced_chi_squared=g["reduced_chi_squared"],
        rmse=g["rmse"],
        n_points=int(x.size),
        dof=g["dof"],
        curve_x=[float(v) for v in cx],
        curve_y=[float(v) for v in cy],
        residuals=[float(v) for v in g["residuals"]],
    )


# --------------------------------------------------------------------------- #
# Modelos concretos
# --------------------------------------------------------------------------- #
def fit_polynomial(req: FitRequest, degree: int) -> FitResponse:
    """Ajuste polinómico de grado `degree` (lineal es grado 1).

    Usa numpy.polyfit con matriz de covarianza. Coeficientes en orden
    a_n·x^n + ... + a_1·x + a_0; los nombramos de menor a mayor grado.
    """
    x, y, sy = _clean_xy(req)
    n_params = degree + 1
    if x.size <= degree:
        raise FitError(
            f"Para un polinomio de grado {degree} hacen falta más de "
            f"{degree} puntos."
        )

    w = 1.0 / sy if sy is not None else None
    # polyfit devuelve coeficientes de mayor a menor grado.
    coeffs, cov = np.polyfit(x, y, degree, w=w, cov=True)
    # Cuando hay pesos, polyfit escala la covarianza por chi2/dof salvo que se
    # indique lo contrario; para σ absolutas re-escalamos a covarianza "cruda".
    if sy is not None:
        # Deshacer el escalado de polyfit (cov *= chi2/(N-ndof)) para tener σ
        # absolutas coherentes con curve_fit(absolute_sigma=True).
        resid = y - np.polyval(coeffs, x)
        chi2 = np.sum((resid / sy) ** 2)
        dof = x.size - n_params
        if dof > 0 and chi2 > 0:
            cov = cov * dof / chi2

    perr_hi2lo = _stderrs(cov)  # en orden de polyfit (mayor->menor grado)

    # Reordenar de menor a mayor grado para nombres c0, c1, ...
    coeffs_lo2hi = coeffs[::-1]
    perr_lo2hi = perr_hi2lo[::-1]
    if degree == 1:
        names = ["a", "b"]  # y = a·x + b  -> a=pendiente, b=ordenada
        # coeffs (mayor->menor) = [a, b]; en lo2hi = [b, a]
        popt = np.array([coeffs[0], coeffs[1]])
        perr = [perr_hi2lo[0], perr_hi2lo[1]]
        equation = "y = a·x + b"
        model_f = lambda xx, c=coeffs: np.polyval(c, xx)  # noqa: E731
    else:
        names = [f"c{i}" for i in range(n_params)]
        popt = np.asarray(coeffs_lo2hi)
        perr = perr_lo2hi
        terms = " + ".join(
            (f"c{i}" if i == 0 else (f"c{i}·x" if i == 1 else f"c{i}·x^{i}"))
            for i in range(n_params)
        )
        equation = f"y = {terms}"
        model_f = lambda xx, c=coeffs: np.polyval(c, xx)  # noqa: E731

    return _build_response(req, x, y, sy, names, popt, perr, model_f, equation)


def _dominant_omega(x: np.ndarray, y: np.ndarray) -> float | None:
    """Estima la frecuencia angular dominante (rad por unidad de x) por FFT.

    Clave para los modelos periódicos: sin una estimación razonable de la
    frecuencia, el optimizador cae casi siempre en un mínimo local (una recta
    plana en vez de la sinusoide).
    """
    n = x.size
    if n < 8:
        return None
    # Remuestreo uniforme (los datos de laboratorio no siempre lo son).
    xs = np.linspace(float(x.min()), float(x.max()), max(64, 4 * n))
    span = xs[-1] - xs[0]
    if span <= 0:
        return None
    order = np.argsort(x)
    ys = np.interp(xs, x[order], y[order])
    ys = ys - ys.mean()
    if not np.any(ys):
        return None
    spec = np.abs(np.fft.rfft(ys * np.hanning(ys.size)))
    freqs = np.fft.rfftfreq(ys.size, d=xs[1] - xs[0])  # ciclos por unidad de x
    if spec.size < 2:
        return None
    k = int(np.argmax(spec[1:]) + 1)
    f_peak = float(freqs[k])
    if f_peak <= 0:
        return None
    return 2.0 * np.pi * f_peak


def _candidate_p0s(
    names: list[str],
    x: np.ndarray,
    y: np.ndarray,
    base: list[float],
    expression: str | None,
) -> list[list[float]]:
    """Genera estimaciones iniciales plausibles para el multi-arranque.

    Combina magnitudes deducidas de los propios datos (amplitud, media,
    frecuencia dominante, escala de decaimiento) con arranques aleatorios
    reproducibles, de modo que un modelo correcto converja aunque el usuario no
    aporte ninguna estimación.
    """
    n = len(names)
    cands: list[list[float]] = [list(base)]

    amp = float((np.max(y) - np.min(y)) / 2.0) or 1.0
    mean = float(np.mean(y))
    span = float(np.max(x) - np.min(x)) or 1.0
    decay = 1.0 / span

    # La frecuencia solo tiene sentido (y solo merece dominar los arranques) si
    # el modelo es periódico.
    periodic = bool(expression) and any(
        t in expression for t in ("sin", "cos", "tan")
    )
    omega = _dominant_omega(x, y) if periodic else None

    pool = [1.0, amp, mean, decay, 0.0, 0.5]
    if omega:
        pool = [omega, omega / 2.0, 2.0 * omega] + pool

    # Arranques estructurados: patrones típicos (amplitud, frecuencia, fase,
    # offset) que cubren la mayoría de modelos de laboratorio.
    structured: list[list[float]] = []
    for w in ([omega, omega / 2.0, 2.0 * omega] if omega else [1.0]):
        for a0 in (amp, -amp):
            base_pat = [a0, w, 0.0, mean, decay]
            structured.append([base_pat[i % len(base_pat)] for i in range(n)])
            if n >= 3:
                # variante con fase a medio ciclo
                alt = list(base_pat)
                alt[2] = np.pi / 2.0
                structured.append([alt[i % len(alt)] for i in range(n)])
    cands.extend(structured)

    # Arranques aleatorios reproducibles sobre el mismo pool de magnitudes.
    rng = np.random.default_rng(0)
    for _ in range(24):
        cands.append([float(rng.choice(pool)) for _ in range(n)])

    # Únicos, conservando el orden (el primero es el del usuario / del modelo).
    seen: set[tuple] = set()
    out: list[list[float]] = []
    for c in cands:
        key = tuple(round(v, 10) for v in c)
        if key not in seen:
            seen.add(key)
            out.append(c)
    return out


def _fit_nonlinear(
    req: FitRequest,
    f,                       # f(x, *params)
    names: list[str],
    p0: list[float],
    equation: str,
    multistart: bool = True,
) -> FitResponse:
    """Rutina común de ajuste no lineal con curve_fit y multi-arranque.

    Se prueban varias estimaciones iniciales y se conserva la que menor suma de
    residuos deja. Si el usuario aporta `initial_guess`, esa va la primera (y se
    respeta si empata), pero el multi-arranque sigue actuando de red de
    seguridad frente a los mínimos locales.
    """
    x, y, sy = _clean_xy(req)
    if x.size < len(names):
        raise FitError(
            f"Hacen falta al menos {len(names)} puntos para ajustar "
            f"{len(names)} parámetros."
        )

    user_p0 = None
    if req.initial_guess and len(req.initial_guess) == len(names):
        user_p0 = list(req.initial_guess)
        p0 = user_p0

    starts = (
        _candidate_p0s(names, x, y, p0, req.expression)
        if multistart
        else [list(p0)]
    )

    kwargs: dict = {"maxfev": 20000}
    if sy is not None:
        kwargs["sigma"] = sy
        kwargs["absolute_sigma"] = True

    best: tuple[float, np.ndarray, np.ndarray] | None = None
    last_error: Exception | None = None

    # Probamos muchos arranques a propósito: que algunos no converjan o no den
    # covarianza es parte del método, no un problema que deba avisarse.
    with np.errstate(all="ignore"), warnings.catch_warnings():
        warnings.simplefilter("ignore", OptimizeWarning)
        for start in starts:
            try:
                popt, pcov = curve_fit(f, x, y, p0=start, **kwargs)
                resid = y - f(x, *popt)
                if not np.all(np.isfinite(resid)):
                    continue
                ssr = float(np.sum(resid**2))
                if not np.isfinite(ssr):
                    continue
                if best is None or ssr < best[0] * (1 - 1e-12):
                    best = (ssr, popt, pcov)
                    # Un ajuste prácticamente perfecto: no hace falta seguir.
                    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
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
    model_f = lambda xx, p=popt: f(xx, *p)  # noqa: E731
    return _build_response(req, x, y, sy, names, popt, perr, model_f, equation)


def fit_exponential(req: FitRequest) -> FitResponse:
    """y = a·exp(b·x) + c."""
    x, y, _ = _clean_xy(req)
    # Estimación inicial razonable.
    a0 = float(np.max(y) - np.min(y)) or 1.0
    b0 = 0.1 if x.size < 2 else float(
        np.sign((y[-1] - y[0]) * (x[-1] - x[0]) + 1e-9)
    ) * 0.1
    c0 = float(np.min(y))
    f = lambda xx, a, b, c: a * np.exp(b * xx) + c  # noqa: E731
    return _fit_nonlinear(req, f, ["a", "b", "c"], [a0, b0, c0],
                          "y = a·exp(b·x) + c")


def fit_logarithmic(req: FitRequest) -> FitResponse:
    """y = a·ln(x) + b. Requiere x > 0."""
    x, _, _ = _clean_xy(req)
    if np.any(x <= 0):
        raise FitError(
            "El ajuste logarítmico requiere que todos los valores de X sean "
            "positivos (ln(x))."
        )
    f = lambda xx, a, b: a * np.log(xx) + b  # noqa: E731
    return _fit_nonlinear(req, f, ["a", "b"], [1.0, 0.0], "y = a·ln(x) + b")


def fit_power(req: FitRequest) -> FitResponse:
    """y = a·x^b. Requiere x > 0."""
    x, _, _ = _clean_xy(req)
    if np.any(x <= 0):
        raise FitError(
            "El ajuste potencial requiere que todos los valores de X sean "
            "positivos (x^b)."
        )
    f = lambda xx, a, b: a * np.power(xx, b)  # noqa: E731
    return _fit_nonlinear(req, f, ["a", "b"], [1.0, 1.0], "y = a·x^b")


def fit_custom(req: FitRequest) -> FitResponse:
    """Ajuste a la fórmula propia del usuario."""
    if not req.expression or not req.parameters:
        raise FitError(
            "Para un ajuste con fórmula propia indica la expresión y la lista "
            "de parámetros."
        )
    try:
        f = build_model_function(req.expression, req.parameters)
    except FormulaError as exc:
        raise FitError(str(exc)) from exc

    p0 = req.initial_guess or [1.0] * len(req.parameters)
    equation = pretty_equation(req.expression)
    return _fit_nonlinear(req, f, list(req.parameters), list(p0), equation)


# --------------------------------------------------------------------------- #
# Despachador
# --------------------------------------------------------------------------- #
def run_fit(req: FitRequest) -> FitResponse:
    """Ejecuta el ajuste apropiado según req.model."""
    if req.model == FitModel.linear:
        return fit_polynomial(req, degree=1)
    if req.model == FitModel.polynomial:
        return fit_polynomial(req, degree=req.degree)
    if req.model == FitModel.exponential:
        return fit_exponential(req)
    if req.model == FitModel.logarithmic:
        return fit_logarithmic(req)
    if req.model == FitModel.power:
        return fit_power(req)
    if req.model == FitModel.custom:
        return fit_custom(req)
    raise FitError(f"Modelo de ajuste no soportado: {req.model}")
