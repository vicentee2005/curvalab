"""Ajuste no lineal por Levenberg-Marquardt, solo con NumPy.

Sustituye a `scipy.optimize.curve_fit`, que era la única función de SciPy que
usaba la aplicación. SciPy ocupa 117 MB de los 242 MB del backend y por su culpa
no cabía en una función serverless (límite: 225 MB). Quitándolo, el backend baja
a unos 125 MB y el proyecto entero se despliega en un solo sitio.

La firma imita la de `curve_fit` en lo que aquí se usa, para que el resto del
código no note el cambio:

    popt, pcov = curve_fit(f, xdata, ydata, p0=..., sigma=..., absolute_sigma=...)

`xdata` se pasa tal cual a `f`, así que puede ser un vector (ajustes 2D) o una
matriz 2×N con (x, y) apilados (superficies 3D).

El método
---------
Se minimiza S(p) = Σ rᵢ(p)², con r = (f(x, p) − y)/σ. En cada iteración se
resuelve el sistema amortiguado de Marquardt

    (JᵀJ + λ·diag(JᵀJ))·δ = −Jᵀr

y se acepta el paso si baja el coste, en cuyo caso λ se reduce (el método tiende
a Gauss-Newton, convergencia cuadrática cerca del mínimo); si no, se rechaza y λ
sube (el paso se acorta y gira hacia el gradiente). El jacobiano se calcula por
diferencias hacia adelante, igual que hace MINPACK cuando no se le da la
derivada analítica.

La covarianza se obtiene por SVD del jacobiano, como en SciPy: si σ son
absolutas, cov = (JᵀJ)⁻¹; si no, se escala por S/(n − p). Cuando el jacobiano es
deficiente de rango —parámetros que los datos no determinan— la covarianza sale
llena de infinitos en vez de fallar, y el panel de resultados lo traduce en «la
incertidumbre supera al propio parámetro».
"""
from __future__ import annotations

import numpy as np

_EPS = float(np.finfo(float).eps)

# Mismas tolerancias que trae curve_fit por defecto.
_FTOL = 1.49012e-8
_XTOL = 1.49012e-8
_GTOL = 1.49012e-8


def _residuals(f, xdata, ydata, params, weights) -> np.ndarray:
    """r = (f(x, p) − y)/σ, ya ponderados."""
    modelo = np.asarray(f(xdata, *params), dtype=float)
    if modelo.shape != ydata.shape:
        raise ValueError(
            "La función del modelo no devuelve un valor por punto: "
            f"esperaba {ydata.shape} y obtuvo {modelo.shape}."
        )
    return (modelo - ydata) * weights


def _jacobian(f, xdata, ydata, params, weights, r0) -> np.ndarray:
    """Jacobiano ∂r/∂p por diferencias hacia adelante.

    El paso es sqrt(eps)·|p_j|, el de MINPACK: lo bastante grande para que la
    resta no se pierda en el redondeo y lo bastante pequeño para que la derivada
    siga siendo local. Con p_j = 0 no hay escala de referencia y se usa sqrt(eps).
    """
    n_par = params.size
    jac = np.empty((r0.size, n_par), dtype=float)
    raiz_eps = np.sqrt(_EPS)
    for j in range(n_par):
        paso = raiz_eps * abs(params[j])
        if paso == 0.0:
            paso = raiz_eps
        desplazados = params.copy()
        desplazados[j] += paso
        # El paso efectivo no es exactamente `paso`: al sumarlo se redondea al
        # flotante más cercano. Usamos la diferencia real para no sesgar.
        paso_real = desplazados[j] - params[j]
        jac[:, j] = (
            _residuals(f, xdata, ydata, desplazados, weights) - r0
        ) / paso_real
    return jac


def _covariance(jac: np.ndarray, coste: float, n_datos: int, n_par: int,
                absolute_sigma: bool) -> np.ndarray:
    """(JᵀJ)⁻¹ vía SVD, con el escalado que aplica curve_fit."""
    try:
        _, valores, vt = np.linalg.svd(jac, full_matrices=False)
    except np.linalg.LinAlgError:
        return np.full((n_par, n_par), np.inf)

    umbral = _EPS * max(jac.shape) * (valores[0] if valores.size else 0.0)
    validos = valores > umbral
    if not np.all(validos):
        # Rango deficiente: hay direcciones del espacio de parámetros que los
        # datos no restringen, así que la covarianza no está definida.
        return np.full((n_par, n_par), np.inf)

    pcov = (vt.T / valores**2) @ vt

    if not absolute_sigma:
        grados = n_datos - n_par
        if grados <= 0:
            return np.full((n_par, n_par), np.inf)
        pcov = pcov * (2.0 * coste / grados)
    return pcov


