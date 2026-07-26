// Tarjeta central: pestañas "Gráfica" (configuración) | 2D | 3D.
// La gráfica NO se dibuja hasta que el usuario la crea desde la pestaña
// "Gráfica": al importar datos solo se rellenan las columnas.
import { useEffect, useMemo, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import type {
  ChartConfig,
  Column,
  Dimension,
  FitResult,
  PlotView,
} from '../types';
import { extractFitData, isExtractError } from '../lib/fitData';
import { ChartConfigPanel } from './ChartConfigPanel';

interface PlotCardProps {
  columns: Column[];
  dimension: Dimension;
  onDimension: (d: Dimension) => void;
  view: PlotView;
  onView: (v: PlotView) => void;
  config: ChartConfig;
  onConfigChange: (patch: Partial<ChartConfig>) => void;
  created: boolean;
  onCreate: () => void;
  fit: FitResult | null;
  isDark: boolean;
  accent: string;
  ring?: boolean;
  plotRef: React.MutableRefObject<HTMLDivElement | null>;
}

const SECONDARY = '#e8663d';

export function PlotCard({
  columns,
  dimension,
  onDimension,
  view,
  onView,
  config,
  onConfigChange,
  created,
  onCreate,
  fit,
  isDark,
  accent,
  ring,
  plotRef,
}: PlotCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Nombres derivados de las columnas (fallback de las etiquetas).
  const derivedX = columns.find((c) => c.role === 'x')?.name || 'X';
  const derivedY = columns.find((c) => c.role === 'y')?.name || 'Y';
  const xLabel = config.xLabel.trim() || derivedX;
  const yLabel = config.yLabel.trim() || derivedY;
  const zLabel = config.zLabel.trim() || 'Z';
  const title = config.title.trim() || `${derivedY} frente a ${derivedX}`;
  const seriesName = config.seriesName.trim() || derivedY;

  // ¿Se puede crear la gráfica? (hacen falta roles asignados)
  const data = useMemo(() => extractFitData(columns), [columns]);
  const dataError = isExtractError(data) ? data.message : null;
  const has3D =
    !isExtractError(data) &&
    !!(data as any).z &&
    (data as any).z.some((v: number) => Number.isFinite(v));
  const blockedReason =
    dataError ??
    (dimension === '3d' && !has3D
      ? 'Para una gráfica 3D asigna también el rol Z a una columna.'
      : null);

  const themeColors = useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string) => cs.getPropertyValue(name).trim();
    return {
      plotBg: v('--plot-bg') || (isDark ? '#171b21' : '#ffffff'),
      grid: v('--grid') || (isDark ? '#242a33' : '#f0f2f6'),
      axis: v('--axis') || (isDark ? '#3a4048' : '#c9cdd6'),
      ink: v('--ink') || (isDark ? '#e8eaee' : '#1a1d23'),
      muted: v('--muted') || '#8b93a1',
    };
  }, [isDark, accent]);

  useEffect(() => {
    const el = containerRef.current;
    // Solo dibujamos si estamos en la vista de gráfica y ya se ha creado.
    if (!el || view !== 'plot' || !created) return;
    plotRef.current = el;

    const hasData = !isExtractError(data);
    const d = hasData ? (data as any) : null;

    const layoutBase: Partial<Plotly.Layout> = {
      paper_bgcolor: themeColors.plotBg,
      plot_bgcolor: themeColors.plotBg,
      font: { family: 'IBM Plex Sans, sans-serif', color: themeColors.ink, size: 12 },
      margin: { l: 62, r: 20, t: 16, b: 50 },
      showlegend: config.showLegend,
      legend: {
        x: 1,
        xanchor: 'right',
        y: 1,
        bgcolor: 'rgba(0,0,0,0)',
        font: { size: 12 },
      },
      autosize: true,
    };

    // ---------------- 3D ---------------- //
    if (dimension === '3d') {
      const traces: Partial<Plotly.PlotData>[] = [];
      if (d && d.z) {
        traces.push({
          type: 'scatter3d',
          mode: config.type === 'lines' ? 'lines' : 'markers',
          x: d.x,
          y: d.y,
          z: d.z,
          marker: { size: 4, color: accent },
          line: { color: accent, width: 3 },
          name: seriesName,
        } as any);
      }
      const axis3d = (t: string) => ({
        title: { text: t },
        gridcolor: themeColors.grid,
        showgrid: config.showGrid,
        backgroundcolor: themeColors.plotBg,
        color: themeColors.muted,
      });
      Plotly.react(
        el,
        traces,
        {
          ...layoutBase,
          scene: {
            xaxis: axis3d(xLabel),
            yaxis: axis3d(yLabel),
            zaxis: axis3d(zLabel),
          },
        } as any,
        { responsive: true, displayModeBar: false },
      );
      return;
    }

    // ---------------- 2D ---------------- //
    const traces: Partial<Plotly.PlotData>[] = [];
    if (d) {
      const errArray = (arr: number[] | null) =>
        arr && arr.some((v) => Number.isFinite(v))
          ? {
              type: 'data' as const,
              array: arr.map((v) => (Number.isFinite(v) ? v : 0)),
              visible: true,
              color: themeColors.muted,
              thickness: 1.2,
              width: 3,
            }
          : undefined;

      if (config.type === 'bars') {
        traces.push({
          type: 'bar',
          x: d.x,
          y: d.y,
          name: seriesName,
          marker: { color: accent },
          error_y: errArray(d.sy) as any,
        } as any);
      } else {
        const mode =
          config.type === 'lines'
            ? 'lines'
            : config.type === 'lines+markers'
              ? 'lines+markers'
              : 'markers';
        traces.push({
          type: 'scatter',
          mode,
          x: d.x,
          y: d.y,
          name: seriesName,
          marker: { size: 8, color: accent, line: { color: themeColors.plotBg, width: 1.5 } },
          line: { color: accent, width: 2 },
          error_y: errArray(d.sy) as any,
          error_x: errArray(d.sx) as any,
        } as any);
      }
    }

    if (fit) {
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: fit.curve_x,
        y: fit.curve_y,
        name: fit.equation,
        line: { color: SECONDARY, width: 2.5 },
      } as any);
    }

    const axis2d = (t: string) => ({
      title: { text: t, font: { size: 13, color: themeColors.muted } },
      gridcolor: themeColors.grid,
      showgrid: config.showGrid,
      zerolinecolor: themeColors.axis,
      linecolor: themeColors.axis,
      color: themeColors.muted,
    });

    Plotly.react(
      el,
      traces,
      { ...layoutBase, xaxis: axis2d(xLabel), yaxis: axis2d(yLabel) } as any,
      { responsive: true, displayModeBar: false },
    );
  }, [
    data, dimension, fit, themeColors, accent, xLabel, yLabel, zLabel,
    seriesName, config, view, created, plotRef,
  ]);

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

  const showingPlot = view === 'plot' && created;

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
          <button
            onClick={() => {
              onDimension('2d');
              onView('plot');
            }}
            style={tabStyle(view === 'plot' && dimension === '2d')}
          >
            2D
          </button>
          <button
            onClick={() => {
              onDimension('3d');
              onView('plot');
            }}
            style={tabStyle(view === 'plot' && dimension === '3d')}
          >
            3D
          </button>
        </div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>
          {view === 'config' ? 'Configuración' : title}
        </div>
        <div style={{ flex: 1 }} />
        {showingPlot && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              title="Restablecer vista"
              onClick={() => {
                const el = containerRef.current as any;
                if (el) Plotly.relayout(el, { 'xaxis.autorange': true, 'yaxis.autorange': true });
              }}
              style={iconBtn}
            >
              Reajustar
            </button>
            <button
              title="Exportar imagen PNG"
              onClick={() => {
                const el = containerRef.current as any;
                if (el)
                  Plotly.downloadImage(el, {
                    format: 'png',
                    filename: 'curvalab-grafica',
                    width: 1200,
                    height: 750,
                  });
              }}
              style={iconBtn}
            >
              Exportar
            </button>
          </div>
        )}
      </div>

      {/* Cuerpo */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: 'var(--plot-bg)' }}>
        {view === 'config' ? (
          <ChartConfigPanel
            config={config}
            onChange={onConfigChange}
            dimension={dimension}
            onDimension={onDimension}
            onCreate={onCreate}
            created={created}
            derivedX={derivedX}
            derivedY={derivedY}
            blockedReason={blockedReason}
          />
        ) : created ? (
          <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
        ) : (
          // Estado vacío: hay datos pero aún no se ha creado la gráfica.
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
              ⁘
            </div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Todavía no hay ninguna gráfica</div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--muted)',
                lineHeight: 1.55,
                maxWidth: 380,
              }}
            >
              Los datos ya están en la hoja. Ve a la pestaña <b>Gráfica</b> para
              elegir el tipo de representación y crearla.
            </div>
            <button
              onClick={() => onView('config')}
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
        )}
      </div>
    </div>
  );
}
