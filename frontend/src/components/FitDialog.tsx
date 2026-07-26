// Diálogos modales para configurar un ajuste que necesita parámetros extra:
// grado del polinomio, o fórmula propia + lista de parámetros.
import { useState } from 'react';

interface BaseModalProps {
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
}

export function Modal({ title, onCancel, children, onConfirm, confirmLabel, confirmDisabled }: BaseModalProps) {
  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,20,0.34)', zIndex: 80 }}
      />
      <div
        className="pop-in"
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(420px, 92vw)',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: '0 20px 50px rgba(16,24,40,0.32)',
          zIndex: 90,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line-soft)' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
        </div>
        <div style={{ padding: '18px 20px' }}>{children}</div>
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '14px 20px',
            borderTop: '1px solid var(--line-soft)',
          }}
        >
          <button
            onClick={onCancel}
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
            Cancelar
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={{
              background: confirmDisabled ? 'var(--row2)' : 'var(--accent)',
              border: 'none',
              color: confirmDisabled ? 'var(--muted)' : 'var(--on-accent)',
              padding: '9px 20px',
              borderRadius: 9,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: confirmDisabled ? 'default' : 'pointer',
            }}
          >
            {confirmLabel ?? 'Ajustar'}
          </button>
        </div>
      </div>
    </>
  );
}

export const inputStyle = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  background: 'var(--row)',
  color: 'var(--ink)',
  fontSize: 14,
} as const;

export const labelStyle = {
  display: 'block',
  fontSize: 12.5,
  color: 'var(--muted2)',
  marginBottom: 6,
  fontWeight: 600,
} as const;

interface DegreeDialogProps {
  onCancel: () => void;
  onConfirm: (degree: number) => void;
}

export function DegreeDialog({ onCancel, onConfirm }: DegreeDialogProps) {
  const [degree, setDegree] = useState(2);
  return (
    <Modal title="Ajuste polinómico" onCancel={onCancel} onConfirm={() => onConfirm(degree)}>
      <label style={labelStyle}>Grado del polinomio</label>
      <input
        type="number"
        min={1}
        max={15}
        value={degree}
        onChange={(e) => setDegree(Math.min(15, Math.max(1, parseInt(e.target.value, 10) || 1)))}
        style={inputStyle}
      />
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
        Grado 1 = recta, 2 = parábola, etc. Se ajusta y = c₀ + c₁·x + … + c
        <sub>n</sub>·xⁿ.
      </div>
    </Modal>
  );
}

interface CustomDialogProps {
  onCancel: () => void;
  onConfirm: (expression: string, parameters: string[], initialGuess?: number[]) => void;
}

export function CustomDialog({ onCancel, onConfirm }: CustomDialogProps) {
  const [expr, setExpr] = useState('a*exp(-b*x) + c');
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

  // Un modelo periódico sin término de fase no puede ajustar datos que no
  // empiecen en cero: conviene avisar antes de que el ajuste salga plano.
  const periodic = /\b(sin|cos)\s*\(/.test(expr);
  const hasPhase = params.length >= 3 || /[+-]\s*\w+\s*\)/.test(expr);
  const phaseWarning = periodic && !hasPhase;

  return (
    <Modal
      title="Ajuste no lineal (fórmula propia)"
      onCancel={onCancel}
      onConfirm={() => onConfirm(expr.trim(), params, guessUsable)}
      confirmDisabled={!valid}
    >
      <label style={labelStyle}>Fórmula &nbsp;(usa x como variable)</label>
      <input
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        placeholder="a*sin(b*x + c)"
        className="mono"
        style={{ ...inputStyle, fontFamily: 'IBM Plex Mono, monospace' }}
      />
      <label style={{ ...labelStyle, marginTop: 14 }}>Parámetros a ajustar (separados por comas)</label>
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
        Normalmente no hace falta: la app prueba varios puntos de partida
        automáticamente. Úsala solo si un ajuste difícil no converge.
      </div>

      {phaseWarning && (
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
          Tu modelo es periódico pero no tiene término de <b>fase</b>. Si los
          datos no empiezan justo donde lo hace la función, ningún valor de los
          parámetros podrá ajustarlos. Prueba con algo como{' '}
          <span className="mono">a*sin(b*x + c)</span> o{' '}
          <span className="mono">a*cos(k*x)</span>.
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, lineHeight: 1.5 }}>
        Funciones disponibles: sin, cos, tan, exp, log/ln, sqrt, abs, sinh, cosh,
        tanh, y constantes pi, E. Ejemplo: <span className="mono">a*exp(-b*x)+c</span>.
      </div>
    </Modal>
  );
}
