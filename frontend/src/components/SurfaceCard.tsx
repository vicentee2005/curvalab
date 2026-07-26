// Tarjeta central del entorno 3D: pestañas "Gráfica" (configuración) | "Escena".
// Igual que en el 2D, importar datos no dibuja nada: hay que crear la gráfica.
import type { PlotView, Camera3D, Surface3DConfig, SurfaceFitResult } from '../types';
import type { SurfaceData } from '../lib/surfaceData';
import { SurfaceConfigPanel } from './SurfaceConfigPanel';
import { SurfacePlot } from './SurfacePlot';

interface SurfaceCardProps {
  data: SurfaceData | null;
  blockedReason: string | null;
  fit: SurfaceFitResult | null;
  config: Surface3DConfig;
  onConfigChange: (patch: Partial<Surface3DConfig>) => void;
  view: PlotView;
  onView: (v: PlotView) => void;
  created: boolean;
  onCreate: () => void;
  derived: { x: string; y: string; z: string };
  labels: { x: string; y: string; z: string };
  title: string;
  isDark: boolean;
  accent: string;
  cameraRef: React.MutableRefObject<Camera3D | null>;
  plotRef: React.MutableRefObject<HTMLDivElement | null>;
  onExport: () => void;
  onResetView: () => void;
  /** Resalta la tarjeta durante la guía de inicio. */
  ring?: boolean;
}

export function SurfaceCard({
  data,
  blockedReason,
  fit,
  config,
  onConfigChange,
  view,
  onView,
  created,
  onCreate,
  derived,
  labels,
  title,
  isDark,
  accent,
  cameraRef,
  plotRef,
  onExport,
  onResetView,
  ring,
}: SurfaceCardProps) {
  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--on-accent)' : 'var(--muted2)',
    border: 'none',
    padding: '7px 16px',
    borderRadius: 7,
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.18)' : 'none',
  });

  const iconBtn: React.CSSProperties = {
    height: 34,
    padding: '0 13px',
    background: 'var(--row)',
    border: '1px solid var(--line)',
    borderRadius: 8,
    color: 'var(--muted2)',
    fontSize: 13,
    cursor: 'pointer',
  };

  const showingPlot = view === 'plot' && created && data;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        overflow: 'hidden',
        position: 'relative',
        zIndex: ring ? 60 : 'auto',
        boxShadow: ring
          ? '0 0 0 3px var(--accent), 0 0 0 10px var(--accent-soft)'
          : '0 1px 3px rgba(16,24,40,.05)',
      }}
    >
      {/* Cabecera */}
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
          <button onClick={() => onView('config')} style={tabStyle(view === 'config')}>
            Gráfica
          </button>
          <button onClick={() => onView('plot')} style={tabStyle(view === 'plot')}>
            Escena 3D
          </button>
        </div>
        <div
          style={{
            fontWeight: 600,
            fontSize: 15,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {view === 'config' ? 'Configuración' : title}
        </div>
        <div style={{ flex: 1 }} />
        {showingPlot && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button title="Volver a la perspectiva inicial" onClick={onResetView} style={iconBtn}>
              Reajustar vista
            </button>
            <button
              title="Guarda un PNG con la perspectiva que estás viendo ahora"
              onClick={onExport}
              style={iconBtn}
            >
              Exportar imagen
            </button>
          </div>
        )}
      </div>

      {/* Cuerpo */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: 'var(--plot-bg)' }}>
        {view === 'config' ? (
          <SurfaceConfigPanel
            config={config}
            onChange={onConfigChange}
            onCreate={onCreate}
            created={created}
            derived={derived}
            blockedReason={blockedReason}
          />
        ) : created && data ? (
          <>
            <SurfacePlot
              data={data}
              fit={fit}
              config={config}
              labels={labels}
              isDark={isDark}
              accent={accent}
              cameraRef={cameraRef}
              plotRef={plotRef}
            />
            <div
              style={{
                position: 'absolute',
                left: 14,
                bottom: 12,
                fontSize: 11.5,
                color: 'var(--muted)',
                background: 'var(--panel)',
                border: '1px solid var(--line-soft)',
                borderRadius: 7,
                padding: '5px 9px',
                pointerEvents: 'none',
                opacity: 0.9,
              }}
            >
              Arrastra para girar · rueda para acercar · botón derecho para desplazar
            </div>
          </>
        ) : (
          <EmptyState onGoConfig={() => onView('config')} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ onGoConfig }: { onGoConfig: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}
      >
        ◱
      </div>
      <div style={{ fontWeight: 600, fontSize: 15 }}>Todavía no hay ninguna gráfica</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, maxWidth: 400 }}>
        Los datos ya están en la hoja. Ve a la pestaña <b>Gráfica</b> para elegir
        cómo representarlos y crearla.
      </div>
      <button
        onClick={onGoConfig}
        style={{
          marginTop: 4,
          padding: '10px 18px',
          borderRadius: 9,
          border: 'none',
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          fontSize: 13.5,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Ir a la pestaña Gráfica
      </button>
    </div>
  );
}
