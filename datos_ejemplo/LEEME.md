# Datos de ejemplo para probar CurvaLab

Nueve ficheros Excel con datos sintéticos (ruido gaussiano, semilla fija):
**01–04 para el entorno 2D** (`/2d`), **05–08 para el de superficies** (`/3d`)
y **09 para el de incertidumbres** (`/incertidumbres`). Las cabeceras están
puestas para que la **importación inteligente** asigne sola los roles.

---

# Entorno 2D — ajuste de curvas

Los cuatro primeros llevan barras de error coherentes: la importación asigna
X, Y, ΔX y ΔY.

Se cargan con **Archivo → Importar CSV / TXT / Excel**.

| Fichero | Ajuste a usar | Modelo | Valores reales |
|---|---|---|---|
| `01_lineal.xlsx` | Análisis → Ajuste lineal | y = a·x + b | a = 2.5, b = 1.2 |
| `02_exponencial.xlsx` | Análisis → Ajuste exponencial | y = a·exp(b·x) + c | a = 10, b = −0.45, c = 0.5 |
| `03_logaritmico.xlsx` | Análisis → Ajuste logarítmico | y = a·ln(x) + b | a = 12, b = 5 |
| `04_sinusoidal.xlsx` | Análisis → Ajuste no lineal (fórmula propia) | y = a·cos(k·x) | a = 3.2, k = 1.7 |

## El caso de la fórmula propia (`04_sinusoidal.xlsx`)

En el diálogo de **Ajuste no lineal (fórmula propia)** escribe:

- **Fórmula:** `a*cos(k*x)`
- **Parámetros:** `a, k`

No hace falta indicar estimación inicial: la app estima la frecuencia por FFT y
prueba varios puntos de partida (multi-arranque) hasta dar con el mejor ajuste.

> Ojo con la **fase**: un modelo como `a*sin(b*x)` no puede ajustar estos datos
> por mucho que se optimice, porque empiezan en un máximo y `sin(0) = 0`. No es
> un fallo del ajuste, es que al modelo le falta el término de fase. Usa
> `a*cos(k*x)` o `a*sin(b*x + c)`. La app te avisa de esto al escribir la fórmula.

## Resultados esperados (ya comprobados)

Todos recuperan los parámetros dentro de su incertidumbre, con χ²/ν ≈ 1 (señal
de que las barras de error son consistentes con la dispersión):

- Lineal: a = 2.507 ± 0.018, b = 1.12 ± 0.22 · R² = 0.9996 · χ²/ν = 0.53
- Exponencial: a = 9.88 ± 0.14, b = −0.4433 ± 0.0084, c = 0.498 ± 0.026 · R² = 0.9992
- Logarítmico: a = 11.95 ± 0.14, b = 5.58 ± 0.34 · R² = 0.9962
- Sinusoidal: a = 3.197 ± 0.026, k = 1.7020 ± 0.0019 · R² = 0.9968

## Nota sobre el error en X

La columna ΔX se importa y **se dibuja** como barras de error horizontales en la
gráfica, pero el ajuste **solo pondera con ΔY** (es lo que hace
`scipy.optimize.curve_fit`). Un ajuste que tenga en cuenta el error en ambos
ejes (tipo ODR / mínimos cuadrados totales) sería una mejora para más adelante.

---

# Entorno 3D — ajuste de superficies

Estos cuatro tienen **solo tres columnas** (x, y, z) porque el entorno 3D
trabaja sin barras de error. Los 260 puntos de cada uno están **dispersos, no
en rejilla**, a propósito: el ajuste no la necesita.

Se cargan igual, con **Archivo → Importar CSV / TXT / Excel**, y después hay que
pulsar **Crear gráfica** en la pestaña *Gráfica*.

| Fichero | Ajuste a usar | Valores reales |
|---|---|---|
| `05_plano.xlsx` | Análisis → Plano | a = 2.5, b = −1.4, c = 3 |
| `06_paraboloide.xlsx` | Análisis → Superficie polinómica (grado 2) | c00=1, c10=0.5, c01=−0.3, c20=0.8, c11=0.2, c02=−0.6 |
| `07_gaussiana.xlsx` | Análisis → Gaussiana 2D | A=8, x₀=1.5, y₀=−2, σx=1.2, σy=0.9, c=0.5 |
| `08_silla.xlsx` | Análisis → Fórmula propia | a = 1.2, b = −0.8 |

Para la silla de montar, en el diálogo de fórmula propia escribe:

- **Fórmula:** `a*x**2 + b*y**2`
- **Parámetros:** `a, b`

## Resultados esperados en 3D (ya comprobados)

- Plano: a = 2.514, b = −1.393, c = 3.016 · R² = 0.998
- Paraboloide: c00 = 0.979, c10 = 0.507, c01 = −0.296, c20 = 0.797, c11 = 0.197, c02 = −0.607 · R² = 0.995
- Gaussiana: A = 8.025, x₀ = 1.499, y₀ = −1.999, σx = 1.200, σy = 0.898, c = 0.500 · R² = 0.998
- Silla: a = 1.199, b = −0.796 · R² = 0.998

> La gaussiana converge **sin estimación inicial**: se prueban varios arranques
> partiendo del máximo y del mínimo de los datos.

## Una prueba interesante

