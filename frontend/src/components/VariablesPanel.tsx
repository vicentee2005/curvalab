// Fórmula + tabla de variables del entorno de incertidumbres.
//
// La tabla no se escribe a mano: el backend (SymPy) dice qué símbolos hay en la
// fórmula y aquí solo se rellenan sus valores. Así no hay dos parsers distintos
// ni forma de que la lista se desincronice de lo que se va a calcular.
import type {
  Column,
  Distribution,
  TableBinding,
  UncertainVariable,
  UncertaintyMode,
} from '../types';

interface VariablesPanelProps {
  expression: string;
  onExpression: (v: string) => void;
  mode: UncertaintyMode;
  onMode: (m: UncertaintyMode) => void;
  variables: UncertainVariable[];
  /** Símbolos que SymPy ve ahora mismo en la fórmula. */
  symbols: string[];
  parsing: boolean;
  parseError: string | null;
  onPatch: (id: string, patch: Partial<UncertainVariable>) => void;
  onRemove: (id: string) => void;
  /** Columnas de la hoja, para enganchar variables en modo tabla. */
  columns: Column[];
  bindings: Record<string, TableBinding>;
  onBinding: (name: string, patch: Partial<TableBinding>) => void;
  samples: number;
  onSamples: (n: number) => void;
  onCompute: () => void;
  computing: boolean;
}

const EXAMPLES: { label: string; expression: string; hint: string }[] = [
  { label: 'Péndulo', expression: '4*pi**2*L/T**2', hint: 'g a partir del período' },
  { label: 'Densidad', expression: 'm/(pi*r**2*h)', hint: 'cilindro medido con el pie de rey' },
  { label: 'Módulo de Young', expression: 'F*L/(A*dL)', hint: 'ensayo de tracción' },
  { label: 'Ley de Ohm', expression: 'V/I', hint: 'resistencia' },
];

export const inputCell: React.CSSProperties = {
  width: '100%',
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 7,
  color: 'var(--ink)',
  padding: '7px 9px',
  fontSize: 13,
  fontFamily: 'inherit',
};

