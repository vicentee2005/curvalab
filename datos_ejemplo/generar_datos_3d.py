"""Genera los ficheros Excel de ejemplo del entorno 3D (ajuste de superficies).

Cada fichero tiene exactamente tres columnas — x, y, z — porque el entorno 3D
trabaja con puntos dispersos y sin barras de error. Los puntos NO están en
rejilla a propósito: así se ve que el ajuste no la necesita.

Uso:
    backend/venv/Scripts/python datos_ejemplo/generar_datos_3d.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

AQUI = Path(__file__).parent
N = 260  # puntos por fichero


def puntos(rng: np.random.Generator, lo: float = -5.0, hi: float = 5.0):
    """Nube de puntos dispersos en el cuadrado [lo, hi] × [lo, hi]."""
    return rng.uniform(lo, hi, N), rng.uniform(lo, hi, N)


def guardar(nombre: str, x, y, z, unidad_z: str) -> None:
    df = pd.DataFrame({"x (m)": x, "y (m)": y, f"z ({unidad_z})": z})
    ruta = AQUI / nombre
    df.to_excel(ruta, index=False)
    print(f"  {nombre}  ({len(df)} puntos)")


def main() -> None:
    rng = np.random.default_rng(2026)

    # 05 — Plano inclinado: z = 2.5·x − 1.4·y + 3
    x, y = puntos(rng)
    z = 2.5 * x - 1.4 * y + 3.0 + rng.normal(0, 0.35, N)
    guardar("05_plano.xlsx", x, y, z, "V")

    # 06 — Paraboloide: z = 1 + 0.5x − 0.3y + 0.8x² + 0.2xy − 0.6y²
    x, y = puntos(rng)
    z = (
        1.0 + 0.5 * x - 0.3 * y + 0.8 * x**2 + 0.2 * x * y - 0.6 * y**2
        + rng.normal(0, 0.6, N)
    )
    guardar("06_paraboloide.xlsx", x, y, z, "u.a.")

    # 07 — Campana 2D: pico de 8 unidades centrado en (1.5, −2)
    x, y = puntos(rng)
    z = (
        8.0
        * np.exp(-(((x - 1.5) ** 2) / (2 * 1.2**2) + ((y + 2.0) ** 2) / (2 * 0.9**2)))
        + 0.5
        + rng.normal(0, 0.05, N)
    )
    guardar("07_gaussiana.xlsx", x, y, z, "mW")

    # 08 — Silla de montar: z = 1.2·x² − 0.8·y², para la fórmula propia
    x, y = puntos(rng)
    z = 1.2 * x**2 - 0.8 * y**2 + rng.normal(0, 0.4, N)
    guardar("08_silla.xlsx", x, y, z, "u.a.")


if __name__ == "__main__":
    print("Generando datos de ejemplo 3D…")
    main()
    print("Listo.")
