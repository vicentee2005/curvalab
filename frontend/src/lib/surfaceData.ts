// Extrae de la hoja los tres arrays alineados (x, y, z) del entorno 3D.
// A diferencia del 2D no hay columnas de error: el ajuste de superficies
// trabaja siempre sin ponderar.
import type { Column } from '../types';

export interface SurfaceExtractError {
  message: string;
}

export interface SurfaceData {
  x: number[];
  y: number[];
  z: number[];
  n: number;
}

function firstColByRole(columns: Column[], role: string): Column | undefined {
  return columns.find((c) => c.role === role);
}

function parseCol(col: Column, upto: number): (number | null)[] {
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
 * Reúne los puntos (x, y, z) de las columnas con esos roles, descartando las
 * filas en las que falte alguno de los tres.
 */
export function extractSurfaceData(
  columns: Column[],
): SurfaceData | SurfaceExtractError {
  const xCol = firstColByRole(columns, 'x');
  const yCol = firstColByRole(columns, 'y');
  const zCol = firstColByRole(columns, 'z');
  if (!xCol) return { message: 'Asigna el rol X a una columna.' };
  if (!yCol) return { message: 'Asigna el rol Y a una columna.' };
  if (!zCol) return { message: 'Asigna el rol Z a una columna (la altura de la superficie).' };

  const maxLen = Math.max(
    xCol.values.length,
    yCol.values.length,
    zCol.values.length,
  );
  const xr = parseCol(xCol, maxLen);
  const yr = parseCol(yCol, maxLen);
  const zr = parseCol(zCol, maxLen);

  const x: number[] = [];
  const y: number[] = [];
  const z: number[] = [];
  for (let i = 0; i < maxLen; i++) {
    if (xr[i] == null || yr[i] == null || zr[i] == null) continue;
    x.push(xr[i] as number);
    y.push(yr[i] as number);
    z.push(zr[i] as number);
  }

  if (x.length < 3) {
    return { message: 'Hacen falta al menos 3 filas con X, Y y Z válidas.' };
  }
  return { x, y, z, n: x.length };
}

export function isSurfaceError(
  d: SurfaceData | SurfaceExtractError,
): d is SurfaceExtractError {
  return (d as SurfaceExtractError).message !== undefined;
}
