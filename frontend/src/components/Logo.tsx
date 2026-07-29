// El logo de CurvaLab: el mismo fichero que sirve de favicon, para que la marca
// de la pestaña y la de la barra superior no puedan separarse con el tiempo.
//
// Va como <img> y no como SVG en línea a propósito: el navegador ya se lo
// descarga para la pestaña, así que aquí sale de caché y no engorda el bundle.
// El redondeo de las esquinas viene dentro del propio SVG (rx=96 sobre 512).
interface LogoProps {
  /** Lado en píxeles. 26 en las barras superiores. */
  size?: number;
}

export function Logo({ size = 26 }: LogoProps) {
  return (
    <img
      src="/favicon.svg"
      // Decorativo: siempre va acompañado del nombre «CurvaLab» en texto.
      alt=""
      width={size}
      height={size}
      style={{ display: 'block', flex: '0 0 auto' }}
    />
  );
}
