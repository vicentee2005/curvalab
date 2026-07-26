"""Genera ficheros Excel de ejemplo para probar los ajustes de CurvaLab.

Cada fichero tiene 4 columnas: x, y, error de x y error de y, con nombres de
cabecera que la importación inteligente reconoce sola (rol X / Y / ΔX / ΔY).
Los datos llevan ruido gaussiano reproducible (semilla fija) y las barras de
error son coherentes con ese ruido, como en una práctica real.

Uso:  venv/Scripts/python datos_ejemplo/generar_datos.py
"""
from pathlib import Path

import numpy as np
import pandas as pd

OUT = Path(__file__).parent
rng = np.random.default_rng(2026)


def guardar(nombre: str, df: pd.DataFrame, descripcion: str) -> None:
    ruta = OUT / nombre
    df.to_excel(ruta, index=False, engine="openpyxl")
    print(f"  {nombre:<28} {descripcion}")


# --------------------------------------------------------------------------- #
# 1. LINEAL — y = a·x + b     (valores reales: a = 2.5, b = 1.2)
# --------------------------------------------------------------------------- #
x = np.linspace(1.0, 20.0, 18)
sigma_y = 0.45
y = 2.5 * x + 1.2 + rng.normal(0, sigma_y, x.size)
guardar(
    "01_lineal.xlsx",
    pd.DataFrame({
        "Tiempo (s)": np.round(x, 3),
        "Voltaje (V)": np.round(y, 3),
        "error_x": np.round(np.full(x.size, 0.05), 3),
        "error_y": np.round(np.full(x.size, sigma_y), 3),
    }),
    "y = a·x + b        (a=2.5, b=1.2)",
)

# --------------------------------------------------------------------------- #
# 2. EXPONENCIAL — descarga de condensador: y = a·exp(b·x) + c
#    (valores reales: a = 10.0, b = -0.45, c = 0.5)
# --------------------------------------------------------------------------- #
x = np.linspace(0.0, 10.0, 22)
y_teo = 10.0 * np.exp(-0.45 * x) + 0.5
# Ruido algo mayor donde la señal es grande (típico de un voltímetro).
sigma = 0.03 + 0.02 * y_teo
y = y_teo + rng.normal(0, sigma)
guardar(
    "02_exponencial.xlsx",
    pd.DataFrame({
        "Tiempo (s)": np.round(x, 3),
        "Voltaje (V)": np.round(y, 4),
        "error_x": np.round(np.full(x.size, 0.02), 3),
        "error_y": np.round(sigma, 4),
    }),
    "y = a·exp(b·x) + c (a=10, b=-0.45, c=0.5)",
)

# --------------------------------------------------------------------------- #
# 3. LOGARÍTMICO — y = a·ln(x) + b   (valores reales: a = 12.0, b = 5.0)
#    Ojo: el ajuste logarítmico exige x > 0.
# --------------------------------------------------------------------------- #
x = np.geomspace(1.0, 60.0, 20)
sigma_y = 0.8
y = 12.0 * np.log(x) + 5.0 + rng.normal(0, sigma_y, x.size)
guardar(
    "03_logaritmico.xlsx",
    pd.DataFrame({
        "Distancia (m)": np.round(x, 3),
        "Intensidad (dB)": np.round(y, 3),
        "error_x": np.round(0.01 * x, 4),
        "error_y": np.round(np.full(x.size, sigma_y), 3),
    }),
    "y = a·ln(x) + b    (a=12, b=5)",
)

# --------------------------------------------------------------------------- #
# 4. SINUSOIDAL — para probar la FÓRMULA PROPIA  a*cos(k*x)
#    (valores reales: a = 3.2, k = 1.7)
# --------------------------------------------------------------------------- #
x = np.linspace(0.0, 7.0, 45)
sigma_y = 0.12
y = 3.2 * np.cos(1.7 * x) + rng.normal(0, sigma_y, x.size)
guardar(
    "04_sinusoidal.xlsx",
    pd.DataFrame({
        "Angulo (rad)": np.round(x, 4),
        "Amplitud (cm)": np.round(y, 4),
        "error_x": np.round(np.full(x.size, 0.005), 4),
        "error_y": np.round(np.full(x.size, sigma_y), 3),
    }),
    "y = a·cos(k·x)     (a=3.2, k=1.7)",
)

print("\nFicheros escritos en:", OUT)
