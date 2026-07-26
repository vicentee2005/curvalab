// Panel de resultados del análisis: parámetros, incertidumbres y bondad.
import { useState } from 'react';
import type { FitResult } from '../types';
import { toSigFigs, valueWithError } from '../lib/format';

interface ResultsPanelProps {
  fit: FitResult | null;
  error: string | null;
  loading: boolean;
  ring?: boolean;
}

interface Row {
  label: string;
  value: number;
  stderr?: number | null;
}

export function ResultsPanel({ fit, error, loading, ring }: ResultsPanelProps) {
  // Cifras significativas por fila (índice -> nº c.s.).
  const [sig, setSig] = useState<Record<number, number>>({});

  const cardBase = {
    background: 'var(--panel)',
    border: '1px solid var(--line)',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative' as const,
    zIndex: ring ? 60 : ('auto' as const),
    boxShadow: ring
      ? '0 0 0 3px var(--accent), 0 0 0 10px var(--accent-soft)'
      : '0 1px 3px rgba(16,24,40,.05)',
    flex: '0 0 auto',
  };

  const header = (subtitle: string, n?: number) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 'var(--card-pad) 16px',
        borderBottom: '1px solid var(--line-soft)',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--secondary)' }} />
      <div style={{ fontWeight: 600, fontSize: 14.5 }}>Resultados del análisis</div>
      <div className="mono" style={{ fontSize: 12.5, color: 'var(--muted)' }}>
        {subtitle}
      </div>
      <div style={{ flex: 1 }} />
      {n != null && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--muted2)',
            background: 'var(--row2)',
            padding: '4px 10px',
            borderRadius: 20,
          }}
        >
          N = {n} puntos
        </span>
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={cardBase}>
        {header('Calculando…')}
        <div style={{ padding: 'var(--card-pad)', color: 'var(--muted)', fontSize: 13.5 }}>
          Ajustando el modelo…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={cardBase}>
        {header('Sin ajuste')}
        <div
          style={{
            padding: 'var(--card-pad)',
            color: 'var(--secondary)',
            fontSize: 13.5,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (!fit) {
    return (
      <div style={cardBase}>
        {header('Aún sin ajuste')}
        <div style={{ padding: 'var(--card-pad)', color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.5 }}>
          Introduce datos, asigna roles X e Y y elige un ajuste en el menú{' '}
          <b>Análisis</b>. Los parámetros y su incertidumbre aparecerán aquí.
        </div>
      </div>
    );
  }

  // Construir filas: parámetros + bondad.
  const rows: Row[] = fit.parameters.map((p) => ({
    label: labelForParam(fit.model, p.name),
    value: p.value,
    stderr: p.stderr,
  }));
  rows.push({ label: 'Coef. R²', value: fit.r_squared });
  if (fit.reduced_chi_squared != null) {
    rows.push({ label: 'χ² / ν', value: fit.reduced_chi_squared });
  } else {
    rows.push({ label: 'RMSE', value: fit.rmse });
  }

  return (
    <div style={cardBase}>
      {header(`${fit.equation}`, fit.n_points)}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 'var(--card-pad)' }}>
        {rows.map((r, i) => {
          const sf = sig[i] ?? 3;
          const display =
            r.stderr != null ? valueWithError(r.value, r.stderr, sf) : toSigFigs(r.value, sf);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                minWidth: 172,
                background: 'var(--row)',
                border: '1px solid var(--line-soft)',
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, fontSize: 12, color: 'var(--muted)' }}>{r.label}</div>
                <select
                  value={sf}
                  onChange={(e) => setSig((s) => ({ ...s, [i]: parseInt(e.target.value, 10) }))}
                  title="Cifras significativas"
                  style={{
                    fontSize: 11,
                    color: 'var(--muted2)',
                    background: 'var(--panel)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    padding: '3px 5px',
                    cursor: 'pointer',
                  }}
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} c.s.
                    </option>
                  ))}
                </select>
              </div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
                {display}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Etiquetas legibles para los parámetros según el modelo.
function labelForParam(model: string, name: string): string {
  if (model === 'linear') {
    if (name === 'a') return 'Pendiente (a)';
    if (name === 'b') return 'Ordenada (b)';
  }
  return name;
}
