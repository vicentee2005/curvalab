// Resultado de la propagación: valor con su incertidumbre, de dónde sale ese
// error (desglose por variable) y la comprobación por Monte Carlo.
import { useState } from 'react';
import type { PropagateResult, PropagateTableResult } from '../types';
import { labPair, labRound, toSigFigs } from '../lib/format';
import { MonteCarloPlot } from './MonteCarloPlot';

interface PropagationCardProps {
  result: PropagateResult | null;
  tableResult: PropagateTableResult | null;
  error: string | null;
  loading: boolean;
  isDark: boolean;
  accent: string;
  plotRef: React.MutableRefObject<HTMLDivElement | null>;
  /** Nombre para el eje del histograma y las etiquetas ("g", "z"…). */
  label: string;
  onAddColumns: () => void;
  onSendTo2D: () => void;
}

type Tab = 'desglose' | 'montecarlo';

const card: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(16,24,40,.05)',
};

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={card}>
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
        <div style={{ fontWeight: 600, fontSize: 14.5 }}>Resultado</div>
        <div style={{ flex: 1 }} />
        {right}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

const pad: React.CSSProperties = { padding: 'var(--card-pad) 16px 18px' };

export function PropagationCard({
  result,
  tableResult,
  error,
  loading,
  isDark,
  accent,
  plotRef,
  label,
  onAddColumns,
  onSendTo2D,
}: PropagationCardProps) {
  const [tab, setTab] = useState<Tab>('desglose');

  if (loading) {
    return (
      <Shell>
        <div style={{ ...pad, color: 'var(--muted)', fontSize: 13.5 }}>Propagando…</div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div style={{ ...pad, color: 'var(--secondary)', fontSize: 13.5, lineHeight: 1.55 }}>
          {error}
        </div>
      </Shell>
    );
  }

  if (tableResult) {
    return (
      <Shell
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onAddColumns} style={ghostBtn}>
              Añadir a la hoja
            </button>
            <button onClick={onSendTo2D} style={ghostBtn} title="Abre el entorno 2D con estos datos">
              Ajustar en 2D →
            </button>
          </div>
        }
      >
        <TableResult res={tableResult} label={label} />
      </Shell>
    );
  }

  if (!result) {
    return (
      <Shell>
        <div style={{ ...pad, color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.6 }}>
          Escribe la fórmula de tu magnitud indirecta, rellena el valor y la
          incertidumbre de cada variable y pulsa <b>Propagar el error</b>. Aquí
          verás el resultado, qué medida aporta más error y la comprobación por
          Monte Carlo.
        </div>
      </Shell>
    );
  }

  const tabBtn = (t: Tab, texto: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        background: tab === t ? 'var(--accent)' : 'transparent',
        color: tab === t ? 'var(--on-accent)' : 'var(--muted2)',
        border: 'none',
        padding: '6px 14px',
        borderRadius: 7,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {texto}
    </button>
  );

  return (
    <Shell
      right={
        <div style={{ display: 'flex', background: 'var(--row2)', borderRadius: 9, padding: 3 }}>
          {tabBtn('desglose', 'Desglose')}
          {result.mc && tabBtn('montecarlo', 'Monte Carlo')}
        </div>
      }
    >
      {tab === 'desglose' || !result.mc ? (
        <Breakdown result={result} label={label} />
      ) : (
        <MonteCarlo
          result={result}
          label={label}
          isDark={isDark}
          accent={accent}
          plotRef={plotRef}
        />
      )}
    </Shell>
  );
}

const ghostBtn: React.CSSProperties = {
  height: 32,
  padding: '0 12px',
  background: 'var(--row)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  color: 'var(--muted2)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
};

