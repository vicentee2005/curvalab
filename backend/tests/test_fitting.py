"""Tests del motor de ajuste con datos sintéticos que imitan prácticas reales.

Cada caso genera datos con parámetros conocidos (con ruido reproducible) y
comprueba que el ajuste recupera los parámetros dentro de una tolerancia.
"""
import numpy as np
import pytest

from app.schemas import FitModel, FitRequest
from app.fitting import FitError, run_fit


rng = np.random.default_rng(42)


def test_linear_recovers_parameters():
    x = np.linspace(0, 10, 40)
    y = 2.0 * x + 1.0 + rng.normal(0, 0.05, x.size)
    r = run_fit(FitRequest(model=FitModel.linear, x=list(x), y=list(y)))
    params = {p.name: p.value for p in r.parameters}
    assert params["a"] == pytest.approx(2.0, abs=0.05)
    assert params["b"] == pytest.approx(1.0, abs=0.1)
    assert r.r_squared > 0.999
    assert r.n_points == 40


def test_linear_weighted_uses_sigma_and_chi2():
    x = np.linspace(0, 10, 30)
    y = 3.0 * x - 2.0 + rng.normal(0, 0.2, x.size)
    sy = np.full(x.size, 0.2)
    r = run_fit(FitRequest(model=FitModel.linear, x=list(x), y=list(y), sy=list(sy)))
    assert r.chi_squared is not None
    assert r.reduced_chi_squared is not None
    # chi2 reducido ~1 cuando el modelo y las barras de error son correctos.
    assert 0.3 < r.reduced_chi_squared < 3.0


def test_polynomial_quadratic():
    """Imita 'Datos_para_ajuste_cuadratico': y = c0 + c1 x + c2 x^2."""
    x = np.linspace(-5, 5, 50)
    y = 1.5 - 0.8 * x + 0.5 * x**2 + rng.normal(0, 0.1, x.size)
    r = run_fit(FitRequest(model=FitModel.polynomial, x=list(x), y=list(y), degree=2))
    params = {p.name: p.value for p in r.parameters}
    assert params["c0"] == pytest.approx(1.5, abs=0.15)
    assert params["c1"] == pytest.approx(-0.8, abs=0.1)
    assert params["c2"] == pytest.approx(0.5, abs=0.05)
    assert r.r_squared > 0.999


def test_exponential_capacitor_discharge():
    """Imita 'descarga de condensador': V(t) = V0 exp(-t/RC) + offset."""
    t = np.linspace(0, 8, 60)
    y = 10.0 * np.exp(-0.6 * t) + 0.3 + rng.normal(0, 0.02, t.size)
    r = run_fit(FitRequest(model=FitModel.exponential, x=list(t), y=list(y)))
    params = {p.name: p.value for p in r.parameters}
    assert params["a"] == pytest.approx(10.0, abs=0.3)
    assert params["b"] == pytest.approx(-0.6, abs=0.05)
    assert params["c"] == pytest.approx(0.3, abs=0.2)
    assert r.r_squared > 0.999


def test_custom_cosine():
    """Imita 'Datos_para_ajuste_cosenoidal': y = A cos(w t + phi) + off."""
    t = np.linspace(0, 6, 80)
    y = 7.0 + 1.2 * np.cos(2.0 * t + 0.5) + rng.normal(0, 0.05, t.size)
    r = run_fit(FitRequest(
        model=FitModel.custom,
        x=list(t),
        y=list(y),
        expression="off + A*cos(w*x + phi)",
        parameters=["off", "A", "w", "phi"],
        initial_guess=[7.0, 1.0, 2.0, 0.0],
    ))
    params = {p.name: p.value for p in r.parameters}
    assert params["off"] == pytest.approx(7.0, abs=0.1)
    assert abs(params["A"]) == pytest.approx(1.2, abs=0.15)
    assert r.r_squared > 0.99


