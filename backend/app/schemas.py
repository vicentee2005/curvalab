"""Esquemas de petición y respuesta de la API (Pydantic v2).

Estos modelos definen el contrato entre el frontend (React) y el motor de
ajuste. El backend es sin estado: cada petición trae los datos y el modelo a
ajustar, y devuelve los parámetros, sus incertidumbres y la curva evaluada.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class FitModel(str, Enum):
    """Tipos de ajuste soportados en la v1 (solo 2D)."""

    linear = "linear"          # y = a·x + b
    polynomial = "polynomial"  # y = c0 + c1·x + ... + cn·x^n
    exponential = "exponential"  # y = a·exp(b·x) + c
    logarithmic = "logarithmic"  # y = a·ln(x) + b
    power = "power"            # y = a·x^b
    custom = "custom"          # fórmula propia introducida por el usuario


class FitRequest(BaseModel):
    """Petición de ajuste enviada por el frontend."""

    model: FitModel
    x: list[float] = Field(..., description="Valores del eje X")
    y: list[float] = Field(..., description="Valores del eje Y")
    # Incertidumbres opcionales. sy pondera el ajuste (mínimos cuadrados
    # ponderados); sx se usa para el análisis pero curve_fit clásico no la
    # incorpora directamente (se documenta como limitación de la v1).
    sy: Optional[list[float]] = Field(None, description="Error en Y (σ) por punto")
    sx: Optional[list[float]] = Field(None, description="Error en X (σ) por punto")

    # Grado del polinomio (solo model == polynomial).
    degree: int = Field(2, ge=1, le=15)

    # Para model == custom: expresión y lista de nombres de parámetros.
    # Ej: expression="a*sin(b*x + c)", parameters=["a", "b", "c"].
    expression: Optional[str] = None
    parameters: Optional[list[str]] = None
    # Estimación inicial opcional de los parámetros (p0 de curve_fit).
    initial_guess: Optional[list[float]] = None

    # Nº de puntos de la curva suave devuelta para dibujar el ajuste.
    curve_points: int = Field(200, ge=2, le=2000)


class Parameter(BaseModel):
    """Un parámetro ajustado con su incertidumbre."""

    name: str
    value: float
    stderr: Optional[float] = None  # None si la covarianza no es estimable


class FitResponse(BaseModel):
    """Resultado del ajuste devuelto al frontend."""

    model: FitModel
    equation: str                 # forma legible, p. ej. "y = a·x + b"
    parameters: list[Parameter]
    r_squared: float
    adj_r_squared: Optional[float] = None
    chi_squared: Optional[float] = None       # solo si hay sy
    reduced_chi_squared: Optional[float] = None
    rmse: float
    n_points: int
    dof: int                       # grados de libertad (N - nº parámetros)
    # Curva suave para dibujar el ajuste sobre la gráfica.
    curve_x: list[float]
    curve_y: list[float]
    # Residuos (y_i - modelo(x_i)) por si el frontend quiere graficarlos.
    residuals: list[float]


# --------------------------------------------------------------------------- #
# Ajuste de superficies (entorno 3D)
# --------------------------------------------------------------------------- #
class SurfaceModel(str, Enum):
    """Modelos de superficie z = f(x, y) del entorno 3D.

    El 3D trabaja siempre con tres columnas (x, y, z) de puntos dispersos y
    **sin barras de error**: el objetivo es ver la forma de la superficie.
    """

    plane = "plane"            # z = a·x + b·y + c
    poly2d = "poly2d"          # z = Σ c_ij·x^i·y^j  con i+j ≤ grado
    gaussian2d = "gaussian2d"  # campana 2D con centro y anchuras propias
    custom = "custom"          # fórmula propia z = f(x, y)


class SurfaceFitRequest(BaseModel):
    """Petición de ajuste de superficie."""

    model: SurfaceModel
    x: list[float]
    y: list[float]
    z: list[float]

    # Grado del polinomio 2D (solo model == poly2d).
    degree: int = Field(2, ge=1, le=6)

    # Para model == custom: expresión en x e y, y nombres de parámetros.
    # Ej: expression="a*x**2 + b*y**2 + c", parameters=["a","b","c"].
    expression: Optional[str] = None
    parameters: Optional[list[str]] = None
    initial_guess: Optional[list[float]] = None

    # Resolución de la malla devuelta para dibujar la superficie (n×n).
    grid_points: int = Field(45, ge=5, le=150)


class SurfaceFitResponse(BaseModel):
    """Resultado del ajuste de superficie.

    Además de los parámetros devuelve la superficie ya evaluada en una malla
    regular, lista para el trace `surface` de Plotly.
    """

    model: SurfaceModel
    equation: str
    parameters: list[Parameter]
    r_squared: float
    adj_r_squared: Optional[float] = None
    rmse: float
    n_points: int
    dof: int
    # Malla de la superficie ajustada: grid_z[j][i] = f(grid_x[i], grid_y[j]).
    # Un None es un hueco (la fórmula no está definida ahí); Plotly lo respeta.
    grid_x: list[float]
    grid_y: list[float]
    grid_z: list[list[Optional[float]]]
    residuals: list[float]


# --------------------------------------------------------------------------- #
# Propagación de incertidumbres (entorno /incertidumbres)
# --------------------------------------------------------------------------- #
class Distribution(str, Enum):
    """Cómo se distribuye el error de una magnitud medida.

    - `normal`: la incertidumbre dada **es** la desviación típica σ. Es el caso
      de una serie de medidas repetidas.
    - `rectangular`: la incertidumbre dada es la **semiamplitud** a de un
      intervalo en el que el valor cae con igual probabilidad (resolución del
      instrumento, tolerancia). Su desviación típica es σ = a/√3 (GUM 4.3.7).
    """

    normal = "normal"
    rectangular = "rectangular"


class UncertainVariable(BaseModel):
    """Una magnitud medida con su incertidumbre."""

    name: str
    value: float
    uncertainty: float = Field(0.0, ge=0.0, description="σ, o semiamplitud a si es rectangular")
    distribution: Distribution = Distribution.normal


class PropagateRequest(BaseModel):
    """Petición de propagación para una medida indirecta única."""

    expression: str
    variables: list[UncertainVariable]
    monte_carlo: bool = True
    samples: int = Field(10000, ge=100, le=1_000_000)
    # Semilla fija => resultado reproducible. None = aleatorio en cada tirada.
    seed: Optional[int] = None
    confidence: float = Field(0.95, gt=0.0, lt=1.0)
    hist_bins: int = Field(48, ge=5, le=200)


class Contribution(BaseModel):
    """Cuánto aporta una variable a la incertidumbre total."""

    name: str
    value: float
    sigma: float               # σ efectiva (a/√3 si la distribución es rectangular)
    derivative: str            # ∂f/∂v en forma legible, derivada por SymPy
    derivative_value: float
    term: float                # |∂f/∂v|·σ, la aportación en unidades de z
    percent: float             # % de la varianza total σ²


class MonteCarloResult(BaseModel):
    """Resumen de la simulación Monte Carlo."""

    samples: int               # muestras válidas (las no finitas se descartan)
    requested: int
    mean: float
    std: float
    median: float
    p_low: float
    p_high: float
    confidence: float
    skewness: float            # ≈0 si la distribución de salida es simétrica
    hist_edges: list[float]
    hist_counts: list[int]


class PropagateResponse(BaseModel):
    """Resultado de propagar incertidumbres a z = f(...)."""

    expression: str
    value: float
    uncertainty: float                  # σ por la fórmula gaussiana analítica
    relative: Optional[float] = None    # σ/|z|, None si z = 0
    contributions: list[Contribution]
    mc: Optional[MonteCarloResult] = None


class TableVariable(BaseModel):
    """Una magnitud en modo tabla: una columna de valores (o una constante).

    Una lista de un solo elemento se difunde a todas las filas, así que una
    constante como g o la longitud de un hilo se escribe una sola vez.
    """

    name: str
    # Un hueco (celda vacía de la hoja) llega como null y sale como fila sin
    # resultado, en vez de invalidar toda la columna.
    values: list[Optional[float]]
    uncertainties: Optional[list[Optional[float]]] = None
    distribution: Distribution = Distribution.normal


class PropagateTableRequest(BaseModel):
    expression: str
    variables: list[TableVariable]


class PropagateTableResponse(BaseModel):
    """Columna calculada z con su incertidumbre propagada fila a fila.

    Un `None` es una fila donde la fórmula no está definida (por ejemplo un
    logaritmo de un valor negativo); el frontend la deja en blanco.
    """

    expression: str
    n_rows: int
    z: list[Optional[float]]
    sz: list[Optional[float]]
    derivatives: dict[str, str]


class FormulaSymbolsRequest(BaseModel):
    expression: str


class FormulaSymbolsResponse(BaseModel):
    symbols: list[str]


class ImportResponse(BaseModel):
    """Resultado de importar un CSV/TXT/XLSX."""

    columns: list[str]
    rows: list[list[Optional[float]]]
    n_rows: int
    n_cols: int
    # Roles sugeridos por la importación inteligente, alineados con `columns`.
    # Valores: '' | 'x' | 'y' | 'z' | 'ex' | 'ey' | 'ez'.
    roles: list[str] = []


class ErrorResponse(BaseModel):
    detail: str
