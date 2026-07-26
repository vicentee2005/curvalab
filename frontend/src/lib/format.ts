// Utilidades de formateo numérico (cifras significativas).

/** Formatea un número a `sig` cifras significativas (como el prototipo). */
export function toSigFigs(x: number, sig: number): string {
  if (!Number.isFinite(x)) return '—';
  const s = Math.min(21, Math.max(1, sig));
  return x.toPrecision(s);
}

/**
 * Redondeo de laboratorio: la incertidumbre manda.
 *
 * Se redondea σ a `sig` cifras significativas y el valor se corta en esa misma
 * posición decimal, que es como se escribe un resultado en un informe:
 * 9.8123 ± 0.0456 se presenta como 9.812 ± 0.046, no con todos los decimales.
 */
export function labRound(
  value: number,
  sigma: number,
  sig = 2,
): { value: string; sigma: string; decimals: number } {
  if (!Number.isFinite(value)) return { value: '—', sigma: '—', decimals: 0 };
  if (!Number.isFinite(sigma) || sigma <= 0) {
    return { value: toSigFigs(value, 6), sigma: '0', decimals: 0 };
  }
  // Posición de la primera cifra significativa de σ.
  const exp = Math.floor(Math.log10(Math.abs(sigma)));
  const decimals = sig - 1 - exp;

  if (decimals >= 0) {
    const d = Math.min(20, decimals);
    return { value: value.toFixed(d), sigma: sigma.toFixed(d), decimals: d };
  }
  // σ ≥ 10^sig: se redondea a decenas, centenas… y no quedan decimales.
  const step = Math.pow(10, -decimals);
  return {
    value: (Math.round(value / step) * step).toFixed(0),
    sigma: (Math.round(sigma / step) * step).toFixed(0),
    decimals: 0,
  };
}

/** Valor ± incertidumbre ya redondeados a la misma cifra. */
export function labPair(value: number, sigma: number, sig = 2): string {
  const r = labRound(value, sigma, sig);
  return `${r.value} ± ${r.sigma}`;
}

/** Valor ± incertidumbre a `sig` cifras significativas. */
export function valueWithError(
  value: number,
  stderr: number | null | undefined,
  sig: number,
): string {
  if (stderr == null || !Number.isFinite(stderr)) return toSigFigs(value, sig);
  return `${toSigFigs(value, sig)} ± ${toSigFigs(stderr, sig)}`;
}
