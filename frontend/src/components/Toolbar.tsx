// Barra superior: logo, menús (Archivo/Gráfico/Análisis/Ayuda) y acciones.
// La comparten el entorno 2D y el 3D; el logo lleva siempre a la portada.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';

export interface MenuItem {
  label?: string;
  shortcut?: string;
  divider?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export interface MenuDef {
  id: string;
  label: string;
  items: MenuItem[];
}

interface ToolbarProps {
  menus: MenuDef[];
  /** Si no se pasa, no se muestra el botón del asistente (entorno 3D). */
  onToggleWizard?: () => void;
  onToggleTheme: () => void;
  /** Si no se pasa, no se muestra el botón de consejos contextuales. */
  onToggleHelp?: () => void;
  isDark: boolean;
  ringToolbar?: boolean;
  /** Nombre mostrado junto al logo. */
  brand?: string;
  /** Enlaces a los otros entornos, a la derecha de los menús. */
  switchLinks?: { to: string; label: string }[];
}

export function Toolbar({
  menus,
  onToggleWizard,
  onToggleTheme,
  onToggleHelp,
  isDark,
  ringToolbar,
  brand = 'CurvaLab',
  switchLinks = [],
}: ToolbarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const close = () => setActiveMenu(null);

  return (
    <div
      style={{
        flex: '0 0 auto',
        background: 'var(--panel)',
        borderBottom: '1px solid var(--line)',
        position: 'relative',
        zIndex: ringToolbar ? 60 : 20,
        boxShadow: ringToolbar
          ? '0 0 0 3px var(--accent), 0 0 0 10px var(--accent-soft)'
          : '0 1px 2px rgba(16,24,40,.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 16px',
          height: 52,
        }}
      >
        {/* Logo + wordmark: vuelve a la portada */}
        <Link
          to="/"
          title="Volver al inicio"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingRight: 18,
            marginRight: 6,
            borderRight: '1px solid var(--line)',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <Logo />
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.2px' }}>
            {brand}
          </div>
        </Link>

        {/* Menús */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
          {menus.map((menu) => (
            <div key={menu.id} style={{ position: 'relative' }}>
              <button
                onClick={() =>
                  setActiveMenu((m) => (m === menu.id ? null : menu.id))
                }
                style={{
                  background:
                    activeMenu === menu.id ? 'var(--accent-soft)' : 'transparent',
                  border: 'none',
                  padding: '8px 14px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--ink)',
                  borderRadius: 7,
                  cursor: 'pointer',
                }}
              >
                {menu.label}
              </button>
              {activeMenu === menu.id && (
                <div
                  className="pop-in"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    minWidth: 280,
                    background: 'var(--panel)',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    boxShadow: '0 12px 32px rgba(16,24,40,.18)',
                    padding: 6,
                    zIndex: 40,
                  }}
                >
                  {menu.items.map((it, i) =>
                    it.divider ? (
                      <div
                        key={i}
                        style={{
                          height: 1,
                          background: 'var(--line-soft)',
                          margin: '6px 8px',
                        }}
                      />
                    ) : (
                      <button
                        key={i}
                        className="hoverable"
                        disabled={it.disabled}
                        onClick={() => {
                          it.onClick?.();
                          close();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          gap: 24,
                          background: 'transparent',
                          border: 'none',
                          padding: '9px 12px',
                          borderRadius: 7,
                          fontSize: 13.5,
                          color: it.disabled ? 'var(--muted)' : 'var(--ink)',
                          cursor: it.disabled ? 'default' : 'pointer',
                          textAlign: 'left',
                          opacity: it.disabled ? 0.6 : 1,
                        }}
                      >
                        <span>{it.label}</span>
                        <span
                          className="mono"
                          style={{ fontSize: 11.5, color: 'var(--muted)' }}
                        >
                          {it.shortcut}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Salto a los otros entornos del portal */}
        {switchLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              marginRight: 8,
              background: 'var(--row)',
              color: 'var(--muted2)',
              border: '1px solid var(--line)',
              padding: '8px 13px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {link.label} →
          </Link>
        ))}

        {/* Acciones de ayuda */}
        {onToggleWizard && (
        <button
          onClick={onToggleWizard}
          title="Abre el asistente paso a paso"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            border: '1px solid var(--accent-line)',
            padding: '8px 13px',
            borderRadius: 8,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            i
          </span>
          Asistente
        </button>
        )}
        <button
          onClick={onToggleTheme}
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          style={{
            width: 34,
            height: 34,
            marginLeft: 8,
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
        {onToggleHelp && (
        <button
          onClick={onToggleHelp}
          title="Muestra consejos contextuales"
          style={{
            width: 34,
            height: 34,
            marginLeft: 8,
            background: 'var(--row)',
            color: 'var(--muted2)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ?
        </button>
        )}
      </div>

      {/* Capa invisible para cerrar menús al hacer clic fuera */}
      {activeMenu && (
        <div
          onClick={close}
          style={{ position: 'fixed', inset: 0, zIndex: 30 }}
        />
      )}
    </div>
  );
}
