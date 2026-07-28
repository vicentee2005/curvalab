// Cliente HTTP del backend de ajuste (FastAPI).
import type {
  FitRequest,
  FitResult,
  ImportResult,
  PropagateRequest,
  PropagateResult,
  PropagateTableRequest,
  PropagateTableResult,
  SurfaceFitRequest,
  SurfaceFitResult,
} from './types';

// En local el backend corre aparte, en localhost:8000 (uvicorn junto a Vite).
// Desplegado en Vercel la API vive en el mismo origen (/api/...), servida por la
// función serverless de `api/index.py`, así que la base es la cadena vacía.
// VITE_API_BASE permite apuntar a otro sitio si hiciera falta.
const API_BASE =
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.DEV ? 'http://localhost:8000' : '');

class ApiError extends Error {}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* respuesta sin JSON */
    }
    throw new ApiError(detail);
  }
  return res.json() as Promise<T>;
}

export async function fitCurve(req: FitRequest): Promise<FitResult> {
  const res = await fetch(`${API_BASE}/api/fit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return handle<FitResult>(res);
}

/** Ajuste de superficie z = f(x,y) del entorno 3D. */
export async function fitSurface(req: SurfaceFitRequest): Promise<SurfaceFitResult> {
  const res = await fetch(`${API_BASE}/api/fit-surface`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return handle<SurfaceFitResult>(res);
}

/** Propagación de incertidumbres a una medida indirecta única. */
export async function propagate(req: PropagateRequest): Promise<PropagateResult> {
  const res = await fetch(`${API_BASE}/api/propagate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return handle<PropagateResult>(res);
}

/** Propagación fila a fila sobre columnas de la hoja de datos. */
export async function propagateTable(
  req: PropagateTableRequest,
): Promise<PropagateTableResult> {
  const res = await fetch(`${API_BASE}/api/propagate-table`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return handle<PropagateTableResult>(res);
}

/** Variables que aparecen en una fórmula, según SymPy. */
export async function formulaSymbols(expression: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/formula-symbols`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expression }),
  });
  const body = await handle<{ symbols: string[] }>(res);
  return body.symbols;
}

export async function importFile(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/import`, {
    method: 'POST',
    body: form,
  });
  return handle<ImportResult>(res);
}

export async function importText(text: string): Promise<ImportResult> {
  const res = await fetch(`${API_BASE}/api/import-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return handle<ImportResult>(res);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export { ApiError };
