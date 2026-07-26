// Pestaña "Gráfica" del entorno 3D: se decide cómo representar la nube de
// puntos antes de crearla. Igual que en el 2D, importar datos NO dibuja nada:
// hay que pasar por aquí y pulsar "Crear gráfica".
import type { PointStyle3D, Surface3DConfig } from '../types';

interface SurfaceConfigPanelProps {
  config: Surface3DConfig;
  onChange: (patch: Partial<Surface3DConfig>) => void;
  onCreate: () => void;
  created: boolean;
  /** Nombres de las columnas X/Y/Z, usados como placeholder. */
  derived: { x: string; y: string; z: string };
  /** Aviso si aún no se puede crear (faltan roles o puntos). */
  blockedReason: string | null;
}

/** Escalas de color de Plotly que funcionan bien en claro y en oscuro. */
const COLORSCALES = [
  { id: 'Viridis', label: 'Viridis' },
  { id: 'Plasma', label: 'Plasma' },
  { id: 'Cividis', label: 'Cividis' },
  { id: 'Portland', label: 'Portland' },
  { id: 'Blues', label: 'Azules' },
  { id: 'RdBu', label: 'Rojo–azul' },
];

const POINT_STYLES: { id: PointStyle3D; label: string; desc: string }[] = [
  { id: 'accent', label: 'Un solo color', desc: 'Todos los puntos igual' },
  { id: 'byZ', label: 'Según su altura', desc: 'Color por el valor de Z' },
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

export function SurfaceConfigPanel({
  config,
  onChange,
  onCreate,
  created,
  derived,
  blockedReason,
}: SurfaceConfigPanelProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '20px 22px' }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
          Configura tu gráfica 3D
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>
          Se dibujará la nube de puntos (x, y, z). La superficie aparece encima
          cuando ajustes un modelo desde el menú <b>Análisis</b>.
        </div>

        {/* Puntos */}
        <div style={label}>Cómo se ven los puntos medidos</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 8,
            marginBottom: 14,
          }}
        >
          {POINT_STYLES.map((s) => {
            const active = config.pointStyle === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onChange({ pointStyle: s.id })}
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
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{s.desc}</div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ ...label, fontWeight: 400, fontSize: 11.5 }}>
              Tamaño de los puntos: {config.pointSize}
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={config.pointSize}
              onChange={(e) => onChange({ pointSize: Number(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>
          <div>
            <div style={{ ...label, fontWeight: 400, fontSize: 11.5 }}>
              Opacidad de la superficie: {Math.round(config.surfaceOpacity * 100)}%
            </div>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={Math.round(config.surfaceOpacity * 100)}
              onChange={(e) => onChange({ surfaceOpacity: Number(e.target.value) / 100 })}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>
        </div>

        {/* Escala de color */}
        <div style={label}>Escala de color de la superficie</div>
        <select
          value={config.colorscale}
          onChange={(e) => onChange({ colorscale: e.target.value })}
          style={{ ...input, marginBottom: 20, cursor: 'pointer' }}
        >
          {COLORSCALES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Etiquetas */}
        <div style={label}>Títulos y etiquetas de los ejes</div>
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
              placeholder={derived.x}
              style={input}
            />
          </div>
          <div>
            <div style={{ ...label, fontWeight: 400, fontSize: 11.5 }}>Etiqueta del eje Y</div>
            <input
              value={config.yLabel}
              onChange={(e) => onChange({ yLabel: e.target.value })}
              placeholder={derived.y}
              style={input}
            />
          </div>
          <div>
            <div style={{ ...label, fontWeight: 400, fontSize: 11.5 }}>Etiqueta del eje Z</div>
            <input
              value={config.zLabel}
              onChange={(e) => onChange({ zLabel: e.target.value })}
              placeholder={derived.z}
              style={input}
            />
          </div>
          <div>
            <div style={{ ...label, fontWeight: 400, fontSize: 11.5 }}>Título de la gráfica</div>
            <input
              value={config.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder={`${derived.z} frente a ${derived.x} e ${derived.y}`}
              style={input}
            />
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 18 }}>
          Si lo dejas en blanco se usa el nombre de la columna.
        </div>

        {/* Opciones */}
        <div style={{ display: 'flex', gap: 18, marginBottom: 22, flexWrap: 'wrap' }}>
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
              checked={config.showColorbar}
              onChange={(e) => onChange({ showColorbar: e.target.checked })}
            />
            Mostrar barra de color
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
