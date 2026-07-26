// Tema (claro/oscuro) y color de acento, compartidos por las tres páginas.
//
// El estilo se aplica como atributo y variables CSS en <html>, así que vale
// igual para la portada, el entorno 2D y el 3D. Se recuerda en localStorage
// para que al saltar de un entorno a otro no cambie el aspecto.
import { useCallback, useEffect, useState } from 'react';
import type { Theme } from '../types';

const THEME_KEY = 'curvalab.theme';
const ACCENT_KEY = 'curvalab.accent';
const DEFAULT_ACCENT = '#3a6df0';

function readStored<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    // Navegación privada o almacenamiento bloqueado: seguimos con el defecto.
    return fallback;
  }
}

export interface AppTheme {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  accent: string;
  setAccent: (c: string) => void;
}

export function useAppTheme(): AppTheme {
  const [theme, setTheme] = useState<Theme>(() => readStored<Theme>(THEME_KEY, 'light'));
  const [accent, setAccent] = useState<string>(() => readStored(ACCENT_KEY, DEFAULT_ACCENT));

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.setProperty('--accent', accent);
    // El acento con transparencia (sufijo alfa hex) para fondos y bordes.
    root.style.setProperty('--accent-soft', accent + (theme === 'dark' ? '30' : '1f'));
    root.style.setProperty('--accent-line', accent + (theme === 'dark' ? '55' : '4d'));
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      /* sin almacenamiento: el tema simplemente no se recuerda */
    }
  }, [theme, accent]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  );

  return { theme, setTheme, toggleTheme, accent, setAccent };
}
