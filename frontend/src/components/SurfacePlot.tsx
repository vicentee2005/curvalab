// Escena 3D: nube de puntos medidos + superficie ajustada.
//
// La escena es libremente rotable (arrastrar gira, rueda acerca, botón derecho
// desplaza). La cámara del usuario se guarda en un ref y se vuelve a aplicar en
// cada redibujado, de modo que ajustar una superficie o cambiar un color NO
// devuelve la vista a su posición inicial. Esa misma cámara es la que sale en
// la imagen exportada.
import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import type { Camera3D, Surface3DConfig, SurfaceFitResult } from '../types';
import type { SurfaceData } from '../lib/surfaceData';

/** Perspectiva inicial (y a la que vuelve el botón "Reajustar vista"). */
export const DEFAULT_CAMERA: Camera3D = {
  eye: { x: 1.6, y: -1.7, z: 0.9 },
  up: { x: 0, y: 0, z: 1 },
  center: { x: 0, y: 0, z: 0 },
};

interface SurfacePlotProps {
  data: SurfaceData;
  fit: SurfaceFitResult | null;
  config: Surface3DConfig;
  labels: { x: string; y: string; z: string };
  isDark: boolean;
  accent: string;
  /** Cámara actual: la escribe esta escena y la lee quien exporta o guarda. */
  cameraRef: React.MutableRefObject<Camera3D | null>;
  /** El <div> de Plotly, para exportar la imagen desde la cabecera. */
  plotRef: React.MutableRefObject<HTMLDivElement | null>;
}

export function SurfacePlot({
  data,
  fit,
  config,
  labels,
  isDark,
  accent,
  cameraRef,
  plotRef,
}: SurfacePlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listening = useRef(false);

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

    const traces: Partial<Plotly.PlotData>[] = [];

    // La superficie va primero para que los puntos queden dibujados encima.
    if (fit) {
      traces.push({
        type: 'surface',
        x: fit.grid_x,
        y: fit.grid_y,
        z: fit.grid_z,
        colorscale: config.colorscale,
        opacity: config.surfaceOpacity,
        showscale: config.showColorbar,
        name: fit.equation,
        hovertemplate:
          `${labels.x}: %{x:.4g}<br>${labels.y}: %{y:.4g}<br>` +
          `${labels.z} ajustado: %{z:.4g}<extra></extra>`,
        colorbar: {
          thickness: 12,
          len: 0.62,
          outlinewidth: 0,
          tickfont: { size: 10, color: muted },
        },
        contours: {
          z: { show: false },
        },
      } as any);
    }

    traces.push({
      type: 'scatter3d',
      mode: 'markers',
      x: data.x,
      y: data.y,
      z: data.z,
      name: 'Datos medidos',
      marker:
        config.pointStyle === 'byZ'
          ? {
              size: config.pointSize,
              color: data.z,
              colorscale: config.colorscale,
              showscale: false,
              line: { width: 0 },
            }
          : {
              size: config.pointSize,
              color: accent,
              line: { width: 0 },
            },
      hovertemplate:
        `${labels.x}: %{x:.4g}<br>${labels.y}: %{y:.4g}<br>` +
        `${labels.z}: %{z:.4g}<extra></extra>`,
    } as any);

    const axis = (text: string) => ({
      title: { text, font: { size: 12, color: muted } },
      showgrid: config.showGrid,
      gridcolor: gridColor,
      zerolinecolor: gridColor,
      backgroundcolor: plotBg,
      showbackground: true,
      color: muted,
    });

    const layout: Partial<Plotly.Layout> = {
      paper_bgcolor: plotBg,
      plot_bgcolor: plotBg,
      font: { family: 'IBM Plex Sans, sans-serif', color: ink, size: 12 },
      margin: { l: 0, r: 0, t: 0, b: 0 },
      showlegend: false,
      autosize: true,
      scene: {
        xaxis: axis(labels.x),
        yaxis: axis(labels.y),
        zaxis: axis(labels.z),
        // Caja regular: los tres ejes suelen tener unidades distintas, así que
        // respetar sus proporciones reales deformaría la escena.
        aspectmode: 'cube',
        // Restaurar la cámara del usuario en cada redibujado.
        camera: cameraRef.current ?? DEFAULT_CAMERA,
      },
    } as any;

    Plotly.react(el, traces, layout, {
      responsive: true,
      displayModeBar: false,
      // scrollZoom deja usar la rueda para acercarse sin barra de herramientas.
      scrollZoom: true,
    }).then(() => {
      if (listening.current) return;
      listening.current = true;
      // Cada vez que el usuario gira o acerca, Plotly emite relayout con la
      // cámara nueva: la guardamos para no perder la perspectiva.
      (el as any).on?.('plotly_relayout', (ev: any) => {
        const cam = ev?.['scene.camera'] ?? (el as any).layout?.scene?.camera;
        if (cam?.eye) cameraRef.current = cam as Camera3D;
      });
    });
  }, [data, fit, config, labels, isDark, accent, cameraRef, plotRef]);

  // Al desmontar, soltar los listeners y la escena WebGL.
  useEffect(() => {
    const el = containerRef.current;
    return () => {
      if (el) {
        (el as any).removeAllListeners?.('plotly_relayout');
        Plotly.purge(el as any);
      }
      listening.current = false;
    };
  }, []);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
