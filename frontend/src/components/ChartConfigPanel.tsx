// Pestaña "Gráfica": se elige el tipo de representación y las etiquetas antes
// de crear la gráfica. Al importar datos NO se dibuja nada automáticamente; hay
// que pasar por aquí y pulsar "Crear gráfica".
import type { ChartConfig, ChartType, Dimension } from '../types';

interface ChartConfigPanelProps {
  config: ChartConfig;
  onChange: (patch: Partial<ChartConfig>) => void;
  dimension: Dimension;
  onDimension: (d: Dimension) => void;
  onCreate: () => void;
  created: boolean;
  /** Nombres derivados de las columnas, usados como placeholder. */
  derivedX: string;
  derivedY: string;
  /** Aviso si no se puede crear todavía (faltan roles X/Y). */
  blockedReason: string | null;
}

const TYPES: { id: ChartType; label: string; desc: string; glyph: string }[] = [
  { id: 'scatter', label: 'Dispersión', desc: 'Solo puntos', glyph: '⁘' },
  { id: 'lines', label: 'Líneas', desc: 'Une los puntos', glyph: '⟋' },
  { id: 'lines+markers', label: 'Puntos y líneas', desc: 'Ambos', glyph: '⟋⁘' },
  { id: 'bars', label: 'Barras', desc: 'Diagrama de barras', glyph: '▮▮' },
];

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--muted2)',
  marginBottom: 5,
  fontWeight: 600,
};

const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  background: 'var(--panel)',
  color: 'var(--ink)',
  fontSize: 13.5,
};

export function ChartConfigPanel({
  config,
  onChange,
  dimension,
  onDimension,
  onCreate,
  created,
  derivedX,
  derivedY,
  blockedReason,
}: ChartConfigPanelProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '20px 22px' }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
          Configura tu gráfica
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>
          Elige cómo quieres representar los datos y pulsa <b>Crear gráfica</b>.
        </div>

        {/* Dimensión */}
        <div style={label}>Dimensión</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {(['2d', '3d'] as Dimension[]).map((d) => (
            <button
              key={d}
              onClick={() => onDimension(d)}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 9,
                border: `1px solid ${dimension === d ? 'var(--accent)' : 'var(--line)'}`,
                background: dimension === d ? 'var(--accent-soft)' : 'var(--row)',
                color: dimension === d ? 'var(--accent)' : 'var(--muted2)',
                fontWeight: 600,
                fontSize: 13.5,
                cursor: 'pointer',
              }}
            >
              {d === '2d' ? '2D — X frente a Y' : '3D — superficie X, Y, Z'}
            </button>
          ))}
        </div>

        {/* Tipo de representación */}
        <div style={label}>Tipo de representación</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 8,
            marginBottom: 20,
          }}
        >
          {TYPES.map((t) => {
            const active = config.type === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onChange({ type: t.id })}
                style={{
                  textAlign: 'left',
                  padding: '11px 12px',
                  borderRadius: 10,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                  background: active ? 'var(--accent-soft)' : 'var(--row)',
                  cursor: 'pointer',
                  color: 'var(--ink)',
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 15,
                    color: active ? 'var(--accent)' : 'var(--muted)',
                    marginBottom: 3,
                  }}
                >
                  {t.glyph}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{t.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Etiquetas de ejes y título */}
        <div style={label}>Títulos y leyendas</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ ...label, fontWeight: 400, fontSize: 11.5 }}>Etiqueta del eje X</div>
            <input
              value={config.xLabel}
              onChange={(e) => onChange({ xLabel: e.target.value })}
              placeholder={derivedX}
              style={input}
            />
          </div>
          <div>
            <div style={{ ...label, fontWeight: 400, fontSize: 11.5 }}>Etiqueta del eje Y</div>
            <input
              value={config.yLabel}
              onChange={(e) => onChange({ yLabel: e.target.value })}
              placeholder={derivedY}
              style={input}
            />
          </div>
          {dimension === '3d' && (
            <div>
              <div style={{ ...label, fontWeight: 400, fontSize: 11.5 }}>Etiqueta del eje Z</div>
              <input
                value={config.zLabel}
                onChange={(e) => onChange({ zLabel: e.target.value })}
                placeholder="Z"
                style={input}
              />
            </div>
          )}
          <div>
            <div style={{ ...label, fontWeight: 400, fontSize: 11.5 }}>Título de la gráfica</div>
            <input
              value={config.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder={`${derivedY} frente a ${derivedX}`}
              style={input}
            />
          </div>
          <div>
            <div style={{ ...label, fontWeight: 400, fontSize: 11.5 }}>
              Leyenda de la serie de datos
            </div>
            <input
              value={config.seriesName}
              onChange={(e) => onChange({ seriesName: e.target.value })}
              placeholder={derivedY}
              style={input}
            />
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 18 }}>
          Si lo dejas en blanco se usa el nombre de la columna.
        </div>

        {/* Opciones */}
        <div style={{ display: 'flex', gap: 18, marginBottom: 22 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.showGrid}
              onChange={(e) => onChange({ showGrid: e.target.checked })}
            />
            Mostrar cuadrícula
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.showLegend}
              onChange={(e) => onChange({ showLegend: e.target.checked })}
            />
            Mostrar leyenda
          </label>
        </div>

        {blockedReason && (
          <div
            style={{
              background: 'var(--row)',
              border: '1px solid var(--line)',
              borderLeft: '3px solid var(--secondary)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12.5,
              color: 'var(--muted2)',
              marginBottom: 14,
              lineHeight: 1.5,
            }}
          >
            {blockedReason}
          </div>
        )}

        <button
          onClick={onCreate}
          disabled={!!blockedReason}
          style={{
            width: '100%',
            padding: '12px 18px',
            borderRadius: 10,
            border: 'none',
            background: blockedReason ? 'var(--row2)' : 'var(--accent)',
            color: blockedReason ? 'var(--muted)' : 'var(--on-accent)',
            fontSize: 14,
            fontWeight: 600,
            cursor: blockedReason ? 'default' : 'pointer',
          }}
        >
          {created ? 'Actualizar gráfica' : 'Crear gráfica'}
        </button>
      </div>
    </div>
  );
}
