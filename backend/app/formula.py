"""Parseo seguro de fórmulas propias del usuario con SymPy.

En vez de `eval` (peligroso), la expresión introducida por el usuario se
convierte en una expresión simbólica de SymPy restringida a un conjunto de
funciones matemáticas conocidas, y luego en una función numérica de NumPy con
`lambdify`. Así la fórmula del "ajuste no lineal (fórmula propia)" del menú
Análisis se evalúa de forma controlada.
"""
from __future__ import annotations

from typing import Callable

import numpy as np
import sympy as sp
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
    convert_xor,
)

# Funciones matemáticas permitidas en la expresión del usuario.
_ALLOWED_FUNCS: dict[str, object] = {
    "sin": sp.sin, "cos": sp.cos, "tan": sp.tan,
    "asin": sp.asin, "acos": sp.acos, "atan": sp.atan,
    "sinh": sp.sinh, "cosh": sp.cosh, "tanh": sp.tanh,
    "exp": sp.exp, "log": sp.log, "ln": sp.log,
    "sqrt": sp.sqrt, "Abs": sp.Abs, "abs": sp.Abs,
    "pi": sp.pi, "E": sp.E,
}

# Transformaciones: multiplicación implícita (2x -> 2*x) y ^ como potencia.
_TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)


class FormulaError(ValueError):
    """La fórmula del usuario no es válida o usa símbolos no permitidos."""


def _parse(expression: str, symbol_names: list[str]) -> tuple[sp.Expr, dict[str, sp.Symbol]]:
    """Convierte el texto del usuario en una expresión simbólica de SymPy.

    Solo se admiten los símbolos declarados en `symbol_names` y las funciones
    de `_ALLOWED_FUNCS`. Devuelve la expresión y el diccionario de símbolos.
    """
    if not expression or not expression.strip():
        raise FormulaError("La expresión está vacía.")

    local_symbols: dict[str, sp.Symbol] = {}
    for name in symbol_names:
        if not name.isidentifier():
            raise FormulaError(f"Nombre de variable no válido: {name!r}")
        local_symbols[name] = sp.Symbol(name)

    local_dict = {**local_symbols, **_ALLOWED_FUNCS}
    try:
        expr = parse_expr(
            expression,
            local_dict=local_dict,
            transformations=_TRANSFORMATIONS,
            evaluate=True,
        )
    except (SyntaxError, TypeError, sp.SympifyError) as exc:
        raise FormulaError(f"No se pudo interpretar la expresión: {exc}") from exc

    # Nota: un nombre de función que no esté en la lista blanca nunca llega a
    # ser una función indefinida. La multiplicación implícita se le adelanta y
    # "sen(x)" acaba siendo s·e·n·x, así que el fallo aparece más adelante como
    # símbolos desconocidos (con su aviso correspondiente).
    return expr, local_symbols


def _compile(
    expression: str,
    param_names: list[str],
    var_names: list[str],
) -> Callable[..., np.ndarray]:
    """Compila una expresión a f(*vars, *params) evaluable con NumPy.

    Núcleo común del ajuste 2D (una variable, x) y del ajuste de superficies
    (dos variables, x e y).

    Raises:
        FormulaError: si la expresión es inválida o contiene símbolos
            desconocidos (no permitidos como funciones ni declarados como
            parámetros / variables).
    """
    if not expression or not expression.strip():
        raise FormulaError("La expresión está vacía.")
    if not param_names:
        raise FormulaError("Indica al menos un parámetro a ajustar.")

    # Símbolos conocidos: las variables + los parámetros.
    expr, local_symbols = _parse(expression, [*var_names, *param_names])

    # Comprobar que todos los símbolos libres son conocidos (var o parámetros).
    allowed_symbol_names = set(local_symbols.keys())
    used = {s.name for s in expr.free_symbols}
    unknown = used - allowed_symbol_names
    if unknown:
        vars_txt = " ni ".join(f"'{v}'" for v in var_names)
        raise FormulaError(
            "Símbolos desconocidos en la fórmula: "
            + ", ".join(sorted(unknown))
            + f". Declara cada uno como parámetro o usa {vars_txt} como variable."
        )

    # Orden de argumentos: (x, [y,] a, b, c, ...).
    ordered = [local_symbols[v] for v in var_names]
    ordered += [local_symbols[p] for p in param_names]
    try:
        func = sp.lambdify(ordered, expr, modules=["numpy"])
    except Exception as exc:  # noqa: BLE001 - lambdify puede lanzar variado
        raise FormulaError(f"No se pudo compilar la fórmula: {exc}") from exc

    return func


