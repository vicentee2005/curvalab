"""Tests del motor de ajuste de superficies (entorno 3D).

Cada caso genera datos sintéticos con parámetros conocidos y comprueba que el
ajuste los recupera. Semilla fija para que los tests sean reproducibles.
"""
from __future__ import annotations

import numpy as np
import pytest

from app.fitting import FitError
from app.schemas import SurfaceFitRequest, SurfaceModel
from app.surface import run_surface_fit


def _scatter(n: int = 400, seed: int = 7) -> tuple[np.ndarray, np.ndarray]:
    """Puntos dispersos (no en rejilla) en [-5, 5] × [-5, 5]."""
    rng = np.random.default_rng(seed)
    x = rng.uniform(-5, 5, n)
    y = rng.uniform(-5, 5, n)
    return x, y


def _req(model: SurfaceModel, x, y, z, **kw) -> SurfaceFitRequest:
    return SurfaceFitRequest(
        model=model,
        x=list(map(float, x)),
        y=list(map(float, y)),
        z=list(map(float, z)),
        **kw,
    )


# --------------------------------------------------------------------------- #
# Plano
# --------------------------------------------------------------------------- #
def test_plane_recovers_parameters():
    x, y = _scatter()
    rng = np.random.default_rng(1)
    z = 2.5 * x - 1.4 * y + 3.0 + rng.normal(0, 0.05, x.size)

    res = run_surface_fit(_req(SurfaceModel.plane, x, y, z))

    values = {p.name: p.value for p in res.parameters}
    assert values["a"] == pytest.approx(2.5, abs=0.02)
    assert values["b"] == pytest.approx(-1.4, abs=0.02)
    assert values["c"] == pytest.approx(3.0, abs=0.02)
    assert res.r_squared > 0.999
    assert res.equation == "z = a·x + b·y + c"
    # Todas las incertidumbres son estimables con 400 puntos y 3 parámetros.
    assert all(p.stderr is not None and p.stderr > 0 for p in res.parameters)


def test_plane_returns_grid_ready_for_plotly():
    x, y = _scatter(n=60)
    z = x + y
    res = run_surface_fit(_req(SurfaceModel.plane, x, y, z, grid_points=25))

    assert len(res.grid_x) == 25
    assert len(res.grid_y) == 25
    # grid_z[j][i] = f(grid_x[i], grid_y[j]) -> filas = eje Y, columnas = eje X.
    assert len(res.grid_z) == 25
    assert all(len(row) == 25 for row in res.grid_z)
    esquina = res.grid_z[0][0]
    assert esquina == pytest.approx(res.grid_x[0] + res.grid_y[0], abs=1e-6)


# --------------------------------------------------------------------------- #
# Polinomio 2D
# --------------------------------------------------------------------------- #
def test_poly2d_recovers_paraboloid():
    x, y = _scatter()
    rng = np.random.default_rng(2)
    # z = 1 + 0.5x - 0.3y + 0.8x² + 0.2xy - 0.6y²
    z = (
        1.0 + 0.5 * x - 0.3 * y + 0.8 * x**2 + 0.2 * x * y - 0.6 * y**2
        + rng.normal(0, 0.05, x.size)
    )

    res = run_surface_fit(_req(SurfaceModel.poly2d, x, y, z, degree=2))

    values = {p.name: p.value for p in res.parameters}
    assert values["c00"] == pytest.approx(1.0, abs=0.03)
    assert values["c10"] == pytest.approx(0.5, abs=0.02)
    assert values["c01"] == pytest.approx(-0.3, abs=0.02)
    assert values["c20"] == pytest.approx(0.8, abs=0.01)
    assert values["c11"] == pytest.approx(0.2, abs=0.01)
    assert values["c02"] == pytest.approx(-0.6, abs=0.01)
    assert res.r_squared > 0.999


def test_poly2d_degree_two_has_six_terms():
    x, y = _scatter(n=50)
    z = x * y
    res = run_surface_fit(_req(SurfaceModel.poly2d, x, y, z, degree=2))
    # (n+1)(n+2)/2 = 6 términos para grado 2.
    assert len(res.parameters) == 6
    assert [p.name for p in res.parameters] == [
        "c00", "c10", "c01", "c20", "c11", "c02",
    ]


def test_poly2d_saddle_is_exact():
    """Una silla de montar z = x² − y² es exactamente de grado 2."""
    x, y = _scatter(n=200)
    z = x**2 - y**2
    res = run_surface_fit(_req(SurfaceModel.poly2d, x, y, z, degree=2))
    assert res.r_squared == pytest.approx(1.0, abs=1e-9)


# --------------------------------------------------------------------------- #
# Gaussiana 2D
# --------------------------------------------------------------------------- #
def test_gaussian2d_recovers_peak_without_initial_guess():
    x, y = _scatter(n=600, seed=11)
    rng = np.random.default_rng(3)
    z = (
        8.0 * np.exp(-(((x - 1.5) ** 2) / (2 * 1.2**2) + ((y + 2.0) ** 2) / (2 * 0.9**2)))
        + 0.5
        + rng.normal(0, 0.02, x.size)
    )

    res = run_surface_fit(_req(SurfaceModel.gaussian2d, x, y, z))

    values = {p.name: p.value for p in res.parameters}
    assert values["A"] == pytest.approx(8.0, abs=0.15)
    assert values["x0"] == pytest.approx(1.5, abs=0.05)
    assert values["y0"] == pytest.approx(-2.0, abs=0.05)
    assert values["sx"] == pytest.approx(1.2, abs=0.05)
    assert values["sy"] == pytest.approx(0.9, abs=0.05)
    assert values["c"] == pytest.approx(0.5, abs=0.05)
    assert res.r_squared > 0.99


