"""Tests del Levenberg-Marquardt propio (`app.lm`).

Sustituyó a `scipy.optimize.curve_fit`, así que aquí no vale comprobar solo que
«converge»: hay que verificar los parámetros Y su covarianza, que es de donde
salen las incertidumbres que ve el usuario.

Los casos clave se contrastan contra soluciones **analíticas**, no contra otra
implementación: para un modelo lineal con σ conocidas, tanto los parámetros como
su matriz de covarianza tienen fórmula cerrada, así que el test es
independiente de cualquier librería.
"""
import numpy as np
import pytest

from app.lm import curve_fit


rng = np.random.default_rng(5)


# --------------------------------------------------------------------------- #
# Contraste contra la solución analítica de mínimos cuadrados
# --------------------------------------------------------------------------- #
def test_modelo_lineal_coincide_con_la_solucion_exacta():
    """Para y = a·x + b la respuesta es álgebra, no iteración.

    popt debe caer sobre (AᵀA)⁻¹Aᵀy y la covarianza sobre σ²(AᵀA)⁻¹, que es la
    referencia contra la que se mide todo lo demás.
    """
    x = np.linspace(0, 10, 40)
    sigma_real = 0.3
    y = 2.5 * x - 1.0 + rng.normal(0, sigma_real, x.size)
    sy = np.full(x.size, sigma_real)

    popt, pcov = curve_fit(
        lambda xx, a, b: a * xx + b, x, y, p0=[1.0, 0.0],
        sigma=sy, absolute_sigma=True,
    )

    # Solución exacta con pesos 1/σ.
    A = np.vstack([x, np.ones_like(x)]).T / sigma_real
    normales = np.linalg.inv(A.T @ A)
    exacta = normales @ (A.T @ (y / sigma_real))

    assert popt == pytest.approx(exacta, rel=1e-8)
    assert pcov == pytest.approx(normales, rel=1e-6)


def test_sigma_absolutas_no_dependen_del_numero_de_puntos_repetidos():
    """Con absolute_sigma=True la incertidumbre la fijan las σ, no el residuo.

    Escalar todas las σ por k debe escalar las incertidumbres por k exactamente.
    """
    x = np.linspace(0, 5, 25)
    y = 1.5 * x + 0.5 + rng.normal(0, 0.1, x.size)
    f = lambda xx, a, b: a * xx + b  # noqa: E731

    _, cov1 = curve_fit(f, x, y, p0=[1.0, 0.0],
                        sigma=np.full(x.size, 0.1), absolute_sigma=True)
    _, cov2 = curve_fit(f, x, y, p0=[1.0, 0.0],
                        sigma=np.full(x.size, 0.3), absolute_sigma=True)

    assert np.sqrt(np.diag(cov2)) == pytest.approx(3.0 * np.sqrt(np.diag(cov1)), rel=1e-6)


def test_sin_sigma_la_covarianza_se_escala_con_el_residuo():
    """Con absolute_sigma=False la escala sale de la dispersión observada.

    Es el comportamiento por defecto: σ² estimada = SSR/(n − p).
    """
    x = np.linspace(0, 10, 50)
    ruido = 0.4
    y = 3.0 * x + 2.0 + rng.normal(0, ruido, x.size)

    popt, pcov = curve_fit(lambda xx, a, b: a * xx + b, x, y, p0=[1.0, 0.0])

    resid = y - (popt[0] * x + popt[1])
    s2 = float(resid @ resid) / (x.size - 2)
    A = np.vstack([x, np.ones_like(x)]).T
    esperada = s2 * np.linalg.inv(A.T @ A)

    assert pcov == pytest.approx(esperada, rel=1e-6)


# --------------------------------------------------------------------------- #
# Modelos no lineales con parámetros conocidos
# --------------------------------------------------------------------------- #
def test_exponencial_recupera_los_parametros():
    x = np.linspace(0, 5, 60)
    y = 10.0 * np.exp(-0.44 * x) + 0.3 + rng.normal(0, 0.02, x.size)
    popt, _ = curve_fit(
        lambda xx, a, b, c: a * np.exp(b * xx) + c, x, y, p0=[8.0, -0.3, 0.0]
    )
    assert popt[0] == pytest.approx(10.0, abs=0.1)
    assert popt[1] == pytest.approx(-0.44, abs=0.01)
    assert popt[2] == pytest.approx(0.3, abs=0.05)


def test_gaussiana_recupera_centro_y_anchura():
    x = np.linspace(-5, 5, 80)
    y = 3.0 * np.exp(-((x - 0.7) ** 2) / (2 * 1.3**2)) + rng.normal(0, 0.02, x.size)
    popt, _ = curve_fit(
        lambda xx, A, mu, s: A * np.exp(-((xx - mu) ** 2) / (2 * s**2)),
        x, y, p0=[2.0, 0.0, 1.0],
    )
    assert popt[0] == pytest.approx(3.0, abs=0.05)
    assert popt[1] == pytest.approx(0.7, abs=0.02)
    assert abs(popt[2]) == pytest.approx(1.3, abs=0.02)


