// Portal de CurvaLab: desde aquí se entra a cada aplicación de laboratorio.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { checkHealth } from '../api';
import { useAppTheme } from '../hooks/useAppTheme';

export function Home() {
  const { theme, toggleTheme } = useAppTheme();
  // El backend es local: si no está arrancado conviene decirlo aquí y no
  // dejar que el usuario lo descubra al intentar ajustar.
  const [apiUp, setApiUp] = useState<boolean | null>(null);

  // El pie de página no puede prometer lo mismo en las dos situaciones: en
  // local los datos no salen del ordenador, desplegado sí viajan al servidor.
  const esLocal =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

  useEffect(() => {
    let vivo = true;
    checkHealth().then((ok) => {
      if (vivo) setApiUp(ok);
    });
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div
      style={{
        // Altura fija, no mínima: `body` lleva `overflow: hidden` para los
        // entornos 2D/3D, así que si el portal creciera por encima del viewport
        // lo recortaría el body y aquí no habría scroll. Con altura fija el
        // scroll ocurre dentro de este contenedor.
        height: '100vh',
        width: '100%',
        background: 'var(--bg)',
        color: 'var(--ink)',
        overflowY: 'auto',
      }}
    >
      {/* Barra superior mínima */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '18px 28px',
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        <Logo />
        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.2px' }}>CurvaLab</div>
        <div style={{ flex: 1 }} />
        <StatusPill up={apiUp} esLocal={esLocal} />
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          style={{
            width: 34,
            height: 34,
            background: 'var(--row)',
            color: 'var(--muted2)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            fontSize: 16,
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          ◐
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 28px 60px' }}>
        {/* Encabezado */}
        <div style={{ maxWidth: 700, marginBottom: 40 }}>
          <div
            style={{
              display: 'inline-block',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-line)',
              padding: '5px 11px',
              borderRadius: 20,
              marginBottom: 18,
            }}
          >
            Herramientas de análisis de laboratorio
          </div>
          <h1
            style={{
              fontSize: 40,
              lineHeight: 1.15,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              margin: '0 0 14px',
            }}
          >
            Elige la aplicación
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--muted2)', margin: 0 }}>
            Espacios independientes con su propio enlace y su propio fichero de
            proyecto. Ajusta <span className="mono">y = f(x)</span> con barras de error,
            ajusta superficies <span className="mono">z = f(x, y)</span> que puedes girar,
            o propaga las incertidumbres de tus medidas a la magnitud que calculas con
            ellas.
          </p>
        </div>

        {/* Las aplicaciones del portal */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 22,
          }}
        >
          <EnvCard
            to="/2d"
            art={<Art2D />}
            eyebrow="y = f(x)"
            title="Ajuste de curvas 2D"
            description="Nubes de puntos con incertidumbre en ambos ejes, ajuste ponderado y análisis del resultado."
            bullets={[
              'Lineal, polinómico, exponencial, logarítmico y potencial',
              'Fórmula propia con multi-arranque automático',
              'Barras de error en X e Y · χ²/ν · R² ajustado',
              'Hoja de datos que funciona como Excel',
            ]}
            cta="Abrir entorno 2D"
          />
          <EnvCard
            to="/3d"
            art={<Art3D />}
            eyebrow="z = f(x, y)"
            title="Superficies 3D"
            description="Tres columnas de puntos dispersos y una superficie ajustada que puedes girar libremente."
            bullets={[
              'Plano, polinomio 2D, gaussiana y fórmula propia',
              'Gira, acerca y desplaza la escena con el ratón',
              'La imagen se exporta con la perspectiva que veas',
              'Sin barras de error: entorno directo y cómodo',
            ]}
            cta="Abrir entorno 3D"
          />
          <EnvCard
            to="/incertidumbres"
            art={<ArtUnc />}
            eyebrow="σ_z = √Σ(∂f/∂x·σ_x)²"
            title="Propagación de errores"
            description="Escribe la fórmula de tu magnitud indirecta y la app deriva sola para propagar la incertidumbre."
            bullets={[
              'Derivación simbólica con SymPy: nada de derivar a mano',
              'Comprobación por Monte Carlo con hasta 500 000 muestras',
              'Distribución normal o rectangular (resolución del aparato)',
              'Qué medida aporta más error, y una fila por medida',
            ]}
            cta="Abrir incertidumbres"
          />
        </div>

        <div
          style={{
            marginTop: 34,
            fontSize: 12.5,
            color: 'var(--muted)',
            lineHeight: 1.6,
          }}
        >
          {esLocal ? (
            <>
              Herramienta local: los datos no salen de tu ordenador. Los cálculos los hace
              NumPy en el backend de <span className="mono">localhost:8000</span> y los
              proyectos se guardan como fichero <span className="mono">.json</span> en tu
              disco.
            </>
          ) : (
            <>
              Sin cuentas y sin base de datos. Los números que escribas viajan a una función
              serverless que los calcula con NumPy y responde: <b>no se guarda nada</b> en
              ningún servidor. Los proyectos se guardan como fichero{' '}
              <span className="mono">.json</span> en tu disco. Si prefieres que no salga
              nada de tu ordenador, el proyecto se puede clonar y ejecutar en local.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Piezas
// --------------------------------------------------------------------------- //
interface EnvCardProps {
  to: string;
  art: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
}

function EnvCard({ to, art, eyebrow, title, description, bullets, cta }: EnvCardProps) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      to={to}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        color: 'inherit',
        background: 'var(--panel)',
        border: '1px solid ' + (hover ? 'var(--accent-line)' : 'var(--line)'),
        borderRadius: 16,
        overflow: 'hidden',
        transform: hover ? 'translateY(-3px)' : 'none',
        boxShadow: hover
          ? '0 16px 36px rgba(16,24,40,.14)'
          : '0 1px 3px rgba(16,24,40,.05)',
        transition: 'transform .16s ease, box-shadow .16s ease, border-color .16s ease',
      }}
    >
      <div
        style={{
          height: 148,
          background: 'var(--plot-bg)',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {art}
      </div>
      <div style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          className="mono"
          style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 6 }}
        >
          {eyebrow}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--muted2)', lineHeight: 1.55, marginBottom: 16 }}>
          {description}
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'grid', gap: 8 }}>
          {bullets.map((b) => (
            <li
              key={b}
              style={{
                display: 'flex',
                gap: 9,
                fontSize: 12.5,
                color: 'var(--muted2)',
                lineHeight: 1.45,
              }}
            >
              <span style={{ color: 'var(--accent)', flex: '0 0 auto' }}>›</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div style={{ flex: 1 }} />
        <div
          style={{
            alignSelf: 'flex-start',
            background: hover ? 'var(--accent)' : 'var(--accent-soft)',
            color: hover ? 'var(--on-accent)' : 'var(--accent)',
            border: '1px solid var(--accent-line)',
            padding: '10px 18px',
            borderRadius: 9,
            fontSize: 13.5,
            fontWeight: 600,
            transition: 'background .16s ease, color .16s ease',
          }}
        >
          {cta} →
        </div>
      </div>
    </Link>
  );
}

function StatusPill({ up, esLocal }: { up: boolean | null; esLocal: boolean }) {
  const [color, text] =
    up == null
      ? ['var(--muted)', 'Comprobando…']
      : up
        ? ['#2f9e63', 'Motor de cálculo activo']
        : ['#e8663d', 'Motor de cálculo apagado'];
  return (
    <span
      title={
        up === false
          ? esLocal
            ? 'Arranca el backend con start.ps1 para poder ajustar.'
            : 'El motor no responde ahora mismo. Vuelve a cargar la página en unos segundos.'
          : undefined
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 12,
        color: 'var(--muted2)',
        background: 'var(--row)',
        border: '1px solid var(--line)',
        padding: '5px 11px',
        borderRadius: 20,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
      {text}
    </span>
  );
}

function Logo() {
  return (
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        background: 'var(--accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          border: '2px solid var(--on-accent)',
          borderRadius: '50%',
          borderTopColor: 'transparent',
          transform: 'rotate(45deg)',
        }}
      />
    </div>
  );
}

