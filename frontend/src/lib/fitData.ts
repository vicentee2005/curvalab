// Extrae de las columnas de la hoja de datos los arrays alineados (x, y, σ)
// según los roles asignados, listos para enviar al backend.
import type { Column, FitRequest, FitModelId } from '../types';

export interface ExtractError {
  message: string;
}

export interface ExtractedData {
  x: number[];
  y: number[];
  sy: number[] | null;
  sx: number[] | null;
  z: number[] | null;
  n: number;
}

function firstColByRole(columns: Column[], role: string): Column | undefined {
  return columns.find((c) => c.role === role);
}

function parseCol(col: Column | undefined, upto: number): (number | null)[] {
  if (!col) return Array(upto).fill(null);
  const out: (number | null)[] = [];
  for (let i = 0; i < upto; i++) {
    const raw = (col.values[i] ?? '').trim().replace(',', '.');
    if (raw === '') {
      out.push(null);
    } else {
      const v = Number(raw);
      out.push(Number.isFinite(v) ? v : null);
    }
  }
  return out;
}

/**
 * Reúne los datos numéricos para un ajuste 2D a partir de las columnas con rol
 * X e Y (y opcionalmente errores). Descarta filas donde falte X o Y.
 */
export function extractFitData(columns: Column[]): ExtractedData | ExtractError {
  const xCol = firstColByRole(columns, 'x');
  const yCol = firstColByRole(columns, 'y');
  if (!xCol) return { message: 'Asigna el rol X a una columna.' };
  if (!yCol) return { message: 'Asigna el rol Y a una columna.' };

  const maxLen = Math.max(
    xCol.values.length,
    yCol.values.length,
    firstColByRole(columns, 'ey')?.values.length ?? 0,
    firstColByRole(columns, 'ex')?.values.length ?? 0,
    firstColByRole(columns, 'z')?.values.length ?? 0,
  );

  const xr = parseCol(xCol, maxLen);
  const yr = parseCol(yCol, maxLen);
  const eyr = parseCol(firstColByRole(columns, 'ey'), maxLen);
  const exr = parseCol(firstColByRole(columns, 'ex'), maxLen);
  const zr = parseCol(firstColByRole(columns, 'z'), maxLen);

  const x: number[] = [];
  const y: number[] = [];
  const sy: number[] = [];
  const sx: number[] = [];
  const z: number[] = [];
  let hasSy = false;
  let hasSx = false;
  let hasZ = false;

  for (let i = 0; i < maxLen; i++) {
    if (xr[i] == null || yr[i] == null) continue;
    x.push(xr[i] as number);
    y.push(yr[i] as number);
    if (eyr[i] != null && (eyr[i] as number) > 0) {
      sy.push(eyr[i] as number);
      hasSy = true;
    } else {
      sy.push(NaN);
    }
    if (exr[i] != null && (exr[i] as number) > 0) {
      sx.push(exr[i] as number);
      hasSx = true;
    } else {
      sx.push(NaN);
    }
    if (zr[i] != null) {
      z.push(zr[i] as number);
      hasZ = true;
    } else {
      z.push(NaN);
    }
  }

  if (x.length < 2) {
    return { message: 'Hacen falta al menos 2 filas con X e Y válidas.' };
  }

  return {
    x,
    y,
    sy: hasSy ? sy : null,
    sx: hasSx ? sx : null,
    z: hasZ ? z : null,
    n: x.length,
  };
}

export function isExtractError(
  d: ExtractedData | ExtractError,
): d is ExtractError {
  return (d as ExtractError).message !== undefined;
}

/** Construye la petición de ajuste a partir de datos y opciones del modelo. */
export function buildFitRequest(
  data: ExtractedData,
  model: FitModelId,
  opts: {
    degree?: number;
    expression?: string;
    parameters?: string[];
    initialGuess?: number[];
  } = {},
): FitRequest {
  return {
    model,
    x: data.x,
    y: data.y,
    sy: data.sy,
    sx: data.sx,
    degree: opts.degree,
    expression: opts.expression ?? null,
    parameters: opts.parameters ?? null,
    initial_guess: opts.initialGuess ?? null,
    curve_points: 250,
  };
}
