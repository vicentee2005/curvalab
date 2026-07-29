"""Genera el Excel de ejemplo del entorno de incertidumbres (propagación por columnas).

Simula una práctica real: ocho cilindros de aluminio torneados a distintos
tamaños, de los que se mide masa (balanza), diámetro y altura (calibre) para
calcular la densidad

    rho = 4·m / (pi·D²·h)

Cada fila es una pieza, así que la propagación se hace *por columnas*: cada
magnitud se engancha a su columna de valores y a su columna de error.

Dos cosas hacen interesante este fichero frente a la tabla del péndulo que ya
viene cargada en la app:

- Son **tres** magnitudes con error, no dos, así que el reparto de
  contribuciones tiene más que contar.
- Las piezas pequeñas se miden igual de bien en valor absoluto pero mucho peor
  en valor relativo, así que el error relativo de rho cae al crecer el cilindro.

Los errores son los de los aparatos, no ruido inventado: calibre de 0.005 cm y
balanza de 0.01 g. Los valores medidos se generan a partir de esos mismos
errores, de forma que la densidad recuperada es compatible con la real.

Sin pandas a propósito (igual que el backend): openpyxl basta para escribir
una hoja de ocho filas.

Uso:
    backend/venv/Scripts/python datos_ejemplo/generar_datos_incertidumbres.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from openpyxl import Workbook

AQUI = Path(__file__).parent

RHO = 2.70  # densidad del aluminio, g/cm³
SIGMA_D = 0.005  # calibre, cm
SIGMA_H = 0.005  # calibre, cm
SIGMA_M = 0.01  # balanza, g

# Cilindros nominales: del más pequeño al más grande.
D_NOMINAL = [0.80, 1.00, 1.20, 1.50, 1.80, 2.00, 2.20, 2.50]
H_NOMINAL = [1.50, 2.00, 2.50, 3.00, 4.00, 4.50, 5.00, 6.00]


def main() -> None:
    rng = np.random.default_rng(2026)

    # Dimensiones verdaderas de las piezas: nadie las conoce, pero son las que
    # fijan su masa.
    d_ver = np.array(D_NOMINAL)
    h_ver = np.array(H_NOMINAL)

    # Lo que marca cada aparato: el valor verdadero más su error de medida,
    # redondeado a la resolución del instrumento.
    #
    # La masa sale de las dimensiones VERDADERAS, no de las medidas. Es la
    # diferencia entre unos datos realistas y unos datos trucados: si se
    # calculara desde d_med y h_med, los errores del calibre se cancelarían al
    # recalcular la densidad y la dispersión saldría mucho menor que las barras
    # de error, que es justo lo que no pasa en un laboratorio.
    d_med = np.round(d_ver + rng.normal(0, SIGMA_D, d_ver.size), 3)
    h_med = np.round(h_ver + rng.normal(0, SIGMA_H, h_ver.size), 3)
    m_ver = RHO * np.pi * d_ver**2 * h_ver / 4
    m_med = np.round(m_ver + rng.normal(0, SIGMA_M, m_ver.size), 2)

    libro = Workbook()
    hoja = libro.active
    hoja.title = "cilindros"
    hoja.append(["m (g)", "σm (g)", "D (cm)", "σD (cm)", "h (cm)", "σh (cm)"])
    for m, d, h in zip(m_med, d_med, h_med):
        hoja.append([float(m), SIGMA_M, float(d), SIGMA_D, float(h), SIGMA_H])

    ruta = AQUI / "09_densidad_cilindros.xlsx"
    libro.save(ruta)
    print(f"  09_densidad_cilindros.xlsx  ({len(D_NOMINAL)} cilindros)")

    # Referencia por consola: qué densidad debería salir en cada fila.
    rho = 4 * m_med / (np.pi * d_med**2 * h_med)
    rel = np.sqrt(
        (SIGMA_M / m_med) ** 2
        + (2 * SIGMA_D / d_med) ** 2
        + (SIGMA_H / h_med) ** 2
    )
    print("\n  fila   rho (g/cm³)   sigma      rel.    desviación")
    for i, (r, e) in enumerate(zip(rho, rho * rel), start=1):
        print(f"   {i}     {r:8.4f}    {e:7.4f}   {100 * e / r:5.2f} %"
              f"   {abs(r - RHO) / e:4.2f} σ")
    # Con datos honestos, las desviaciones deben repartirse alrededor de 1 σ.
    print(f"\n  desviación cuadrática media: "
          f"{np.sqrt(np.mean(((rho - RHO) / (rho * rel)) ** 2)):.2f} σ  (debe rondar 1)")


if __name__ == "__main__":
    print("Generando datos de ejemplo de incertidumbres…")
    main()
    print("Listo.")
