"""Tests de la propagación de incertidumbres.

Los casos se comparan contra el resultado hecho a mano con la fórmula de
propagación, y contra la simulación Monte Carlo, que debe coincidir con el
analítico siempre que la fórmula sea razonablemente lineal en ±σ.
"""
from __future__ import annotations

import math

import numpy as np
import pytest

from app.formula import FormulaError, build_uncertainty_functions, formula_symbols
from app.schemas import (
    Distribution,
    PropagateRequest,
    PropagateTableRequest,
    TableVariable,
    UncertainVariable,
)
from app.uncertainty import PropagationError, propagate, propagate_table


def _var(name: str, value: float, unc: float = 0.0, dist: str = "normal") -> UncertainVariable:
    return UncertainVariable(
        name=name, value=value, uncertainty=unc, distribution=Distribution(dist)
    )


def _req(expression: str, variables, **kw) -> PropagateRequest:
    kw.setdefault("seed", 12345)
    return PropagateRequest(expression=expression, variables=variables, **kw)


# --------------------------------------------------------------------------- #
# Derivación simbólica
# --------------------------------------------------------------------------- #
def test_symbols_are_detected():
    assert formula_symbols("4*pi**2*L/T**2") == ["L", "T"]


def test_pi_is_a_constant_not_a_variable():
    # Si 'pi' se colase como variable, la app pediría su valor al usuario.
    assert "pi" not in formula_symbols("2*pi*r")


def test_derivative_is_symbolic():
    _, derivs = build_uncertainty_functions("a*x**2", ["a", "x"])
    assert derivs["x"][0] == "2*a*x"
    assert derivs["a"][0] == "x**2"
    assert derivs["x"][1](3.0, 2.0) == pytest.approx(12.0)


def test_mistyped_function_gets_a_useful_hint():
    """'sen(x)' se lee como s·e·n·x: el aviso debe explicarlo."""
    with pytest.raises(FormulaError) as exc:
        build_uncertainty_functions("sen(x)", ["x"])
    assert "desconocidos" in str(exc.value)
    assert "'sin'" in str(exc.value)


def test_unknown_name_is_rejected():
    with pytest.raises(FormulaError, match="desconocidos"):
        build_uncertainty_functions("gamma_de*x", ["x"])


# --------------------------------------------------------------------------- #
# Casos de laboratorio
# --------------------------------------------------------------------------- #
def test_product_relative_errors_add_in_quadrature():
    """En z = x·y los errores relativos se suman en cuadratura."""
    res = propagate(_req("x*y", [_var("x", 4.0, 0.1), _var("y", 5.0, 0.2)]))
    assert res.value == pytest.approx(20.0)
    esperado = 20.0 * math.hypot(0.1 / 4.0, 0.2 / 5.0)
    assert res.uncertainty == pytest.approx(esperado)


def test_sum_errors_add_in_quadrature():
    res = propagate(_req("x + y", [_var("x", 1.0, 3.0), _var("y", 2.0, 4.0)]))
    assert res.value == pytest.approx(3.0)
    assert res.uncertainty == pytest.approx(5.0)  # 3-4-5


def test_pendulum_gravity():
    """g = 4π²L/T², el caso clásico del péndulo simple."""
    L, sL, T, sT = 1.000, 0.001, 2.006, 0.002
    res = propagate(_req("4*pi**2*L/T**2", [_var("L", L, sL), _var("T", T, sT)]))

    g = 4 * math.pi**2 * L / T**2
    dL = 4 * math.pi**2 / T**2
    dT = -8 * math.pi**2 * L / T**3
    assert res.value == pytest.approx(g)
    assert res.uncertainty == pytest.approx(math.hypot(dL * sL, dT * sT))

    # El período entra al cuadrado: domina el error aunque su σ sea parecida.
    aportes = {c.name: c.percent for c in res.contributions}
    assert aportes["T"] > aportes["L"]
    assert sum(aportes.values()) == pytest.approx(100.0)


def test_contributions_split_the_variance():
    res = propagate(_req("x + y", [_var("x", 1.0, 3.0), _var("y", 2.0, 4.0)]))
    porcentajes = {c.name: c.percent for c in res.contributions}
    assert porcentajes["x"] == pytest.approx(36.0)  # 9/25
    assert porcentajes["y"] == pytest.approx(64.0)  # 16/25