def build_model_function(
    expression: str,
    param_names: list[str],
    var: str = "x",
) -> Callable[..., np.ndarray]:
    """Convierte una expresión en f(x, *params) evaluable con NumPy.

    Args:
        expression: p. ej. "a*exp(-b*x) + c" o "a*sin(b*x + c)".
        param_names: nombres de los parámetros a ajustar, p. ej. ["a","b","c"].
        var: nombre de la variable independiente (por defecto "x").

    Returns:
        Una función `f(x, *params) -> ndarray`.
    """
    return _compile(expression, param_names, [var])


def build_surface_function(
    expression: str,
    param_names: list[str],
) -> Callable[..., np.ndarray]:
    """Convierte una expresión z = f(x, y) en f(x, y, *params) con NumPy.

    Es el equivalente de `build_model_function` para el entorno 3D: la
    expresión puede usar dos variables independientes, `x` e `y`.

    Ejemplo: "a*x + b*y + c*x*y" con param_names ["a", "b", "c"].
    """
    return _compile(expression, param_names, ["x", "y"])


# --------------------------------------------------------------------------- #
# Propagación de incertidumbres: derivación simbólica
# --------------------------------------------------------------------------- #
def formula_symbols(expression: str) -> list[str]:
    """Devuelve los nombres de las variables que aparecen en la expresión.

    Se usa para construir sola la tabla de variables del entorno de
    propagación: el usuario escribe la fórmula y la app deduce qué magnitudes
    tiene que pedirle. `pi` y `e` no cuentan: SymPy los resuelve a constantes.
    """
    if not expression or not expression.strip():
        return []
    # Sin lista blanca de símbolos: aquí cualquier identificador es una
    # variable del usuario, y es justo lo que queremos descubrir.
    expr, _ = _parse(expression, [])
    return sorted(s.name for s in expr.free_symbols)


def build_uncertainty_functions(
    expression: str,
    var_names: list[str],
) -> tuple[Callable[..., np.ndarray], dict[str, tuple[str, Callable[..., np.ndarray]]]]:
    """Compila f(*vars) y sus derivadas parciales ∂f/∂v.

    Es el corazón de la propagación gaussiana: en vez de derivar a mano, SymPy
    deriva la expresión de forma simbólica y cada derivada se convierte en una
    función de NumPy (así vale igual para un valor suelto que para una columna
    entera).

    Returns:
        (f, derivadas) donde `derivadas[v] = (texto_legible, función)`.

    Raises:
        FormulaError: expresión inválida o con símbolos no declarados.
    """
    expr, symbols = _parse(expression, var_names)

    unknown = {s.name for s in expr.free_symbols} - set(symbols)
    if unknown:
        mensaje = (
            "Símbolos desconocidos en la fórmula: "
            + ", ".join(sorted(unknown))
            + ". Declara cada uno como variable con su valor."
        )
        # Varias letras sueltas suelen venir de un nombre de función que no
        # existe: 'sen(x)' se lee como s·e·n·x. Conviene decirlo, porque el
        # mensaje a secas resulta desconcertante.
        if len(unknown) > 1 and all(len(u) == 1 for u in unknown):
            mensaje += (
                " Si querías llamar a una función, revisa el nombre: las letras "
                "sueltas se multiplican entre sí (el seno es 'sin', no 'sen')."
            )
        raise FormulaError(mensaje)

    ordered = [symbols[v] for v in var_names]
    try:
        func = sp.lambdify(ordered, expr, modules=["numpy"])
    except Exception as exc:  # noqa: BLE001 - lambdify puede lanzar variado
        raise FormulaError(f"No se pudo compilar la fórmula: {exc}") from exc

    derivatives: dict[str, tuple[str, Callable[..., np.ndarray]]] = {}
    for name in var_names:
        try:
            d_expr = sp.simplify(sp.diff(expr, symbols[name]))
            d_func = sp.lambdify(ordered, d_expr, modules=["numpy"])
        except Exception as exc:  # noqa: BLE001
            raise FormulaError(
                f"No se pudo derivar la fórmula respecto de '{name}': {exc}"
            ) from exc
        derivatives[name] = (sp.sstr(d_expr), d_func)

    return func, derivatives


def pretty_equation(expression: str, lhs: str = "y") -> str:
    """Devuelve una forma legible '<lhs> = <expr>' de la fórmula del usuario."""
    return f"{lhs} = {expression.strip()}"
