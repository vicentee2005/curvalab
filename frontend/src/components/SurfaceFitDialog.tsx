// Diálogos del entorno 3D: grado del polinomio 2D y fórmula propia z = f(x,y).
// Reutilizan el modal y los estilos del entorno 2D para que ambos se sientan
// como la misma aplicación.
import { useState } from 'react';
import { Modal, inputStyle, labelStyle } from './FitDialog';

interface SurfaceDegreeDialogProps {
  onCancel: () => void;
  onConfirm: (degree: number) => void;
}

/** Nº de coeficientes de un polinomio 2D completo de grado n: (n+1)(n+2)/2. */
const nTerms = (n: number) => ((n + 1) * (n + 2)) / 2;

export function SurfaceDegreeDialog({ onCancel, onConfirm }: SurfaceDegreeDialogProps) {
  const [degree, setDegree] = useState(2);
  return (
    <Modal title="Superficie polinómica" onCancel={onCancel} onConfirm={() => onConfirm(degree)}>
      <label style={labelStyle}>Grado del polinomio</label>
      <input
        type="number"
        min={1}
        max={6}
        value={degree}
        onChange={(e) => setDegree(Math.min(6, Math.max(1, parseInt(e.target.value, 10) || 1)))}
        style={inputStyle}
      />
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
        Se ajusta z = Σ c<sub>ij</sub>·x<sup>i</sup>·y<sup>j</sup> con i + j ≤ {degree}:{' '}
        <b>{nTerms(degree)} coeficientes</b>. Grado 1 es un plano; grado 2 da
        paraboloides y sillas de montar.
      </div>
      {degree >= 4 && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            background: 'var(--row)',
            border: '1px solid var(--line)',
            borderLeft: '3px solid var(--secondary)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--muted2)',
            lineHeight: 1.5,
          }}
        >
          Con grado {degree} son {nTerms(degree)} coeficientes: necesitas bastantes
          más puntos que eso y la superficie puede ondularse siguiendo el ruido en
          vez de la física.
        </div>
      )}
    </Modal>
  );
}

interface SurfaceCustomDialogProps {
  onCancel: () => void;
  onConfirm: (expression: string, parameters: string[], initialGuess?: number[]) => void;
}

export function SurfaceCustomDialog({ onCancel, onConfirm }: SurfaceCustomDialogProps) {
  const [expr, setExpr] = useState('a*x**2 + b*y**2 + c');
  const [paramsText, setParamsText] = useState('a, b, c');
  const [guessText, setGuessText] = useState('');

  const params = paramsText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const valid = expr.trim().length > 0 && params.length > 0;

  const guess = guessText
    .split(',')
    .map((s) => Number(s.trim().replace(',', '.')))
    .filter((v) => Number.isFinite(v));
  const guessUsable = guess.length === params.length ? guess : undefined;

  // Si la fórmula no menciona ni x ni y no describe una superficie, sino un
  // plano horizontal constante.
  const usesVar = /\b[xy]\b/.test(expr);

  return (
    <Modal
      title="Superficie con fórmula propia"
      onCancel={onCancel}
      onConfirm={() => onConfirm(expr.trim(), params, guessUsable)}
      confirmDisabled={!valid}
    >
      <label style={labelStyle}>Fórmula &nbsp;(usa x e y como variables)</label>
      <input
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        placeholder="a*sin(k*x)*cos(k*y)"
        className="mono"
        style={{ ...inputStyle, fontFamily: 'IBM Plex Mono, monospace' }}
      />
      <label style={{ ...labelStyle, marginTop: 14 }}>
        Parámetros a ajustar (separados por comas)
      </label>
      <input
        value={paramsText}
        onChange={(e) => setParamsText(e.target.value)}
        placeholder="a, b, c"
        className="mono"
        style={{ ...inputStyle, fontFamily: 'IBM Plex Mono, monospace' }}
      />
      <label style={{ ...labelStyle, marginTop: 14 }}>
        Estimación inicial <span style={{ fontWeight: 400 }}>(opcional)</span>
      </label>
      <input
        value={guessText}
        onChange={(e) => setGuessText(e.target.value)}
        placeholder={params.map(() => '1').join(', ') || '1, 1, 1'}
        className="mono"
        style={{ ...inputStyle, fontFamily: 'IBM Plex Mono, monospace' }}
      />
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
        Normalmente no hace falta: se prueban varios puntos de partida
        automáticamente.
      </div>

      {!usesVar && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            background: 'var(--row)',
            border: '1px solid var(--line)',
            borderLeft: '3px solid var(--secondary)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--muted2)',
            lineHeight: 1.5,
          }}
        >
          Tu fórmula no usa <span className="mono">x</span> ni{' '}
          <span className="mono">y</span>: saldría una superficie plana y
          horizontal. Añade al menos una de las dos variables.
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, lineHeight: 1.5 }}>
        Funciones disponibles: sin, cos, tan, exp, log/ln, sqrt, abs, sinh, cosh,
        tanh, y constantes pi, E. Ejemplos:{' '}
        <span className="mono">a*x + b*y + c*x*y</span>,{' '}
        <span className="mono">a*exp(-(x**2 + y**2)/b)</span>.
      </div>
    </Modal>
  );
}
