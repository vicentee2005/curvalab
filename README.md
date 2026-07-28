---
title: CurvaLab API
emoji: 📈
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

<!-- La cabecera de arriba la lee Hugging Face Spaces para construir el backend
     con el Dockerfile. En GitHub se ve como una tabla; no molesta a nadie. -->

# CurvaLab

Aplicación web de **ajuste de curvas y análisis de errores** de medidas de
laboratorio (equivalente moderno a SciDavis), con foco en visualidad y
facilidad de uso. La matemática del ajuste corre en Python (SciPy/NumPy) y las
gráficas 2D/3D en Plotly.

- **Frontend:** React + TypeScript + Vite, gráficas con **Plotly.js**.
- **Backend:** **FastAPI** con el motor de ajuste (**SciPy** `curve_fit`,
  polinomios con NumPy, fórmulas propias con **SymPy**). Sin estado, sin base de
  datos: guardar/abrir proyecto es un fichero JSON local.

## Un portal de aplicaciones

CurvaLab es un **portal**: una portada desde la que se entra a cada herramienta,
y cada herramienta es un espacio independiente con su propio enlace, su hoja de
datos, sus menús y su fichero de proyecto.

| Enlace | Aplicación | Qué hace |
|---|---|---|
| `/` | Portada | Elegir aplicación y ver si el motor de cálculo está en marcha |
| `/2d` | Ajuste de curvas | y = f(x) con barras de error en X e Y, χ²/ν |
| `/3d` | Superficies | z = f(x, y) sobre una escena girable, sin barras de error |
| `/incertidumbres` | Propagación de errores | σ de una magnitud indirecta, analítica y por Monte Carlo |

Solo comparten el aspecto visual, la hoja de cálculo y el motor de importación.
Lo único que viaja entre entornos es el botón **«Ajustar en 2D»** del entorno de
incertidumbres, que abre `/2d` con la columna calculada y su error ya puestos.

## Requisitos

- **Node.js** 18+ y **Python** 3.10+ (aquí se usa el Python de Anaconda).

## Puesta en marcha

### Opción rápida (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File start.ps1
```

Abre luego http://localhost:5173

### Manual

Backend:

```bash
cd backend
python -m venv venv
venv/Scripts/python -m pip install -r requirements.txt   # Windows
venv/Scripts/python -m uvicorn app.main:app --port 8000
```

Frontend (en otra terminal):

```bash
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API + documentación interactiva (Swagger): http://localhost:8000/docs

## Estructura

```
BestFit/
├─ backend/
│  ├─ app/
│  │  ├─ main.py       API (/api/fit, /api/fit-surface, /api/propagate, …)
│  │  ├─ schemas.py    Modelos Pydantic (contrato con el frontend)
│  │  ├─ fitting.py    Motor de ajuste 2D (SciPy/NumPy)
│  │  ├─ surface.py    Motor de ajuste de superficies 3D
│  │  ├─ uncertainty.py Propagación de errores: gaussiana y Monte Carlo
│  │  ├─ formula.py    Parseo y derivación de fórmulas propias (SymPy)
│  │  ├─ infer_roles.py Importación inteligente: deduce X/Y/Z y errores
│  │  └─ importer.py   Importación de CSV/TXT/XLSX (openpyxl + csv)
│  └─ tests/           Tests con pytest (casos de física real)
├─ datos_ejemplo/      Ficheros Excel de prueba (2D y 3D) + LEEME.md
└─ frontend/
   └─ src/
      ├─ main.tsx          Rutas: / (portada), /2d, /3d, /incertidumbres
      ├─ App.tsx           Entorno 2D: orquestación de estado y menús
      ├─ pages/            Home (portada), Surface3D y Uncertainty
      ├─ api.ts            Cliente del backend
      ├─ components/       Toolbar, PlotCard, DataSheet, Wizard, Tour, diálogos
      │                    y los del 3D: SurfaceCard, SurfacePlot, SurfaceResults…
      ├─ hooks/            useProject (columnas), useAppTheme (tema compartido)
      └─ lib/              Extracción de datos por rol, formateo, portapapeles
```