def curve_fit(
    f,
    xdata,
    ydata,
    p0,
    sigma=None,
    absolute_sigma: bool = False,
    maxfev: int = 20000,
):
    """Ajusta f(xdata, *params) a ydata. Devuelve (popt, pcov).

    Lanza RuntimeError si no converge dentro de `maxfev` evaluaciones y
    ValueError si el modelo devuelve valores no finitos en el punto de partida
    (ambas las capturan los llamantes para pasar al siguiente arranque).
    """
    params = np.asarray(p0, dtype=float).copy()
    ydata = np.asarray(ydata, dtype=float)
    n_par = params.size
    n_datos = ydata.size

    if n_datos < n_par:
        raise ValueError(
            f"Hacen falta al menos {n_par} puntos para ajustar {n_par} parámetros."
        )

    pesos = 1.0 / np.asarray(sigma, dtype=float) if sigma is not None else 1.0

    evaluaciones = 0

    def resid(p):
        nonlocal evaluaciones
        evaluaciones += 1
        return _residuals(f, xdata, ydata, p, pesos)

    r = resid(params)
    if not np.all(np.isfinite(r)):
        raise ValueError("El modelo no da valores finitos en la estimación inicial.")
    coste = 0.5 * float(r @ r)

    jac = _jacobian(f, xdata, ydata, params, pesos, r)
    evaluaciones += n_par
    if not np.all(np.isfinite(jac)):
        raise ValueError("El jacobiano no es finito en la estimación inicial.")

    normales = jac.T @ jac
    gradiente = jac.T @ r
    # λ inicial proporcional a la escala del problema, como en MINPACK.
    diagonal = np.diag(normales).copy()
    lam = 1e-3 * float(np.max(diagonal)) if np.max(diagonal) > 0 else 1e-3

    convergido = False
    while evaluaciones < maxfev:
        if np.max(np.abs(gradiente)) < _GTOL:
            convergido = True
            break

        # Escalado de Marquardt: amortiguar cada parámetro según su propia
        # curvatura, para que el método no dependa de las unidades de cada uno.
        escala = np.where(diagonal > 0, diagonal, 1.0)
        try:
            delta = np.linalg.solve(normales + lam * np.diag(escala), -gradiente)
        except np.linalg.LinAlgError:
            lam *= 10.0
            if lam > 1e12:
                break
            continue

        candidatos = params + delta
        if not np.all(np.isfinite(candidatos)):
            lam *= 10.0
            if lam > 1e12:
                break
            continue

        r_nuevo = resid(candidatos)
        coste_nuevo = (
            0.5 * float(r_nuevo @ r_nuevo) if np.all(np.isfinite(r_nuevo)) else np.inf
        )

        if coste_nuevo < coste:
            mejora = coste - coste_nuevo
            paso_pequeno = np.linalg.norm(delta) < _XTOL * (
                np.linalg.norm(params) + _XTOL
            )
            params = candidatos
            r = r_nuevo
            coste = coste_nuevo

            jac = _jacobian(f, xdata, ydata, params, pesos, r)
            evaluaciones += n_par
            if not np.all(np.isfinite(jac)):
                break
            normales = jac.T @ jac
            gradiente = jac.T @ r
            diagonal = np.diag(normales).copy()
            lam = max(lam / 10.0, 1e-14)

            if mejora < _FTOL * max(coste, _EPS) or paso_pequeno:
                convergido = True
                break
        else:
            lam *= 10.0
            if lam > 1e12:
                # Ni amortiguando al máximo se mejora: estamos en el mínimo que
                # este arranque puede alcanzar.
                convergido = True
                break

    if not convergido and evaluaciones >= maxfev:
        raise RuntimeError(
            "El ajuste no converge: se agotaron las evaluaciones permitidas."
        )

    pcov = _covariance(jac, coste, n_datos, n_par, absolute_sigma)
    return params, pcov
