// Guía de inicio rápido: 4 pasos con tarjeta inferior. El resaltado de cada
// región se hace desde App (pasando `ring` a cada panel según el paso).
export interface TourStep {
  title: string;
  desc: string;
}

interface TourProps {
  step: number; // 0..3
  onNext: () => void;
  onStop: () => void;
  /** Pasos a describir. Por defecto, los del entorno 2D. */
  steps?: TourStep[];
}

/** Guía del entorno 3D: las mismas cuatro zonas, contadas en su idioma. */
export const TOUR_STEPS_3D: TourStep[] = [
  {
    title: 'Barra de herramientas',
    desc: 'Menús Archivo, Vista, Análisis y Ayuda. Desde Vista cambias la perspectiva (planta, alzado, perfil) y desde Archivo exportas la imagen.',
  },
  {
    title: 'Escena 3D',
    desc: 'Aquí se dibuja la nube de puntos y la superficie ajustada. Arrastra para girar, rueda para acercar y botón derecho para desplazar: el PNG sale con la perspectiva que estés viendo.',
  },
  {
    title: 'Hoja de datos',
    desc: 'Introduce valores a mano, renombra columnas y asígnales X, Y o Z. Este entorno trabaja sin barras de error, así que solo hay tres roles.',
  },
  {
    title: 'Resultados del ajuste',
    desc: 'Tras ajustar una superficie verás aquí sus coeficientes, la incertidumbre de cada uno, el R² y el RMSE.',
  },
];

/** Guía del entorno de propagación de incertidumbres. */
export const TOUR_STEPS_UNC: TourStep[] = [
  {
    title: 'Barra de herramientas',
    desc: 'Menús Archivo, Cálculo y Ayuda. Desde Cálculo cambias entre medida única y cálculo por filas, y mandas el resultado al entorno 2D.',
  },
  {
    title: 'Fórmula y variables',
    desc: 'Escribe aquí la fórmula de tu magnitud indirecta. La tabla de variables se construye sola: el backend deriva la expresión con SymPy y te dice qué magnitudes necesita.',
  },
  {
    title: 'Hoja de datos',
    desc: 'En el modo «por filas» cada variable se engancha a una columna y se obtiene un resultado por fila. Una variable sin columna es una constante.',
  },
  {
    title: 'Resultado',
    desc: 'El valor con su incertidumbre ya redondeada, el desglose de qué medida aporta más error y la comprobación por Monte Carlo.',
  },
];

const STEPS: TourStep[] = [
  {
    title: 'Barra de herramientas',
    desc: 'Aquí tienes los menús Archivo, Gráfico, Análisis y Ayuda con todas las acciones de la app.',
  },
  {
    title: 'Área de la gráfica',
    desc: 'El espacio principal muestra tu gráfica. Cambia entre vista 2D y 3D con las pestañas de la esquina superior.',
  },
  {
    title: 'Hoja de datos',
    desc: 'Introduce valores a mano, renombra columnas y asígnales un rol (X, Y, Z o error). Puedes añadir o eliminar columnas cuando quieras.',
  },
  {
    title: 'Resultados del análisis',
    desc: 'Tras un ajuste verás aquí los parámetros y su incertidumbre. Elige las cifras significativas de cada valor.',
  },
];

export function Tour({ step, onNext, onStop, steps = STEPS }: TourProps) {
  const cur = steps[step] ?? steps[0];
  const isLast = step === steps.length - 1;

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,20,0.34)', zIndex: 54 }}
      />
      <div
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 36,
          transform: 'translateX(-50%)',
          width: 'min(440px, 92vw)',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: '0 20px 50px rgba(16,24,40,0.32)',
          zIndex: 70,
          overflow: 'hidden',
        }}
      >
        <div style={{ height: 4, background: 'var(--accent)' }} />
        <div style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: 9 }}>
            <span
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--accent)',
                background: 'var(--accent-soft)',
                padding: '3px 9px',
                borderRadius: 20,
              }}
            >
              Guía · paso {step + 1} de {steps.length}
            </span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>{cur.title}</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted2)', lineHeight: 1.55 }}>
            {cur.desc}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
            <button
              onClick={onStop}
              style={{
                background: 'transparent',
                border: '1px solid var(--line)',
                color: 'var(--muted2)',
                padding: '9px 15px',
                borderRadius: 9,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Detener guía
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={onNext}
              style={{
                background: 'var(--accent)',
                border: 'none',
                color: 'var(--on-accent)',
                padding: '9px 20px',
                borderRadius: 9,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isLast ? 'Finalizar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