const th: React.CSSProperties = {
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  padding: '0 8px 8px',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = { padding: '4px 8px', verticalAlign: 'middle' };

export function VariablesPanel({
  expression,
  onExpression,
  mode,
  onMode,
  variables,
  symbols,
  parsing,
  parseError,
  onPatch,
  onRemove,
  columns,
  bindings,
  onBinding,
  samples,
  onSamples,
  onCompute,
  computing,
}: VariablesPanelProps) {
  const used = new Set(symbols);
  const activas = variables.filter((v) => used.has(v.name));
  const sobrantes = variables.filter((v) => !used.has(v.name));
  const isTable = mode === 'table';

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--on-accent)' : 'var(--muted2)',
    border: 'none',
    padding: '7px 16px',
    borderRadius: 7,
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
  });

  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(16,24,40,.05)',
      }}
    >
      {/* Cabecera con las dos formas de trabajar */}
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: 'var(--card-pad) 16px',
          borderBottom: '1px solid var(--line-soft)',
        }}
      >
        <div style={{ display: 'flex', background: 'var(--row2)', borderRadius: 9, padding: 3 }}>
          <button onClick={() => onMode('single')} style={tabStyle(!isTable)}>
            Medida única
          </button>
          <button onClick={() => onMode('table')} style={tabStyle(isTable)}>
            Por filas
          </button>
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12.5,
            color: 'var(--muted)',
            lineHeight: 1.45,
          }}
        >
          {isTable
            ? 'Cada fila de la hoja da un resultado con su error propagado.'
            : 'Un solo valor por magnitud: el caso clásico de la práctica.'}
        </div>

        {/* La acción principal vive en la cabecera: así no se mueve al crecer
            la tabla de variables ni queda debajo del asistente flotante. */}
        {!isTable && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 12,
              color: 'var(--muted2)',
              whiteSpace: 'nowrap',
            }}
          >
            Monte Carlo
            <select
              value={samples}
              onChange={(e) => onSamples(parseInt(e.target.value, 10))}
              title="Número de simulaciones"
              style={{ ...inputCell, width: 'auto', padding: '6px 8px' }}
            >
              {[1000, 10000, 100000, 500000].map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString('es-ES')}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          onClick={onCompute}
          disabled={computing || activas.length === 0}
          style={{
            flex: '0 0 auto',
            background: activas.length === 0 ? 'var(--row2)' : 'var(--accent)',
            color: activas.length === 0 ? 'var(--muted)' : 'var(--on-accent)',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 9,
            fontSize: 13.5,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            cursor: activas.length === 0 ? 'default' : 'pointer',
          }}
        >
          {computing ? 'Calculando…' : 'Propagar el error'}
        </button>
      </div>

      <div style={{ padding: 'var(--card-pad) 16px 16px' }}>
        {/* Fórmula */}
        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--muted2)',
            marginBottom: 7,
          }}
        >
          Fórmula de la magnitud indirecta
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="mono" style={{ fontSize: 15, color: 'var(--accent)', fontWeight: 600 }}>
            z =
          </span>
          <input
            className="mono"
            value={expression}
            onChange={(e) => onExpression(e.target.value)}
            placeholder="4*pi**2*L/T**2"
            spellCheck={false}
            style={{ ...inputCell, fontSize: 14.5, padding: '9px 11px' }}
          />
        </div>

        {/* Ejemplos y estado del parseo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 7,
            marginTop: 10,
            minHeight: 26,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Ejemplos:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              title={`${ex.hint} · ${ex.expression}`}
              onClick={() => onExpression(ex.expression)}
              style={{
                background: 'var(--row)',
                border: '1px solid var(--line)',
                color: 'var(--muted2)',
                borderRadius: 20,
                padding: '4px 11px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {ex.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {parsing && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Leyendo…</span>}
        </div>

        {parseError && (
          <div
            style={{
              marginTop: 10,
              padding: '9px 12px',
              background: 'var(--row)',
              border: '1px solid var(--line)',
              borderLeft: '3px solid var(--secondary)',
              borderRadius: 8,
              fontSize: 12.5,
              color: 'var(--muted2)',
              lineHeight: 1.5,
            }}
          >
            {parseError}
          </div>
        )}

        {/* Variables */}
        {activas.length === 0 && !parseError ? (
          <div
            style={{
              marginTop: 16,
              padding: '18px 14px',
              background: 'var(--row)',
              border: '1px dashed var(--line)',
              borderRadius: 10,
              fontSize: 13,
              color: 'var(--muted)',
              textAlign: 'center',
              lineHeight: 1.55,
            }}
          >
            Escribe una fórmula y aquí aparecerá una fila por cada magnitud que
            uses. <span className="mono">pi</span> y <span className="mono">e</span> son
            constantes: no hace falta darles valor.
          </div>
        ) : (
          <div style={{ marginTop: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isTable ? 620 : 520 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 74 }}>Variable</th>
                  <th style={th}>{isTable ? 'Valores' : 'Valor'}</th>
                  <th style={th}>{isTable ? 'Incertidumbre' : '± incertidumbre'}</th>
                  <th style={{ ...th, width: 150 }}>Distribución</th>
                </tr>
              </thead>
              <tbody>
                {activas.map((v) => {
                  const b = bindings[v.name] ?? { valueColumn: '', errorColumn: '' };
                  return (
                    <tr key={v.id}>
                      <td style={td}>
                        <span
                          className="mono"
                          style={{
                            display: 'inline-block',
                            background: 'var(--accent-soft)',
                            color: 'var(--accent)',
                            border: '1px solid var(--accent-line)',
                            borderRadius: 7,
                            padding: '5px 10px',
                            fontSize: 13.5,
                            fontWeight: 600,
                          }}
                        >
                          {v.name}
                        </span>
                      </td>
                      <td style={td}>
                        {isTable ? (
                          <select
                            value={b.valueColumn}
                            onChange={(e) => onBinding(v.name, { valueColumn: e.target.value })}
                            style={inputCell}
                          >
                            <option value="">Constante (valor fijo)</option>
                            {columns.map((c) => (
                              <option key={c.id} value={c.id}>
                                Columna: {c.name}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {(!isTable || b.valueColumn === '') && (
                          <input
                            className="mono"
                            value={v.value}
                            onChange={(e) => onPatch(v.id, { value: e.target.value })}
                            placeholder="0"
                            style={{ ...inputCell, marginTop: isTable ? 6 : 0 }}
                          />
                        )}
                      </td>
                      <td style={td}>
                        {isTable ? (
                          <select
                            value={b.errorColumn}
                            onChange={(e) => onBinding(v.name, { errorColumn: e.target.value })}
                            style={inputCell}
                          >
                            <option value="">Igual en todas las filas</option>
                            {columns.map((c) => (
                              <option key={c.id} value={c.id}>
                                Columna: {c.name}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {(!isTable || b.errorColumn === '') && (
                          <input
                            className="mono"
                            value={v.uncertainty}
                            onChange={(e) => onPatch(v.id, { uncertainty: e.target.value })}
                            placeholder="0"
                            style={{ ...inputCell, marginTop: isTable ? 6 : 0 }}
                          />
                        )}
                      </td>
                      <td style={td}>
                        <select
                          value={v.distribution}
                          onChange={(e) =>
                            onPatch(v.id, { distribution: e.target.value as Distribution })
                          }
                          title={
                            v.distribution === 'rectangular'
                              ? 'La incertidumbre es la semiamplitud a; σ = a/√3'
                              : 'La incertidumbre es directamente σ'
                          }
                          style={inputCell}
                        >
                          <option value="normal">Normal (σ)</option>
                          <option value="rectangular">Rectangular (a/√3)</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Variables que ya no aparecen en la fórmula: se avisan, no se borran
            solas, porque suelen reaparecer mientras se edita la expresión. */}
        {sobrantes.length > 0 && (
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              fontSize: 12,
              color: 'var(--muted)',
            }}
          >
            Ya no están en la fórmula:
            {sobrantes.map((v) => (
              <span
                key={v.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--row)',
                  border: '1px solid var(--line)',
                  borderRadius: 20,
                  padding: '3px 6px 3px 10px',
                }}
              >
                <span className="mono">{v.name}</span>
                <button
                  onClick={() => onRemove(v.id)}
                  title="Olvidar esta variable"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: 13,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
