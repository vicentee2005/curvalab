// Asistente flotante: movible (arrastrando la cabecera) y redimensionable.
import { useRef, useState } from 'react';

export interface WizardStep {
  n: string;
  title: string;
  desc: string;
  primary?: boolean;
}

interface WizardProps {
  onClose: () => void;
  ring?: boolean;
  /** Título de la cabecera. Por defecto, el del entorno 2D. */
  title?: string;
  /** Pasos a mostrar. Por defecto, los del entorno 2D. */
  steps?: WizardStep[];
}

/** Pasos del entorno 3D: sin errores y con la escena rotable. */
export const WIZARD_STEPS_3D: WizardStep[] = [
  {
    n: '1',
    title: 'Introduce tus datos',
    desc: 'Escribe, pega o importa tres columnas de valores en la hoja de la derecha.',
    primary: true,
  },
  {
    n: '2',
    title: 'Asigna X, Y y Z',
    desc: 'Marca qué columna es cada coordenada. Aquí no hay columnas de error.',
  },
  {
    n: '3',
    title: 'Crea la escena',
    desc: 'En la pestaña Gráfica elige colores y pulsa «Crear gráfica». Gírala arrastrando.',
  },
  {
    n: '4',
    title: 'Ajusta una superficie',
    desc: 'Abre el menú Análisis y elige el modelo. La perspectiva que veas es la que se exporta.',
  },
];

/** Pasos del entorno de propagación de incertidumbres. */
export const WIZARD_STEPS_UNC: WizardStep[] = [
  {
    n: '1',
    title: 'Escribe la fórmula',
    desc: 'La de tu magnitud indirecta, p. ej. 4*pi**2*L/T**2. pi y e ya son constantes.',
    primary: true,
  },
  {
    n: '2',
    title: 'Rellena las variables',
    desc: 'La tabla aparece sola con lo que hayas usado. Pon el valor y su incertidumbre.',
  },
  {
    n: '3',
    title: 'Elige la distribución',
    desc: 'Normal si σ viene de medidas repetidas; rectangular si es la resolución del aparato.',
  },
  {
    n: '4',
    title: 'Propaga y compara',
    desc: 'Mira qué variable aporta más error y comprueba el resultado con Monte Carlo.',
  },
];

const STEPS: WizardStep[] = [
  {
    n: '1',
    title: 'Introduce tus datos',
    desc: 'Escribe, pega o importa valores en las columnas de la derecha.',
    primary: true,
  },
  {
    n: '2',
    title: 'Asigna los roles',
    desc: 'Marca qué columna es X, cuál es Y y cuáles son los errores.',
    primary: false,
  },
  {
    n: '3',
    title: 'Elige un ajuste',
    desc: 'Abre el menú Análisis y selecciona el modelo de curva.',
    primary: false,
  },
  {
    n: '4',
    title: 'Lee los resultados',
    desc: 'Los parámetros y su incertidumbre aparecen bajo la gráfica.',
    primary: false,
  },
];

export function Wizard({
  onClose,
  ring,
  title = 'Asistente: ajustar una curva',
  steps = STEPS,
}: WizardProps) {
  const [pos, setPos] = useState(() => ({
    x: 24,
    y: Math.max(24, window.innerHeight - 340),
    w: 340,
    h: 300,
  }));
  const drag = useRef<{ sx: number; sy: number; x: number; y: number } | null>(null);
  const resize = useRef<{ sx: number; sy: number; w: number; h: number } | null>(null);

  const onDragDown = (e: React.MouseEvent) => {
    e.preventDefault();
    drag.current = { sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y };
    const move = (ev: MouseEvent) => {
      if (!drag.current) return;
      setPos((p) => ({
        ...p,
        x: drag.current!.x + (ev.clientX - drag.current!.sx),
        y: drag.current!.y + (ev.clientY - drag.current!.sy),
      }));
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onResizeDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resize.current = { sx: e.clientX, sy: e.clientY, w: pos.w, h: pos.h };
    const move = (ev: MouseEvent) => {
      if (!resize.current) return;
      setPos((p) => ({
        ...p,
        w: Math.max(260, resize.current!.w + (ev.clientX - resize.current!.sx)),
        h: Math.max(180, resize.current!.h + (ev.clientY - resize.current!.sy)),
      }));
    };
    const up = () => {
      resize.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: pos.w,
        height: pos.h,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        overflow: 'hidden',
        zIndex: ring ? 60 : 50,
        boxShadow: ring
          ? '0 0 0 3px var(--accent), 0 0 0 10px var(--accent-soft)'
          : '0 18px 44px rgba(16,24,40,.24)',
      }}
    >
      <div
        onMouseDown={onDragDown}
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          cursor: 'move',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}
        >
          i
        </span>
        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{title}</div>
        <div style={{ flex: 1 }} />
        <span title="Arrastra para mover" style={{ fontSize: 14, opacity: 0.75, marginRight: 2 }}>
          ⠿
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'var(--on-accent)',
            width: 26,
            height: 26,
            borderRadius: 7,
            cursor: 'pointer',
            fontSize: 15,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 8px 12px' }}>
        {steps.map((step) => (
          <div
            key={step.n}
            className="hoverable"
            style={{ display: 'flex', gap: 12, padding: '11px 12px', borderRadius: 10 }}
          >
            <div
              className="mono"
              style={{
                flex: '0 0 24px',
                height: 24,
                borderRadius: '50%',
                background: step.primary ? 'var(--accent)' : 'var(--accent-soft)',
                color: step.primary ? 'var(--on-accent)' : 'var(--accent)',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {step.n}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{step.title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                {step.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        onMouseDown={onResizeDown}
        title="Arrastra para redimensionar"
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 18,
          height: 18,
          cursor: 'nwse-resize',
          borderRight: '2px solid var(--muted)',
          borderBottom: '2px solid var(--muted)',
          borderBottomRightRadius: 8,
        }}
      />
    </div>
  );
}
