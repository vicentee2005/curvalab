// Utilidades de portapapeles para la hoja: convertir rangos a/desde texto
// tabulado (TSV), el formato que usan Excel y Google Sheets al copiar/pegar.

/** Convierte texto pegado (TSV o CSV) en una matriz de celdas string[][]. */
export function parseClipboard(text: string): string[][] {
  // Normaliza saltos de línea y quita un posible salto final.
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n$/, '');
  if (clean === '') return [];
  const lines = clean.split('\n');
  // Detecta separador: tab (Excel) o, si no hay tabs, coma o ';'.
  const hasTab = clean.includes('\t');
  const sep = hasTab ? '\t' : clean.includes(';') ? ';' : clean.includes(',') ? ',' : '\t';
  return lines.map((line) => line.split(sep).map((c) => c.trim()));
}

/** ¿El texto pegado representa un bloque (varias celdas)? */
export function isBlock(text: string): boolean {
  return /[\t\n]/.test(text.trim());
}

/** Construye TSV a partir de una matriz de celdas (para copiar). */
export function buildTSV(block: string[][]): string {
  return block.map((row) => row.join('\t')).join('\n');
}
