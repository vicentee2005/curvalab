// Tipos compartidos del frontend de CurvaLab.

export type Role = '' | 'x' | 'y' | 'z' | 'ex' | 'ey' | 'ez';

export interface Column {
  id: string;          // id estable para React keys
  name: string;        // nombre editable = leyenda del gráfico
  role: Role;
  color: string;
  values: string[];    // valores como texto (edición libre en celdas)
}

export type Dimension = '2d' | '3d';

/** Qué muestra la tarjeta central: el panel de configuración o la gráfica. */
export type PlotView = 'config' | 'plot';

/** Tipo de representación elegido en la pestaña "Gráfica". */
export type ChartType = 'scatter' | 'lines' | 'lines+markers' | 'bars';

export interface ChartConfig {
  type: ChartType;
  /** Etiquetas de los ejes. Vacío = usar el nombre de la columna. */
  xLabel: string;
  yLabel: string;
  zLabel: string;
  /** Título de la gráfica. Vacío = "{Y} frente a {X}". */
  title: string;
  showGrid: boolean;
  showLegend: boolean;
  /** Leyenda de la serie de datos. Vacío = nombre de la columna Y. */
  seriesName: string;
}

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  type: 'scatter',
  xLabel: '',
  yLabel: '',
  zLabel: '',
  title: '',
  showGrid: true,
  showLegend: true,
  seriesName: '',
};
export type Theme = 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

export type FitModelId =
  | 'linear'
  | 'polynomial'
  | 'exponential'
  | 'logarithmic'
  | 'power'
  | 'custom';

export interface FitRequest {
  model: FitModelId;
  x: number[];
  y: number[];
  sy?: number[] | null;
  sx?: number[] | null;
  degree?: number;
  expression?: string | null;
  parameters?: string[] | null;
  initial_guess?: number[] | null;
  curve_points?: number;
}

export interface FitParameter {
  name: string;
  value: number;
  stderr: number | null;
}

export interface FitResult {
  model: FitModelId;
  equation: string;
  parameters: FitParameter[];
  r_squared: number;
  adj_r_squared: number | null;
  chi_squared: number | null;
  reduced_chi_squared: number | null;
  rmse: number;
  n_points: number;
  dof: number;
  curve_x: number[];
  curve_y: number[];
  residuals: number[];
}

// --------------------------------------------------------------------------- //
// Entorno 3D: ajuste de superficies z = f(x, y)
// --------------------------------------------------------------------------- //

export type SurfaceModelId = 'plane' | 'poly2d' | 'gaussian2d' | 'custom';

export interface SurfaceFitRequest {
  model: SurfaceModelId;
  x: number[];
  y: number[];
  z: number[];
  degree?: number;
  expression?: string | null;
  parameters?: string[] | null;
  initial_guess?: number[] | null;
  grid_points?: number;
}

export interface SurfaceFitResult {
  model: SurfaceModelId;
  equation: string;
  parameters: FitParameter[];
  r_squared: number;
  adj_r_squared: number | null;
  rmse: number;
  n_points: number;
  dof: number;
  /** Malla de la superficie: grid_z[j][i] = f(grid_x[i], grid_y[j]). */
  grid_x: number[];
  grid_y: number[];
  grid_z: (number | null)[][];
  residuals: number[];
}

/** Cómo se colorean los puntos medidos en la nube 3D. */
export type PointStyle3D = 'accent' | 'byZ';

export interface Surface3DConfig {
  /** Etiquetas de los ejes. Vacío = nombre de la columna. */
  xLabel: string;
  yLabel: string;
  zLabel: string;
  /** Título. Vacío = "{Z} frente a {X} e {Y}". */
  title: string;
  /** Escala de color de la superficie ajustada. */
  colorscale: string;
  pointStyle: PointStyle3D;
  pointSize: number;
  /** Opacidad de la superficie (0–1) para poder ver los puntos a través. */
  surfaceOpacity: number;
  showGrid: boolean;
  showColorbar: boolean;
}

export const DEFAULT_SURFACE_CONFIG: Surface3DConfig = {
  xLabel: '',
  yLabel: '',
  zLabel: '',
  title: '',
  colorscale: 'Viridis',
  pointStyle: 'accent',
  pointSize: 3,
  surfaceOpacity: 0.85,
  showGrid: true,
  showColorbar: true,
};

/** Cámara de la escena 3D: se conserva para que la perspectiva no se pierda
 *  al redibujar, y es la que se exporta en la imagen PNG. */