// --------------------------------------------------------------------------- //
// Desglose analítico
// --------------------------------------------------------------------------- //
function Breakdown({ result, label }: { result: PropagateResult; label: string }) {
  const r = labRound(result.value, result.uncertainty);
  const rel = result.relative;

  // Si la simulación se aleja de la fórmula analítica, la fórmula ha dejado de
  // valer: f no es lineal en el entorno ±σ de las variables.
  const mc = result.mc;
  const desviacion =
    mc && result.uncertainty > 0 ? Math.abs(mc.std - result.uncertainty) / result.uncertainty : 0;
  const discrepa = mc != null && desviacion > 0.1;

  return (
    <div style={pad}>
      {/* Resultado grande */}
      <div
        style={{
          background: 'var(--row)',
          border: '1px solid var(--line-soft)',
          borderRadius: 12,
          padding: '16px 18px',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
          Valor con su incertidumbre (redondeo de laboratorio)
        </div>
        <div className="mono" style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.01em' }}>
          {label} = {r.value} ± {r.sigma}
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10, fontSize: 12.5 }}>
          {rel != null && (
            <span style={{ color: 'var(--muted2)' }}>
              Error relativo:{' '}
              <b className="mono">{(rel * 100).toPrecision(3)} %</b>
            </span>
          )}
          <span style={{ color: 'var(--muted2)' }}>
            Sin redondear: <span className="mono">{labPair(result.value, result.uncertainty, 6)}</span>
          </span>
        </div>
      </div>

      {discrepa && mc && (
        <Notice>
          La simulación da σ = <span className="mono">{toSigFigs(mc.std, 3)}</span> y la fórmula
          analítica <span className="mono">{toSigFigs(result.uncertainty, 3)}</span>:{' '}
          {(desviacion * 100).toFixed(0)} % de diferencia. Con incertidumbres tan
          grandes la fórmula deja de ser lineal en ±σ, así que el número bueno es
          el de Monte Carlo.
        </Notice>
      )}

      {/* De dónde sale el error */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted2)', margin: '4px 0 10px' }}>
        De dónde sale el error
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              {/* Sin uppercase: aquí las cabeceras llevan símbolos (σ, ∂) que
                  no deben cambiar de caja. */}
              {['Variable', '∂z/∂v (derivada simbólica)', 'σ', '|∂z/∂v|·σ', 'Peso'].map((h, i) => (
                <th
                  key={h}
                  style={{
                    textAlign: i >= 2 ? 'right' : 'left',
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: 'var(--muted)',
                    padding: '0 8px 8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.contributions.map((c) => (
              <tr key={c.name} style={{ borderTop: '1px solid var(--line-soft)' }}>
                <td className="mono" style={{ padding: '9px 8px', fontWeight: 600 }}>
                  {c.name}
                </td>
                <td
                  className="mono"
                  style={{ padding: '9px 8px', fontSize: 12.5, color: 'var(--muted2)' }}
                >
                  {c.derivative} <span style={{ opacity: 0.6 }}>= {toSigFigs(c.derivative_value, 4)}</span>
                </td>
                <td className="mono" style={{ padding: '9px 8px', textAlign: 'right', fontSize: 12.5 }}>
                  {toSigFigs(c.sigma, 3)}
                </td>
                <td className="mono" style={{ padding: '9px 8px', textAlign: 'right', fontSize: 12.5 }}>
                  {toSigFigs(c.term, 3)}
                </td>
                <td style={{ padding: '9px 8px', width: 132 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        background: 'var(--row2)',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(0, Math.min(100, c.percent))}%`,
                          height: '100%',
                          background: 'var(--accent)',
                        }}
                      />
                    </div>
                    <span
                      className="mono"
                      style={{ fontSize: 12, color: 'var(--muted2)', width: 42, textAlign: 'right' }}
                    >
                      {c.percent.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
        El peso reparte la <b>varianza</b> σ², no la σ: la variable con más
        porcentaje es la que conviene medir mejor si quieres bajar el error. Se
        suponen medidas <b>independientes</b> (sin correlación entre ellas).
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        margin: '0 0 16px',
        padding: '10px 13px',
        background: 'var(--row)',
        border: '1px solid var(--line)',
        borderLeft: '3px solid var(--secondary)',
        borderRadius: 8,
        fontSize: 12.5,
        color: 'var(--muted2)',
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Monte Carlo
// --------------------------------------------------------------------------- //
function MonteCarlo({
  result,
  label,
  isDark,
  accent,
  plotRef,
}: {
  result: PropagateResult;
  label: string;
  isDark: boolean;
  accent: string;
  plotRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const mc = result.mc!;
  const conf = Math.round(mc.confidence * 100);
  const asimetrica = Math.abs(mc.skewness) > 0.2;

  const stats: { label: string; value: string; hint?: string }[] = [
    { label: 'Media', value: toSigFigs(mc.mean, 6) },
    { label: 'σ simulada', value: toSigFigs(mc.std, 4) },
    { label: 'σ analítica', value: toSigFigs(result.uncertainty, 4) },
    { label: 'Mediana', value: toSigFigs(mc.median, 6) },
    { label: `Intervalo ${conf} %`, value: `${toSigFigs(mc.p_low, 5)} … ${toSigFigs(mc.p_high, 5)}` },
    { label: 'Asimetría', value: mc.skewness.toFixed(3) },
  ];

  return (
    <div style={{ ...pad, display: 'flex', flexDirection: 'column', minHeight: 420 }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted2)', lineHeight: 1.6, marginBottom: 12 }}>
        Se han sorteado <b>{mc.samples.toLocaleString('es-ES')}</b> juegos de valores según la
        distribución de cada variable y se ha evaluado la fórmula en todos. Este camino no
        supone que la fórmula sea lineal, así que sirve para comprobar la otra.
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 9,
          marginBottom: 14,
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: 'var(--row)',
              border: '1px solid var(--line-soft)',
              borderRadius: 10,
              padding: '9px 12px',
            }}
          >
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 4 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 13.5, fontWeight: 600 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {asimetrica && (
        <Notice>
          La asimetría vale <span className="mono">{mc.skewness.toFixed(2)}</span>: la distribución
          de salida no es simétrica, así que escribir el resultado como «valor ± σ» se queda
          corto. El intervalo del {conf} % describe mejor lo que pasa.
        </Notice>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 260,
          position: 'relative',
          background: 'var(--plot-bg)',
          border: '1px solid var(--line-soft)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <MonteCarloPlot
          mc={mc}
          value={result.value}
          uncertainty={result.uncertainty}
          label={label}
          isDark={isDark}
          accent={accent}
          plotRef={plotRef}
        />
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Modo tabla
// --------------------------------------------------------------------------- //
function TableResult({ res, label }: { res: PropagateTableResult; label: string }) {
  const validas = res.z.filter((v) => v != null).length;
  const maxFilas = 40;

  return (
    <div style={pad}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Chip texto={`${res.n_rows} filas`} />
        <Chip texto={`${validas} con resultado`} />
        {Object.entries(res.derivatives).map(([name, d]) => (
          <Chip key={name} texto={`∂z/∂${name} = ${d}`} mono />
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320 }}>
          <thead>
            <tr>
              {['Fila', label, `σ(${label})`, 'Relativo'].map((h, i) => (
                <th
                  key={h}
                  style={{
                    textAlign: i === 0 ? 'left' : 'right',
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: 'var(--muted)',
                    padding: '0 10px 8px',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {res.z.slice(0, maxFilas).map((z, i) => {
              const sz = res.sz[i];
              const r = z != null && sz != null ? labRound(z, sz) : null;
              return (
                <tr key={i} style={{ borderTop: '1px solid var(--line-soft)' }}>
                  <td style={{ padding: '7px 10px', fontSize: 12.5, color: 'var(--muted)' }}>
                    {i + 1}
                  </td>
                  <td className="mono" style={{ padding: '7px 10px', textAlign: 'right', fontSize: 13 }}>
                    {r ? r.value : '—'}
                  </td>
                  <td
                    className="mono"
                    style={{ padding: '7px 10px', textAlign: 'right', fontSize: 13, color: 'var(--muted2)' }}
                  >
                    {r ? r.sigma : '—'}
                  </td>
                  <td
                    className="mono"
                    style={{ padding: '7px 10px', textAlign: 'right', fontSize: 12.5, color: 'var(--muted)' }}
                  >
                    {z != null && sz != null && z !== 0
                      ? `${((sz / Math.abs(z)) * 100).toPrecision(3)} %`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {res.n_rows > maxFilas && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
          Se muestran las primeras {maxFilas} filas. «Añadir a la hoja» vuelca las{' '}
          {res.n_rows} completas.
        </div>
      )}
    </div>
  );
}

function Chip({ texto, mono }: { texto: string; mono?: boolean }) {
  return (
    <span
      className={mono ? 'mono' : undefined}
      style={{
        fontSize: 12,
        color: 'var(--muted2)',
        background: 'var(--row)',
        border: '1px solid var(--line-soft)',
        padding: '5px 11px',
        borderRadius: 20,
      }}
    >
      {texto}
    </span>
  );
}