def test_variable_without_uncertainty_contributes_nothing():
    res = propagate(_req("x*y", [_var("x", 4.0, 0.1), _var("y", 5.0, 0.0)]))
    aporte_y = next(c for c in res.contributions if c.name == "y")
    assert aporte_y.term == 0.0
    assert res.uncertainty == pytest.approx(0.5)


def test_relative_uncertainty():
    res = propagate(_req("x", [_var("x", 10.0, 0.5)]))
    assert res.relative == pytest.approx(0.05)


# --------------------------------------------------------------------------- #
# Distribución rectangular
# --------------------------------------------------------------------------- #
def test_rectangular_uses_a_over_sqrt3():
    """La resolución de un instrumento es rectangular: σ = a/√3."""
    res = propagate(_req("x", [_var("x", 5.0, 0.01, "rectangular")]))
    assert res.uncertainty == pytest.approx(0.01 / math.sqrt(3))
    assert res.contributions[0].sigma == pytest.approx(0.01 / math.sqrt(3))


def test_rectangular_monte_carlo_matches_analytic():
    res = propagate(_req("x", [_var("x", 5.0, 0.6, "rectangular")], samples=200_000))
    assert res.mc is not None
    assert res.mc.std == pytest.approx(res.uncertainty, rel=0.02)


# --------------------------------------------------------------------------- #
# Monte Carlo
# --------------------------------------------------------------------------- #
def test_monte_carlo_agrees_when_formula_is_linear():
    res = propagate(_req("2*x + 3*y", [_var("x", 1.0, 0.1), _var("y", 2.0, 0.2)], samples=100_000))
    assert res.mc is not None
    assert res.mc.std == pytest.approx(res.uncertainty, rel=0.02)
    assert res.mc.mean == pytest.approx(res.value, abs=3 * res.uncertainty / math.sqrt(100_000))


def test_monte_carlo_disagrees_when_formula_is_very_nonlinear():
    """Con σ grande frente al valor, la gaussiana analítica se queda corta.

    En z = x² con x = 1 ± 0.5 la fórmula lineal da σ = 2·|x|·σx = 1.0, pero la
    simulación ve la curvatura: σ real = √(4x²σ² + 2σ⁴) ≈ 1.06, y la salida
    queda claramente asimétrica.
    """
    res = propagate(_req("x**2", [_var("x", 1.0, 0.5)], samples=200_000))
    assert res.uncertainty == pytest.approx(1.0)
    assert res.mc is not None
    assert res.mc.std == pytest.approx(math.sqrt(4 * 0.25 + 2 * 0.5**4), rel=0.03)
    assert res.mc.skewness > 0.5  # la cola se va hacia arriba


def test_monte_carlo_is_reproducible_with_a_seed():
    a = propagate(_req("x*y", [_var("x", 2.0, 0.1), _var("y", 3.0, 0.2)], seed=7))
    b = propagate(_req("x*y", [_var("x", 2.0, 0.1), _var("y", 3.0, 0.2)], seed=7))
    assert a.mc is not None and b.mc is not None
    assert a.mc.std == b.mc.std


def test_monte_carlo_can_be_skipped():
    res = propagate(_req("x", [_var("x", 1.0, 0.1)], monte_carlo=False))
    assert res.mc is None


def test_histogram_covers_all_samples():
    res = propagate(_req("x", [_var("x", 0.0, 1.0)], samples=5000))
    assert res.mc is not None
    assert sum(res.mc.hist_counts) == res.mc.samples
    assert len(res.mc.hist_edges) == len(res.mc.hist_counts) + 1


# --------------------------------------------------------------------------- #
# Errores de usuario
# --------------------------------------------------------------------------- #
def test_undeclared_symbol_is_rejected():
    with pytest.raises(PropagationError, match="desconocidos"):
        propagate(_req("x*k", [_var("x", 1.0, 0.1)]))


def test_formula_undefined_at_the_given_values():
    with pytest.raises(PropagationError, match="no está definid"):
        propagate(_req("log(x)", [_var("x", -3.0, 0.1)]))


def test_duplicated_variable_names_are_rejected():
    with pytest.raises(PropagationError, match="mismo nombre"):
        propagate(_req("x", [_var("x", 1.0), _var("x", 2.0)]))


def test_no_variables_is_rejected():
    with pytest.raises(PropagationError, match="al menos una variable"):
        propagate(_req("2+2", []))