Ajusta una **gaussiana** a `05_plano.xlsx`. Saldrá un R² altísimo (una campana
enorme y lejana se parece a un plano en una región pequeña), pero todas las
incertidumbres serán mayores que sus propios valores y la app te avisará de
ello. Es un buen recordatorio de que un R² alto no valida un modelo.

---

# Entorno de incertidumbres

Este entorno arranca ya con un **péndulo simple** medido a seis longitudes
(columnas `L`, `σL`, `T`, `σT`), así que para una primera prueba no hace falta
importar nada.

**Medida única.** Fórmula `4*pi**2*L/T**2` con L = 1.000 ± 0.001 m y
T = 2.006 ± 0.004 s:

- g = 9.811 ± 0.040 m/s² (0.41 % de error relativo)
- El período aporta el **94 %** del error y la longitud solo el 6 %: entra al
  cuadrado, así que medirlo mejor es lo que más rebaja la incertidumbre.
- Monte Carlo da σ = 0.0401 frente a 0.0403 de la fórmula: coinciden, la
  fórmula es lineal en ±σ.

**Por filas.** Engancha L → `L (m)`, su error → `σL (m)`, T → `T (s)`, su error
→ `σT (s)` y pulsa *Propagar el error*: sale una g por fila, con el error
relativo cayendo del 1.02 % al 0.37 % conforme el péndulo se alarga. Con
*Ajustar en 2D* se abre el entorno de curvas con `g ± σg` listo: el ajuste
lineal da pendiente 0.011 ± 0.068 (compatible con cero, como debe ser: g no
depende de L) y ordenada 9.79 ± 0.06.

## Propagación por columnas con fichero (`09_densidad_cilindros.xlsx`)

Ocho cilindros de aluminio torneados a distintos tamaños. De cada uno se ha
medido la masa con una balanza de 0.01 g y el diámetro y la altura con un
calibre de 0.005 cm, para calcular la densidad:

    ρ = 4·m / (π·D²·h)

Frente a la tabla del péndulo que ya viene cargada, aquí hay **tres** magnitudes
con error en vez de dos, así que el reparto de contribuciones tiene más que
contar.

**Cómo usarlo:**

1. `Archivo → Importar CSV / TXT / Excel` → `09_densidad_cilindros.xlsx`.
   Al importar, el entorno pasa solo a modo **Por filas**.
2. Escribe la fórmula: `4*m/(pi*D**2*h)`. Las variables `m`, `D` y `h` aparecen
   solas en la tabla de abajo.
3. Engancha cada una a sus dos columnas:

   | Variable | Valor | Error |
   |---|---|---|
   | `m` | `m (g)` | `σm (g)` |
   | `D` | `D (cm)` | `σD (cm)` |
   | `h` | `h (cm)` | `σh (cm)` |

4. `Cálculo → Propagar el error`.

**Resultados esperados (comprobados sobre la web desplegada):**

| Fila | ρ (g/cm³) | σρ | Error relativo |
|---|---|---|---|
| 1 (el más pequeño) | 2.721 | 0.038 | 1.39 % |
| 2 | 2.702 | 0.029 | 1.06 % |
| 3 | 2.735 | 0.024 | 0.87 % |
| 4 | 2.670 | 0.018 | 0.69 % |
| 5 | 2.691 | 0.015 | 0.57 % |
| 6 | 2.703 | 0.014 | 0.51 % |
| 7 | 2.705 | 0.013 | 0.47 % |
| 8 (el más grande) | 2.697 | 0.011 | 0.41 % |

Las ocho filas son compatibles con el aluminio (ρ = 2.70 g/cm³): la desviación
mayor es de 1.7 σ y la media cuadrática, 0.85 σ. El error relativo se reduce a
la tercera parte del cilindro pequeño al grande, aunque el calibre sea el mismo:
lo que importa no es el error absoluto sino cuánto vale frente a lo medido.

**Lo que enseña el desglose.** Pon la primera fila en modo *Medida única* y mira
las contribuciones: **D aporta el 82 %** del error, la masa el 13 % y la altura
el 6 %. El diámetro entra al cuadrado, así que su error pesa el doble; medir
mejor el diámetro es lo único que rebaja de verdad la incertidumbre. Es la misma
lección que el período en el péndulo.

> Al importar, la asignación automática de roles marca `m` como X y `D` como Y.
> Aquí da igual —en este entorno cada variable se engancha a mano desde su
> desplegable— pero conviene revisarlos si luego usas *Ajustar en 2D*.

## Una prueba interesante

Pon la fórmula `x**2` con x = 1 ± 0.5. La fórmula analítica da σ = 1.0, pero la
simulación da 1.04 y una **asimetría de 1.3**: con una incertidumbre tan grande
frente al valor, la salida ya no es una campana y escribir «1.0 ± 1.0» engaña.
El intervalo del 95 % (0.01 … 3.91) cuenta mucho mejor lo que pasa. La app avisa
de ello.

---

## Regenerar los ficheros

```bash
backend/venv/Scripts/python datos_ejemplo/generar_datos.py
```

```bash
backend/venv/Scripts/python datos_ejemplo/generar_datos_3d.py
```

```bash
backend/venv/Scripts/python datos_ejemplo/generar_datos_incertidumbres.py
```