/** Miniatura: nube de puntos con su curva de ajuste. */
function Art2D() {
  const pts = [
    [18, 86], [40, 76], [62, 71], [84, 58], [106, 52],
    [128, 40], [150, 36], [172, 25], [194, 20],
  ];
  return (
    <svg width="220" height="106" viewBox="0 0 220 106" role="img" aria-label="Gráfica 2D">
      <path d="M10 100 H210" stroke="var(--axis)" strokeWidth="1" />
      <path d="M10 100 V6" stroke="var(--axis)" strokeWidth="1" />
      <path
        d="M14 92 C 60 78, 120 46, 202 16"
        fill="none"
        stroke="#e8663d"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {pts.map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <line x1={cx} y1={cy - 7} x2={cx} y2={cy + 7} stroke="var(--muted)" strokeWidth="1.2" />
          <circle cx={cx} cy={cy} r="3.6" fill="var(--accent)" />
        </g>
      ))}
    </svg>
  );
}

/** Miniatura: histograma de la simulación con su campana encima. */
function ArtUnc() {
  // Barras de alturas gaussianas, como salen de un Monte Carlo.
  const bars = Array.from({ length: 17 }, (_, i) => {
    const z = (i - 8) / 3.4;
    return Math.exp(-0.5 * z * z);
  });
  const w = 10;
  const gap = 1.6;
  const x0 = 18;
  const base = 88;
  const bell = bars
    .map((h, i) => {
      const x = x0 + i * (w + gap) + w / 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${(base - h * 66).toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width="220" height="106" viewBox="0 0 220 106" role="img" aria-label="Distribución de la incertidumbre">
      <path d="M10 94 H210" stroke="var(--axis)" strokeWidth="1" />
      {bars.map((h, i) => (
        <rect
          key={i}
          x={x0 + i * (w + gap)}
          y={base - h * 66}
          width={w}
          height={h * 66 + 6}
          rx="1.5"
          fill="var(--accent)"
          opacity={0.45}
        />
      ))}
      <path d={bell} fill="none" stroke="#e8663d" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="110" y1="12" x2="110" y2="94" stroke="#e8663d" strokeWidth="1.2" strokeDasharray="4 3" />
    </svg>
  );
}

/** Miniatura: malla de una superficie en perspectiva. */
function Art3D() {
  const rows = 6;
  const cols = 6;
  // Proyección isométrica sencilla de una silla de montar.
  const proj = (i: number, j: number) => {
    const u = (i / (cols - 1)) * 2 - 1;
    const v = (j / (rows - 1)) * 2 - 1;
    const h = (u * u - v * v) * 20;
    return [110 + (u - v) * 44, 56 + (u + v) * 17 - h];
  };
  const lines: string[] = [];
  for (let j = 0; j < rows; j++) {
    lines.push(
      Array.from({ length: cols }, (_, i) => proj(i, j).join(','))
        .map((p, i) => (i === 0 ? `M${p}` : `L${p}`))
        .join(' '),
    );
  }
  for (let i = 0; i < cols; i++) {
    lines.push(
      Array.from({ length: rows }, (_, j) => proj(i, j).join(','))
        .map((p, j) => (j === 0 ? `M${p}` : `L${p}`))
        .join(' '),
    );
  }
  return (
    <svg width="220" height="106" viewBox="0 0 220 106" role="img" aria-label="Superficie 3D">
      {lines.map((d, k) => (
        <path
          key={k}
          d={d}
          fill="none"
          stroke={k < rows ? 'var(--accent)' : '#e8663d'}
          strokeWidth="1.4"
          opacity={0.85}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