# --------------------------------------------------------------------------- #
# Modo tabla
# --------------------------------------------------------------------------- #
def test_table_propagates_row_by_row():
    req = PropagateTableRequest(
        expression="x*y",
        variables=[
            TableVariable(name="x", values=[1.0, 2.0, 3.0], uncertainties=[0.1, 0.1, 0.1]),
            TableVariable(name="y", values=[10.0, 20.0, 30.0], uncertainties=[1.0, 1.0, 1.0]),
        ],
    )
    res = propagate_table(req)
    assert res.z == pytest.approx([10.0, 40.0, 90.0])
    # σ = √((y·σx)² + (x·σy)²) en cada fila
    esperado = [math.hypot(10 * 0.1, 1 * 1.0), math.hypot(20 * 0.1, 2 * 1.0), math.hypot(30 * 0.1, 3 * 1.0)]
    assert res.sz == pytest.approx(esperado)


def test_table_broadcasts_a_constant():
    """Una variable con un solo valor es una constante para todas las filas."""
    req = PropagateTableRequest(
        expression="m*g",
        variables=[
            TableVariable(name="m", values=[1.0, 2.0], uncertainties=[0.01, 0.01]),
            TableVariable(name="g", values=[9.81], uncertainties=[0.01]),
        ],
    )
    res = propagate_table(req)
    assert res.n_rows == 2
    assert res.z == pytest.approx([9.81, 19.62])


def test_table_leaves_undefined_rows_empty():
    req = PropagateTableRequest(
        expression="log(x)",
        variables=[TableVariable(name="x", values=[10.0, -1.0], uncertainties=[0.1, 0.1])],
    )
    res = propagate_table(req)
    assert res.z[0] == pytest.approx(math.log(10.0))
    assert res.z[1] is None
    assert res.sz[1] is None


def test_table_without_uncertainties_gives_zero_error():
    req = PropagateTableRequest(
        expression="2*x",
        variables=[TableVariable(name="x", values=[1.0, 2.0])],
    )
    res = propagate_table(req)
    assert res.sz == pytest.approx([0.0, 0.0])


def test_table_rejects_mismatched_lengths():
    req = PropagateTableRequest(
        expression="x+y",
        variables=[
            TableVariable(name="x", values=[1.0, 2.0, 3.0]),
            TableVariable(name="y", values=[1.0, 2.0]),
        ],
    )
    with pytest.raises(PropagationError, match="se esperaban"):
        propagate_table(req)


def test_table_derivatives_are_reported():
    req = PropagateTableRequest(
        expression="x**2*y",
        variables=[
            TableVariable(name="x", values=[1.0], uncertainties=[0.1]),
            TableVariable(name="y", values=[2.0], uncertainties=[0.1]),
        ],
    )
    res = propagate_table(req)
    assert res.derivatives["x"] == "2*x*y"
    assert res.derivatives["y"] == "x**2"


def test_table_matches_single_value_mode():
    """La misma cuenta por los dos caminos tiene que dar lo mismo."""
    unico = propagate(_req("4*pi**2*L/T**2", [_var("L", 1.0, 0.001), _var("T", 2.0, 0.002)],
                           monte_carlo=False))
    tabla = propagate_table(
        PropagateTableRequest(
            expression="4*pi**2*L/T**2",
            variables=[
                TableVariable(name="L", values=[1.0], uncertainties=[0.001]),
                TableVariable(name="T", values=[2.0], uncertainties=[0.002]),
            ],
        )
    )
    assert tabla.z[0] == pytest.approx(unico.value)
    assert tabla.sz[0] == pytest.approx(unico.uncertainty)


def test_table_rectangular_uses_the_same_factor():
    tabla = propagate_table(
        PropagateTableRequest(
            expression="x",
            variables=[
                TableVariable(
                    name="x",
                    values=[5.0],
                    uncertainties=[0.03],
                    distribution=Distribution.rectangular,
                )
            ],
        )
    )
    assert tabla.sz[0] == pytest.approx(0.03 / math.sqrt(3))


def test_nan_in_a_row_does_not_poison_the_rest():
    req = PropagateTableRequest(
        expression="x*2",
        variables=[TableVariable(name="x", values=[1.0, float("nan"), 3.0])],
    )
    res = propagate_table(req)
    assert res.z[0] == pytest.approx(2.0)
    assert res.z[1] is None
    assert res.z[2] == pytest.approx(6.0)


def test_old_fits_still_work():
    """La refactorización de formula.py no debe romper el ajuste de curvas."""
    from app.formula import build_model_function

    f = build_model_function("a*exp(-b*x)", ["a", "b"])
    assert f(np.array([0.0, 1.0]), 2.0, 1.0)[0] == pytest.approx(2.0)