## Modelos de ajuste 2D (`/2d`)

| Modelo | Ecuación | Notas |
|--------|----------|-------|
| Lineal | y = a·x + b | mínimos cuadrados |
| Polinómico | y = c₀ + c₁·x + … + cₙ·xⁿ | grado configurable |
| Exponencial | y = a·exp(b·x) + c | |
| Logarítmico | y = a·ln(x) + b | requiere x > 0 |
| Potencial | y = a·xᵇ | requiere x > 0 |
| Fórmula propia | la que escriba el usuario | vía SymPy, sin `eval` |

Si hay columnas de **error en Y** se hace mínimos cuadrados **ponderados** y se
reportan **χ²** y **χ²/ν**. Para cada ajuste se devuelven parámetros con su
incertidumbre (raíz de la diagonal de la covarianza), **R²**, R² ajustado y RMSE.

## Modelos de superficie 3D (`/3d`)

Los datos son **tres columnas** (x, y, z) de puntos dispersos: no hace falta que
estén en rejilla.

| Modelo | Ecuación | Notas |
|--------|----------|-------|
| Plano | z = a·x + b·y + c | lineal, solución exacta |
| Polinómico 2D | z = Σ c<sub>ij</sub>·xⁱ·yʲ con i+j ≤ n | lineal, grado 1–6 |
| Gaussiana 2D | z = A·exp(−((x−x₀)²/2σx² + (y−y₀)²/2σy²)) + c | multi-arranque |
| Fórmula propia | la que escriba el usuario, con x e y | vía SymPy, sin `eval` |

La escena se gira arrastrando, se acerca con la rueda y se desplaza con el botón
derecho. **La imagen PNG se exporta con la perspectiva que estés viendo en ese
momento**: la cámara se conserva aunque se reajuste el modelo o se cambien
colores. El menú *Vista* trae además planta, alzado y perfil.

Si la incertidumbre de un parámetro supera su propio valor, el panel de
resultados lo avisa: el modelo no está determinado por los datos aunque el R²
salga alto.

Los dos entornos comparten la misma ayuda: **asistente** flotante de cuatro
pasos, **consejos** contextuales bajo la hoja de datos y **guía de inicio
rápido** (menú *Ayuda*) que resalta cada zona. Los textos están adaptados a cada
entorno — en el 3D no se habla de barras de error y sí de girar la escena.

## Propagación de incertidumbres (`/incertidumbres`)

Para cuando lo que quieres no se mide: se calcula a partir de otras medidas que
sí tienen error. Escribes la fórmula y la aplicación hace el resto.

**1. Fórmula gaussiana, con derivadas simbólicas.** SymPy deriva la expresión
respecto de cada variable y se aplica

```
σ_z = √[ Σ (∂f/∂v_i · σ_i)² ]
```

suponiendo las medidas **independientes**. No hay que derivar nada a mano: las
derivadas aparecen escritas en el resultado, junto con el reparto de la varianza
(qué medida conviene afinar para bajar el error).

**2. Monte Carlo.** Se sortean hasta 500 000 juegos de valores según la
distribución de cada variable y se evalúa la fórmula en todos. No supone que f
sea lineal, así que sirve de comprobación: si las dos σ no coinciden, la buena
es la de la simulación, y la app lo dice. También avisa cuando la distribución
de salida sale asimétrica y «valor ± σ» se queda corto.

Cada variable puede ser **normal** (la incertidumbre es σ, de medidas repetidas)
o **rectangular** (la incertidumbre es la semiamplitud a de la resolución del
instrumento, σ = a/√3, como en la GUM).

Dos formas de trabajar:

- **Medida única:** un valor por magnitud. El caso clásico de la práctica.
- **Por filas:** cada variable se engancha a una columna de la hoja y se obtiene
  un resultado por fila. Una variable sin columna es una constante. El resultado
  se puede volcar a la hoja o mandar al entorno 2D para ajustarlo.

## Datos de ejemplo

En `datos_ejemplo/` hay ocho ficheros Excel con parámetros conocidos (cuatro
para el 2D y cuatro para el 3D) y un `LEEME.md` con los resultados esperados.

## Tests

```bash
cd backend
venv/Scripts/python -m pytest
```

## Despliegue: dos piezas en dos sitios

El frontend y el backend se despliegan **por separado**, y no por gusto
arquitectónico sino por una restricción medida:

| Pieza | Dónde | Por qué ahí |
|---|---|---|
| Frontend (sitio estático) | **Vercel** | Es lo que mejor hace: CDN, HTTPS y despliegue por cada push |
| Backend (FastAPI) | **Hugging Face Spaces** (Docker) | Una imagen Docker no tiene el límite de tamaño de una función serverless |

**El intento fallido, que es la parte interesante.** Primero se metió todo en
Vercel, con el backend como función serverless. No cabe:

| Intento | Tamaño del bundle | Límite |
|---|---|---|
| numpy + scipy + sympy + pandas | ~305 MB | 225 MB |
| Sin pandas, CPython 3.14 (numpy 2.5, scipy 1.18) | 258 MB | 225 MB |
| Sin pandas, CPython 3.12 (numpy 2.2, scipy 1.16) | 242 MB | 225 MB |

Quitar pandas ahorró unos 65 MB y bajar de Python 3.14 a 3.12 otros 17, pero
seguían sobrando 17 MB. SciPy y SymPy son el producto —el motor de ajuste y la
derivación simbólica— así que la que sobraba era la restricción, no la
dependencia. El backend se fue a una imagen Docker.

Lo que sí se quedó de aquel intento: **el importador ya no usa pandas**. Se
reescribió con `openpyxl` y el módulo `csv` de la biblioteca estándar, con los
mismos tests en verde y un mensaje claro cuando le das un `.xls` antiguo. Solo
los generadores de `datos_ejemplo/` siguen usando pandas, y esos no se
despliegan.

Piezas del despliegue:

| Fichero | Para qué |
|---|---|
| `vercel.json` | Compila `frontend/` y hace el fallback SPA de `/2d`, `/3d`, `/incertidumbres` |
| `package.json` (raíz) | `npm run build` → compila el frontend |
| `Dockerfile` | Imagen del backend: instala `requirements.txt` y arranca uvicorn en el puerto 7860 |
| `requirements.txt` (raíz) | Dependencias del backend desplegado (sin pandas ni pytest) |

**Cómo se encuentran los dos.** El frontend lee la URL del backend de la
variable `VITE_API_BASE`, que se define en Vercel y se incrusta al compilar. El
backend acepta peticiones del dominio de Vercel mediante CORS, con una
expresión regular que cubre también las URLs de vista previa; `CURVALAB_ORIGINS`
permite añadir orígenes extra sin tocar el código.

> **Privacidad:** en la versión desplegada los números que escribes viajan al
> backend para calcularse. No hay cuentas ni base de datos y no se guarda nada,
> pero la promesa de «los datos no salen de tu ordenador» solo vale
> ejecutándolo en local. La portada lo dice según dónde se esté ejecutando.

## Hoja de ruta

- **v1:** ajuste 2D completo + importación + guardar/abrir proyecto +
  exportar gráfica PNG + asistente y guía de inicio.
- **v2:** portada con dos entornos y ajuste de superficies 3D.
- **v3 (actual):** portal de aplicaciones y propagación de incertidumbres
  (derivación simbólica + Monte Carlo), con traspaso de resultados al 2D.
- **Pendiente:** estadísticas descriptivas, interpolación, correlaciones entre
  variables en la propagación y un ajuste tipo ODR que también pondere con el
  error en X.