export interface Camera3D {
  eye: { x: number; y: number; z: number };
  up?: { x: number; y: number; z: number };
  center?: { x: number; y: number; z: number };
}

/** Proyecto guardado del entorno 3D (menú Archivo > Guardar). */
export interface Surface3DProjectFile {
  version: 1;
  app: 'CurvaLab3D';
  columns: Column[];
  accent: string;
  theme: Theme;
  savedAt: string;
  config?: Surface3DConfig;
  created?: boolean;
  camera?: Camera3D | null;
}

// --------------------------------------------------------------------------- //
// Entorno de propagación de incertidumbres
// --------------------------------------------------------------------------- //

/** Cómo se distribuye el error de una magnitud.
 *  `normal`: la incertidumbre es σ. `rectangular`: es la semiamplitud a de un
 *  intervalo equiprobable (resolución del instrumento) y σ = a/√3. */
export type Distribution = 'normal' | 'rectangular';

export interface UncertainVariable {
  /** id estable para React; no se envía al backend. */
  id: string;
  name: string;
  value: string;         // texto libre: se convierte al enviar
  uncertainty: string;
  distribution: Distribution;
  /** Descripción opcional del usuario ("longitud del hilo"). */
  note: string;
}

export interface PropagateRequest {
  expression: string;
  variables: {
    name: string;
    value: number;
    uncertainty: number;
    distribution: Distribution;
  }[];
  monte_carlo?: boolean;
  samples?: number;
  seed?: number | null;
  confidence?: number;
  hist_bins?: number;
}

export interface Contribution {
  name: string;
  value: number;
  sigma: number;
  /** ∂f/∂v tal como la ha derivado SymPy. */
  derivative: string;
  derivative_value: number;
  term: number;
  percent: number;
}

export interface MonteCarloResult {
  samples: number;
  requested: number;
  mean: number;
  std: number;
  median: number;
  p_low: number;
  p_high: number;
  confidence: number;
  skewness: number;
  hist_edges: number[];
  hist_counts: number[];
}

export interface PropagateResult {
  expression: string;
  value: number;
  uncertainty: number;
  relative: number | null;
  contributions: Contribution[];
  mc: MonteCarloResult | null;
}

export interface PropagateTableRequest {
  expression: string;
  variables: {
    name: string;
    /** Un hueco (celda vacía) va como null y sale como fila sin resultado. */
    values: (number | null)[];
    uncertainties?: (number | null)[] | null;
    distribution: Distribution;
  }[];
}

export interface PropagateTableResult {
  expression: string;
  n_rows: number;
  z: (number | null)[];
  sz: (number | null)[];
  derivatives: Record<string, string>;
}

/** Modo de trabajo del entorno de incertidumbres. */
export type UncertaintyMode = 'single' | 'table';

/** A qué se engancha una variable en modo tabla. */
export interface TableBinding {
  /** id de la columna con los valores, o '' si es una constante. */
  valueColumn: string;
  /** id de la columna con la incertidumbre, o '' si es un valor fijo. */
  errorColumn: string;
}

/** Proyecto guardado del entorno de incertidumbres. */
export interface UncertaintyProjectFile {
  version: 1;
  app: 'CurvaLabU';
  expression: string;
  variables: UncertainVariable[];
  bindings: Record<string, TableBinding>;
  mode: UncertaintyMode;
  columns: Column[];
  accent: string;
  theme: Theme;
  savedAt: string;
  samples?: number;
}

/** Datos que un entorno deja preparados para otro (p. ej. la columna z ± σz
 *  calculada aquí y ajustada en el entorno 2D). */
export interface Handoff {
  from: string;
  columns: Column[];
  note?: string;
}

export const HANDOFF_KEY = 'curvalab.handoff';

export interface ImportResult {
  columns: string[];
  rows: (number | null)[][];
  n_rows: number;
  n_cols: number;
  roles?: string[]; // roles sugeridos por la importación inteligente
}

// Estructura de un proyecto guardado (JSON local, menú Archivo > Guardar).
export interface ProjectFile {
  version: 1;
  app: 'CurvaLab';
  columns: Column[];
  dimension: Dimension;
  accent: string;
  theme: Theme;
  savedAt: string;
  /** Configuración de la gráfica (opcional: los proyectos antiguos no la traen). */
  chartConfig?: ChartConfig;
  chartCreated?: boolean;
}