def test_admite_xdata_de_dos_filas_para_superficies():
    """Las superficies 3D empaquetan (x, y) en una matriz 2×N."""
    n = 300
    x = rng.uniform(-3, 3, n)
    y = rng.uniform(-3, 3, n)
    z = 2.0 * x**2 - 1.5 * y**2 + 0.4 + rng.normal(0, 0.02, n)

    popt, _ = curve_fit(
        lambda m, a, b, c: a * m[0] ** 2 + b * m[1] ** 2 + c,
        np.vstack([x, y]), z, p0=[1.0, 1.0, 0.0],
    )
    assert popt[0] == pytest.approx(2.0, abs=0.01)
    assert popt[1] == pytest.approx(-1.5, abs=0.01)
    assert popt[2] == pytest.approx(0.4, abs=0.02)


def test_converge_desde_un_arranque_lejano():
    """El multi-arranque de la app depende de que aguante puntos de partida malos."""
    x = np.linspace(1, 10, 40)
    y = 3.0 * x**1.7 + rng.normal(0, 0.3, x.size)
    popt, _ = curve_fit(lambda xx, a, b: a * xx**b, x, y, p0=[100.0, 0.1])
    assert popt[0] == pytest.approx(3.0, abs=0.1)
    assert popt[1] == pytest.approx(1.7, abs=0.02)


# --------------------------------------------------------------------------- #
# Casos límite: lo que la app captura para pasar al siguiente arranque
# --------------------------------------------------------------------------- #
def test_covarianza_infinita_si_los_datos_no_determinan_el_modelo():
    """Dos parámetros que solo aparecen sumados no son separables.

    y = a + b no tiene solución única: solo se determina a+b. La covarianza debe
    salir infinita en vez de inventarse una incertidumbre pequeña.
    """
    x = np.linspace(0, 5, 20)
    y = np.full(x.size, 3.0) + rng.normal(0, 0.01, x.size)

    _, pcov = curve_fit(lambda xx, a, b: a + b + 0.0 * xx, x, y, p0=[1.0, 1.0])
    assert np.all(~np.isfinite(pcov))


def test_error_si_hay_menos_puntos_que_parametros():
    x = np.array([1.0, 2.0])
    y = np.array([1.0, 2.0])
    with pytest.raises(ValueError):
        curve_fit(lambda xx, a, b, c: a * xx**2 + b * xx + c, x, y, p0=[1.0, 1.0, 1.0])


def test_error_si_el_modelo_no_es_finito_en_el_arranque():
    x = np.linspace(1, 5, 10)
    y = np.log(x)
    # El NaN es el objeto del test, así que su aviso no aporta nada.
    with np.errstate(all="ignore"), pytest.raises(ValueError):
        # log(x − 10) es NaN en todo el rango: ese arranque no sirve.
        curve_fit(lambda xx, a: a * np.log(xx - 10.0), x, y, p0=[1.0])


def test_no_convergencia_avisa_en_vez_de_devolver_basura():
    """Con un presupuesto ridículo de evaluaciones debe lanzar RuntimeError.

    La app lo captura para probar el siguiente arranque; si devolviera valores a
    medio converger, los daría por buenos.
    """
    x = np.linspace(0, 5, 60)
    y = 10.0 * np.exp(-0.44 * x) + 0.3
    with pytest.raises(RuntimeError):
        curve_fit(
            lambda xx, a, b, c: a * np.exp(b * xx) + c,
            x, y, p0=[1.0, -5.0, 100.0], maxfev=8,
        )


def test_el_resultado_no_depende_de_la_escala_de_los_parametros():
    """Marquardt amortigua cada parámetro según su curvatura.

    El mismo problema con un parámetro en unidades mil veces mayores debe dar el
    mismo ajuste; si no, el método dependería de en qué unidades midas.
    """
    x = np.linspace(0, 5, 50)
    y = 10.0 * np.exp(-0.44 * x) + rng.normal(0, 0.02, x.size)

    p_normal, _ = curve_fit(lambda xx, a, b: a * np.exp(b * xx), x, y, p0=[8.0, -0.3])
    # a' = a·1000: el modelo es idéntico, la escala del parámetro no.
    p_escalado, _ = curve_fit(
        lambda xx, a, b: (a / 1000.0) * np.exp(b * xx), x, y, p0=[8000.0, -0.3]
    )

    assert p_escalado[0] / 1000.0 == pytest.approx(p_normal[0], rel=1e-6)
    assert p_escalado[1] == pytest.approx(p_normal[1], rel=1e-6)