def test_custom_rlc_underdamped():
    """Imita 'RLC subamortiguado': envolvente exponencial * coseno."""
    t = np.linspace(0, 5, 100)
    y = 4.0 * np.exp(-0.5 * t) * np.cos(6.0 * t + 0.2) + rng.normal(0, 0.02, t.size)
    r = run_fit(FitRequest(
        model=FitModel.custom,
        x=list(t),
        y=list(y),
        expression="A*exp(-g*x)*cos(w*x + phi)",
        parameters=["A", "g", "w", "phi"],
        initial_guess=[4.0, 0.5, 6.0, 0.0],
    ))
    params = {p.name: p.value for p in r.parameters}
    assert params["g"] == pytest.approx(0.5, abs=0.1)
    assert params["w"] == pytest.approx(6.0, abs=0.1)
    assert r.r_squared > 0.99


def test_periodic_converges_without_initial_guess():
    """Regresión: un modelo periódico debe converger SIN estimación inicial.

    Antes del multi-arranque, curve_fit partía de [1, 1] y caía en un mínimo
    local (una recta casi plana, R² ~ 0.03) aunque el modelo fuese el correcto.
    """
    t = np.linspace(0, 7, 45)
    y = 3.2 * np.cos(1.7 * t) + rng.normal(0, 0.12, t.size)
    r = run_fit(FitRequest(
        model=FitModel.custom,
        x=list(t),
        y=list(y),
        expression="a*cos(k*x)",
        parameters=["a", "k"],
        # deliberadamente SIN initial_guess
    ))
    params = {p.name: p.value for p in r.parameters}
    assert abs(params["a"]) == pytest.approx(3.2, abs=0.15)
    assert params["k"] == pytest.approx(1.7, abs=0.05)
    assert r.r_squared > 0.99


def test_periodic_with_phase_without_initial_guess():
    t = np.linspace(0, 6, 60)
    y = 2.0 * np.sin(2.5 * t + 0.8) + rng.normal(0, 0.05, t.size)
    r = run_fit(FitRequest(
        model=FitModel.custom, x=list(t), y=list(y),
        expression="a*sin(b*x + c)", parameters=["a", "b", "c"],
    ))
    params = {p.name: p.value for p in r.parameters}
    assert abs(params["b"]) == pytest.approx(2.5, abs=0.05)
    assert r.r_squared > 0.99


def test_power_law():
    x = np.linspace(1, 20, 40)
    y = 2.5 * x**1.8 + rng.normal(0, 0.5, x.size)
    r = run_fit(FitRequest(model=FitModel.power, x=list(x), y=list(y)))
    params = {p.name: p.value for p in r.parameters}
    assert params["b"] == pytest.approx(1.8, abs=0.1)


def test_parameter_uncertainties_present():
    x = np.linspace(0, 10, 20)
    y = 2.0 * x + 1.0 + rng.normal(0, 0.1, x.size)
    r = run_fit(FitRequest(model=FitModel.linear, x=list(x), y=list(y)))
    for p in r.parameters:
        assert p.stderr is not None and p.stderr > 0


# --- Errores esperados ---------------------------------------------------- #
def test_too_few_points_raises():
    with pytest.raises(FitError):
        run_fit(FitRequest(model=FitModel.linear, x=[1.0], y=[2.0]))


def test_logarithmic_requires_positive_x():
    with pytest.raises(FitError):
        run_fit(FitRequest(model=FitModel.logarithmic, x=[-1.0, 0.0, 1.0], y=[1.0, 2.0, 3.0]))


def test_custom_rejects_unknown_symbol():
    with pytest.raises(FitError):
        run_fit(FitRequest(
            model=FitModel.custom, x=[1.0, 2.0, 3.0], y=[1.0, 2.0, 3.0],
            expression="a*x + zzz", parameters=["a"],
        ))


def test_nan_rows_are_dropped():
    x = [1.0, 2.0, float("nan"), 4.0, 5.0]
    y = [2.0, 4.0, 6.0, float("nan"), 10.0]
    r = run_fit(FitRequest(model=FitModel.linear, x=x, y=y))
    # Se descartan las 2 filas con NaN -> quedan 3 puntos.
    assert r.n_points == 3