def test_gaussian2d_widths_are_reported_positive():
    """σx y σy solo entran al cuadrado: se informan siempre positivos."""
    x, y = _scatter(n=400, seed=12)
    z = -5.0 * np.exp(-(((x) ** 2) / (2 * 1.5**2) + ((y) ** 2) / (2 * 1.5**2))) + 2.0

    res = run_surface_fit(_req(SurfaceModel.gaussian2d, x, y, z))
    values = {p.name: p.value for p in res.parameters}
    assert values["sx"] > 0
    assert values["sy"] > 0
    # Un valle: la amplitud sale negativa, y eso sí es significativo.
    assert values["A"] < 0


# --------------------------------------------------------------------------- #
# Fórmula propia z = f(x, y)
# --------------------------------------------------------------------------- #
def test_custom_surface_recovers_parameters():
    x, y = _scatter(n=400, seed=13)
    rng = np.random.default_rng(4)
    z = 2.0 * x**2 + 3.0 * y + 1.0 + rng.normal(0, 0.05, x.size)

    res = run_surface_fit(
        _req(
            SurfaceModel.custom, x, y, z,
            expression="a*x**2 + b*y + c",
            parameters=["a", "b", "c"],
        )
    )

    values = {p.name: p.value for p in res.parameters}
    assert values["a"] == pytest.approx(2.0, abs=0.02)
    assert values["b"] == pytest.approx(3.0, abs=0.02)
    assert values["c"] == pytest.approx(1.0, abs=0.05)
    assert res.equation == "z = a*x**2 + b*y + c"


def test_custom_surface_with_both_variables_multiplied():
    x, y = _scatter(n=300, seed=14)
    z = 1.7 * np.sin(0.8 * x) * np.cos(0.8 * y)

    res = run_surface_fit(
        _req(
            SurfaceModel.custom, x, y, z,
            expression="a*sin(k*x)*cos(k*y)",
            parameters=["a", "k"],
            initial_guess=[1.0, 1.0],
        )
    )
    assert res.r_squared > 0.99


def test_custom_surface_rejects_unknown_symbol():
    x, y = _scatter(n=50)
    z = x + y
    with pytest.raises(FitError, match="desconocidos"):
        run_surface_fit(
            _req(
                SurfaceModel.custom, x, y, z,
                expression="a*x + q*y",
                parameters=["a"],
            )
        )


# --------------------------------------------------------------------------- #
# Validación de datos
# --------------------------------------------------------------------------- #
def test_rejects_too_few_points():
    with pytest.raises(FitError, match="al menos 3 puntos"):
        run_surface_fit(_req(SurfaceModel.plane, [0.0, 1.0], [0.0, 1.0], [0.0, 1.0]))


def test_rejects_degenerate_data_all_x_equal():
    """Si X es constante los puntos no cubren un plano: es un problema 2D."""
    x = [1.0] * 10
    y = list(np.linspace(0, 5, 10))
    z = list(np.linspace(0, 5, 10))
    with pytest.raises(FitError, match="no pueden ser todos iguales"):
        run_surface_fit(_req(SurfaceModel.plane, x, y, z))


def test_drops_rows_with_missing_values():
    x, y = _scatter(n=100, seed=15)
    z = 2.0 * x + y
    x = list(x)
    y = list(y)
    z = list(z)
    # Tres filas incompletas que deben descartarse sin romper el ajuste.
    x[3] = float("nan")
    y[10] = float("nan")
    z[20] = float("nan")

    res = run_surface_fit(_req(SurfaceModel.plane, x, y, z))
    assert res.n_points == 97
    assert res.r_squared == pytest.approx(1.0, abs=1e-9)


def test_r2_alto_no_significa_modelo_determinado():
    """Un R² excelente puede convivir con parámetros que los datos no fijan.

    Se ajusta una gaussiana 2D a un paraboloide suave. Una campana muy ancha
    imita bien una parábola, así que el R² sale altísimo; pero la amplitud A y
    el fondo c se compensan mutuamente y ninguno queda determinado. Es el aviso
    que da el panel de resultados, y el motivo de que R² por sí solo no valide
    un modelo.
    """
    # _scatter cubre [-5, 5]; lo estrechamos a [-2, 2] para que la campana que
    # mejor imita la parábola sea mucho más ancha que la región medida.
    x, y = _scatter(n=300, seed=11)
    x, y = x * 0.4, y * 0.4
    # Con datos exactos el residuo es ~0 y la covarianza también: hace falta
    # ruido de medida para que la indeterminación se note, como en el laboratorio.
    ruido = np.random.default_rng(23).normal(0, 0.01, x.size)
    z = 2.0 - 0.05 * (x**2 + y**2) + ruido

    res = run_surface_fit(_req(SurfaceModel.gaussian2d, list(x), list(y), list(z)))

    assert res.r_squared > 0.95
    params = {p.name: p for p in res.parameters}
    indeterminados = [
        n for n, p in params.items()
        if p.stderr is None or not np.isfinite(p.stderr) or abs(p.stderr) > abs(p.value)
    ]
    assert "c" in indeterminados
