// Histograma de la simulación Monte Carlo, con la gaussiana analítica encima.
//
// La gracia de superponerlas es ver de un vistazo si la fórmula de propagación
// clásica describe bien la salida: si el histograma es simétrico y la campana
// lo abraza, las dos vías coinciden; si aparece cola por un lado, la buena es
// la simulación.
import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import type { MonteCarloResult } from '../types';

interface MonteCarloPlotProps {
  mc: MonteCarloResult;
  /** Valor y σ del cálculo analítico, para dibujar la campana de referencia. */
  value: number;
  uncertainty: number;
  label: string;
  isDark: boolean;
  accent: string;
  plotRef: React.MutableRefObject<HTMLDivElement | null>;
}

export function MonteCarloPlot({
  mc,
  value,
  uncertainty,
  label,
  isDark,
  accent,
  plotRef,
}: MonteCarloPlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    plotRef.current = el;

    const cs = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) =>
      cs.getPropertyValue(name).trim() || fallback;
    const plotBg = v('--plot-bg', isDark ? '#171b21' : '#ffffff');
    const gridColor = v('--grid', isDark ? '#242a33' : '#f0f2f6');
    const ink = v('--ink', isDark ? '#e8eaee' : '#1a1d23');
    const muted = v('--muted', '#8b93a1');

    // Centros de cada barra y anchura común.
    const edges = mc.hist_edges;
    const centers = mc.hist_counts.map((_, i) => (edges[i] + edges[i + 1]) / 2);
    const width = edges.length > 1 ? edges[1] - edges[0] : 1;

    const traces: Partial<Plotly.PlotData>[] = [
      {
        type: 'bar',
        x: centers,
        y: mc.hist_counts,
        name: `${mc.samples.toLocaleString('es-ES')} simulaciones`,
        marker: { color: accent, opacity: 0.55, line: { width: 0 } },
        hovertemplate: `${label} ≈ %{x:.6g}<br>%{y} muestras<extra></extra>`,
      } as any,
    ];

    // Campana analítica escalada al área del histograma, para compararlas.
    if (uncertainty > 0 && Number.isFinite(uncertainty)) {
      const total = mc.hist_counts.reduce((a, b) => a + b, 0);
      const n = 160;
      const lo = Math.min(edges[0], value - 4 * uncertainty);
      const hi = Math.max(edges[edges.length - 1], value + 4 * uncertainty);
      const gx: number[] = [];
      const gy: number[] = [];
      for (let i = 0; i < n; i++) {
        const x = lo + ((hi - lo) * i) / (n - 1);
        const z = (x - value) / uncertainty;
        gx.push(x);
        gy.push(
          (total * width * Math.exp(-0.5 * z * z)) /
            (uncertainty * Math.sqrt(2 * Math.PI)),
        );
      }
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: gx,
        y: gy,
        name: 'Gaussiana analítica',
        line: { color: '#e8663d', width: 2.5 },
        hovertemplate: `${label} = %{x:.6g}<extra>fórmula analítica</extra>`,
      } as any);
    }

    const layout: Partial<Plotly.Layout> = {
      paper_bgcolor: plotBg,
      plot_bgcolor: plotBg,
      font: { family: 'IBM Plex Sans, sans-serif', color: ink, size: 12 },
      margin: { l: 54, r: 16, t: 10, b: 44 },
      bargap: 0.02,
      showlegend: true,
      legend: { orientation: 'h', y: 1.12, x: 0, font: { size: 11 } },
      xaxis: {
        title: { text: label, font: { size: 12, color: muted } },
        gridcolor: gridColor,
        zerolinecolor: gridColor,
        color: muted,
      },
      yaxis: {
        title: { text: 'Nº de simulaciones', font: { size: 12, color: muted } },
        gridcolor: gridColor,
        zerolinecolor: gridColor,
        color: muted,
      },
      // Intervalo de confianza de la simulación: la franja donde cae el 95 %.
      shapes: [
        {
          type: 'rect',
          xref: 'x',
          yref: 'paper',
          x0: mc.p_low,
          x1: mc.p_high,
          y0: 0,
          y1: 1,
          fillcolor: accent,
          opacity: 0.08,
          line: { width: 0 },
          layer: 'below',
        },
        {
          type: 'line',
          xref: 'x',
          yref: 'paper',
          x0: value,
          x1: value,
          y0: 0,
          y1: 1,
          line: { color: '#e8663d', width: 1.5, dash: 'dash' },
        },
      ],
    } as any;

    Plotly.react(el, traces, layout, {
      responsive: true,
      displayModeBar: false,
    });
  }, [mc, value, uncertainty, label, isDark, accent, plotRef]);

  useEffect(() => {
    const el = containerRef.current;
    return () => {
      if (el) Plotly.purge(el as any);
    };
  }, []);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
