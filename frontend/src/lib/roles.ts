// Metadatos de los roles de columna (insignia y opciones del select).
import type { Role } from '../types';

export interface RoleMeta {
  short: string;
  bg: string;
  fg: string;
}

export function roleMeta(role: Role): RoleMeta {
  switch (role) {
    case 'x':
      return { short: 'X', bg: 'var(--accent-soft)', fg: 'var(--accent)' };
    case 'y':
      return { short: 'Y', bg: 'var(--role-y-bg)', fg: 'var(--role-y-fg)' };
    case 'z':
      return { short: 'Z', bg: 'var(--role-z-bg)', fg: 'var(--role-z-fg)' };
    case 'ex':
      return { short: 'ΔX', bg: 'var(--row2)', fg: 'var(--muted2)' };
    case 'ey':
      return { short: 'ΔY', bg: 'var(--row2)', fg: 'var(--muted2)' };
    case 'ez':
      return { short: 'ΔZ', bg: 'var(--row2)', fg: 'var(--muted2)' };
    default:
      return { short: '—', bg: 'var(--row2)', fg: 'var(--muted)' };
  }
}

/** Roles del entorno 3D: solo las tres coordenadas, sin barras de error. */
export const ROLE_OPTIONS_3D: { value: Role; label: string }[] = [
  { value: '', label: '— Sin asignar' },
  { value: 'x', label: 'X (eje horizontal)' },
  { value: 'y', label: 'Y (eje de profundidad)' },
  { value: 'z', label: 'Z (altura de la superficie)' },
];

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: '', label: '— Sin asignar' },
  { value: 'x', label: 'X (eje horizontal)' },
  { value: 'y', label: 'Y (eje vertical)' },
  { value: 'z', label: 'Z (profundidad, 3D)' },
  { value: 'ex', label: 'Error de X' },
  { value: 'ey', label: 'Error de Y' },
  { value: 'ez', label: 'Error de Z' },
];
