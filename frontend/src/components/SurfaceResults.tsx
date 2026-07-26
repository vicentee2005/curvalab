// Panel de resultados del ajuste de superficie: coeficientes, incertidumbres
// y bondad. No hay χ² porque el entorno 3D trabaja sin barras de error.
import { useState } from 'react';
import type { SurfaceFitResult } from '../types';
import { toSigFigs, valueWithError } from '../lib/format';

interface SurfaceResultsProps {
  fit: SurfaceFitResult | null;
  error: string | null;
  loading: boolean;
  /** Resalta el panel durante la guía de inicio. */
  ring?: boolean;
}

const card: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(16,24,40,.05)',
  flex: '0 0 auto',
  maxHeight: '38vh',
  display: 'flex',
  flexDirection: 'column',
};

function Header({ subtitle, n }: { subtitle: string; n?: number }) {
  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 'var(--card-pad) 16px',
        borderBottom: '1px solid var(--line-soft)',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--secondary)' }} />
      <div style={{ fontWeight: 600, fontSize: 14.5, flex: '0 0 auto' }}>
        Resultados del ajuste
      </div>
      <div
        className="mono"
        style={{
          fontSize: 12.5,
          color: 'var(--muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={subtitle}
      >
        {subtitle}
      </div>
      <div style={{ flex: 1 }} />
      {n != null && (
        <span
          style={{
            flex: '0 0 auto',
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
}

export function SurfaceResults({ fit, error, loading, ring }: SurfaceResultsProps) {
  const [sig, setSig] = useState<Record<number, number>>({});

  const box: React.CSSProperties = ring
    ? {
        ...card,
        position: 'relative',
        zIndex: 60,
        boxShadow: '0 0 0 3px var(--accent), 0 0 0 10px var(--accent-soft)',
      }
    : card;

  if (loading) {
    return (
      <div style={box}>
        <Header subtitle="Calculando…" />
        <div style={{ padding: 'var(--card-pad)', color: 'var(--muted)', fontSize: 13.5 }}>
          Ajustando la superficie…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={box}>
        <Header subtitle="Sin ajuste" />
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
      <div style={box}>
        <Header subtitle="Aún sin ajuste" />
        <div
          style={{
            padding: 'var(--card-pad)',
            color: 'var(--muted)',
            fontSize: 13.5,
            lineHeight: 1.5,
          }}
        >
          Asigna los roles X, Y y Z a tres columnas y elige un modelo de
          superficie en el menú <b>Análisis</b>. Los coeficientes y su
          incertidumbre aparecerán aquí.
        </div>
      </div>
    );
  }

  const rows: { label: string; value: number; stderr?: number | null }[] =
    fit.parameters.map((p) => ({ label: p.name, value: p.value, stderr: p.stderr }));
  rows.push({ label: 'Coef. R²', value: fit.r_squared });
  rows.push({ label: 'RMSE', value: fit.rmse });

  // Un parámetro cuya incertidumbre supera su propio valor no está determinado
  // por los datos: suele significar que el modelo sobra para esta superficie
  // (p. ej. una campana muy ancha imitando un plano). El R² alto no lo delata,
  // así que conviene decirlo.
  const noIdentificables = fit.parameters
    .filter((p) => p.stderr != null && p.stderr > Math.abs(p.value))
    .map((p) => p.name);

  return (
    <div style={box}>
      <Header subtitle={fit.equation} n={fit.n_points} />
      {noIdentificables.length > 0 && (
        <div
          style={{
            flex: '0 0 auto',
            margin: '10px var(--card-pad) 0',
            padding: '9px 12px',
            background: 'var(--row)',
            border: '1px solid var(--line)',
            borderLeft: '3px solid var(--secondary)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--muted2)',
            lineHeight: 1.5,
          }}
        >
          La incertidumbre de{' '}
          <span className="mono">{noIdentificables.join(', ')}</span> supera su
          propio valor: los datos no determinan{' '}
          {noIdentificables.length > 1 ? 'esos parámetros' : 'ese parámetro'}. Aunque
          el R² salga alto, el modelo probablemente sobra para esta superficie.
        </div>
      )}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          padding: 'var(--card-pad)',
        }}
      >
        {rows.map((r, i) => {
          const sf = sig[i] ?? 3;
          const display =
            r.stderr != null ? valueWithError(r.value, r.stderr, sf) : toSigFigs(r.value, sf);
          return (
            <div
              key={i}
              style={{
                flex: '1 1 150px',
                minWidth: 150,
                background: 'var(--row)',
                border: '1px solid var(--line-soft)',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div className="mono" style={{ flex: 1, fontSize: 12, color: 'var(--muted)' }}>
                  {r.label}
                </div>
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
                    padding: '2px 4px',
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
              <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
                {display}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
