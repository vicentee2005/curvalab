// Hoja de datos estilo Excel: selección de rangos con ratón y teclado,
// copiar/cortar/pegar (TSV) y suprimir. Las celdas son <div> seleccionables y
// solo la celda en edición se convierte en <input>, lo que separa "seleccionar"
// de "editar" y evita conflictos de foco (el patrón de las hojas de cálculo).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Column, Role } from '../types';
import { roleMeta, ROLE_OPTIONS } from '../lib/roles';
import { buildTSV, parseClipboard } from '../lib/clipboard';

interface DataSheetProps {
  columns: Column[];
  rowCount: number;
  showHelp: boolean;
  ring?: boolean;
  /** Roles disponibles en el selector. Por defecto, todos (entorno 2D). El
   *  entorno 3D pasa solo X/Y/Z porque no maneja barras de error. */
  roleOptions?: { value: Role; label: string }[];
  /** Texto del consejo contextual. Por defecto, el del entorno 2D. */
  helpText?: React.ReactNode;
  onName: (id: string, name: string) => void;
  onRole: (id: string, role: Role) => void;
  onCell: (id: string, row: number, value: string) => void;
  onAddColumn: () => void;
  onDeleteColumn: (id: string) => void;
  onClearRange: (c1: number, r1: number, c2: number, r2: number) => void;
  onPasteBlock: (startCol: number, startRow: number, block: string[][]) => void;
}

interface Sel {
  ac: number; // anchor col
  ar: number; // anchor row
  fc: number; // focus col
  fr: number; // focus row
}

interface Editing {
  c: number;
  r: number;
  value: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function DataSheet({
  columns,
  rowCount,
  showHelp,
  ring,
  roleOptions = ROLE_OPTIONS,
  helpText,
  onName,
  onRole,
  onCell,
  onAddColumn,
  onDeleteColumn,
  onClearRange,
  onPasteBlock,
}: DataSheetProps) {
  const rows = Array.from({ length: rowCount }, (_, i) => i + 1);
  const nCols = columns.length;

  const [sel, setSel] = useState<Sel | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  // Rectángulo normalizado de la selección.
  const rect = sel
    ? {
        c1: Math.min(sel.ac, sel.fc),
        c2: Math.max(sel.ac, sel.fc),
        r1: Math.min(sel.ar, sel.fr),
        r2: Math.max(sel.ar, sel.fr),
      }
    : null;

  const inRect = (c: number, r: number) =>
    rect ? c >= rect.c1 && c <= rect.c2 && r >= rect.r1 && r <= rect.r2 : false;
  const isActive = (c: number, r: number) => sel != null && sel.fc === c && sel.fr === r;

  const focusGrid = useCallback(() => {
    // Espera un frame para no competir con el desmontaje del input de edición.
    requestAnimationFrame(() => gridRef.current?.focus());
  }, []);

  // Fin de arrastre a nivel de ventana.
  useEffect(() => {
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const cellValue = (c: number, r: number) => columns[c]?.values[r] ?? '';

  // --- Edición ------------------------------------------------------------ //
  const startEdit = useCallback(
    (c: number, r: number, initial: string | null) => {
      const cur = columns[c]?.values[r] ?? '';
      setEditing({ c, r, value: initial ?? cur });
    },
    [columns],
  );

  // Ojo: el aviso al padre (onCell) debe hacerse FUERA del updater de
  // setEditing. React ejecuta los updaters durante el render, así que llamar
  // ahí a un setState del padre provoca "Cannot update a component while
  // rendering a different component" y puede perder la edición.
  const commitEdit = useCallback(() => {
    if (editing && columns[editing.c]) {
      onCell(columns[editing.c].id, editing.r, editing.value);
    }
    setEditing(null);
  }, [editing, columns, onCell]);

  const moveTo = useCallback(
    (c: number, r: number) => {
      const nc = clamp(c, 0, nCols - 1);
      const nr = clamp(r, 0, rowCount - 1);
      setSel({ ac: nc, ar: nr, fc: nc, fr: nr });
    },
    [nCols, rowCount],
  );

  // --- Teclado sobre la cuadrícula (cuando NO se está editando) ----------- //
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;
    if (!sel) {
      if (e.key.length === 1 || e.key.startsWith('Arrow')) {
        setSel({ ac: 0, ar: 0, fc: 0, fr: 0 });
      }
      return;
    }
    const k = e.key;
    const move = (dc: number, dr: number, extend: boolean) => {
      e.preventDefault();
      setSel((s) => {
        if (!s) return s;
        const nc = clamp(s.fc + dc, 0, nCols - 1);
        const nr = clamp(s.fr + dr, 0, rowCount - 1);
        return extend ? { ...s, fc: nc, fr: nr } : { ac: nc, ar: nr, fc: nc, fr: nr };
      });
    };

    if (k === 'ArrowUp') move(0, -1, e.shiftKey);
    else if (k === 'ArrowDown') move(0, 1, e.shiftKey);
    else if (k === 'ArrowLeft') move(-1, 0, e.shiftKey);
    else if (k === 'ArrowRight') move(1, 0, e.shiftKey);
    else if (k === 'Tab') {
      e.preventDefault();
      move(e.shiftKey ? -1 : 1, 0, false);
    } else if (k === 'Enter' || k === 'F2') {
      e.preventDefault();
      startEdit(sel.fc, sel.fr, null);
    } else if (k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      if (rect) onClearRange(rect.c1, rect.r1, rect.c2, rect.r2);
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Empezar a escribir reemplaza el contenido (como en Excel). Evitamos que
      // la misma pulsación se teclee además en el input recién montado (que ya
      // se siembra con este carácter) — si no, saldría duplicada.
      e.preventDefault();
      startEdit(sel.fc, sel.fr, k);
    }
  };

  // --- Teclado dentro del input de edición -------------------------------- //
  const onEditKeyDown = (e: React.KeyboardEvent) => {
    if (!editing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const { c, r } = editing;
      commitEdit();
      moveTo(c, r + 1);
      focusGrid();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const { c, r } = editing;
      commitEdit();
      moveTo(c + (e.shiftKey ? -1 : 1), r);
      focusGrid();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(null);
      focusGrid();
    }
    // Las flechas mueven el cursor dentro del texto (comportamiento nativo).
  };

  // --- Portapapeles ------------------------------------------------------- //
  const copyRange = (): string => {
    if (!rect) return '';
    const out: string[][] = [];
    for (let r = rect.r1; r <= rect.r2; r++) {
      const row: string[] = [];
      for (let c = rect.c1; c <= rect.c2; c++) row.push(cellValue(c, r));
      out.push(row);
    }
    return buildTSV(out);
  };

  const onCopy = (e: React.ClipboardEvent) => {
    if (!sel || editing) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', copyRange());
  };

  const onCut = (e: React.ClipboardEvent) => {
    if (!sel || editing || !rect) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', copyRange());
    onClearRange(rect.c1, rect.r1, rect.c2, rect.r2);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (editing) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const block = parseClipboard(text);
    if (block.length === 0) return;
    const startC = sel ? Math.min(sel.ac, sel.fc) : 0;
    const startR = sel ? Math.min(sel.ar, sel.fr) : 0;
    onPasteBlock(startC, startR, block);
    const h = block.length;
    const w = Math.max(...block.map((row) => row.length));
    setSel({ ac: startC, ar: startR, fc: startC + w - 1, fr: startR + h - 1 });
  };

  // --- Ratón -------------------------------------------------------------- //
  const onCellMouseDown = (c: number, r: number, e: React.MouseEvent) => {
    if (editing) commitEdit();
    if (e.shiftKey) {
      e.preventDefault();
      setSel((s) => (s ? { ...s, fc: c, fr: r } : { ac: c, ar: r, fc: c, fr: r }));
    } else {
      setSel({ ac: c, ar: r, fc: c, fr: r });
      dragging.current = true;
    }
    focusGrid();
  };

  const onCellMouseEnter = (c: number, r: number) => {
    if (dragging.current) setSel((s) => (s ? { ...s, fc: c, fr: r } : s));
  };

  const selectColumn = (c: number) => {
    setSel({ ac: c, ar: 0, fc: c, fr: rowCount - 1 });
    focusGrid();
  };
  const selectRow = (r: number) => {
    setSel({ ac: 0, ar: r, fc: Math.max(0, nCols - 1), fr: r });
    focusGrid();
  };
  const selectAll = () => {
    setSel({ ac: 0, ar: 0, fc: Math.max(0, nCols - 1), fr: rowCount - 1 });
    focusGrid();
  };

  return (
    <div
      style={{
        flex: '0 0 468px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        overflow: 'hidden',
        position: 'relative',
        zIndex: ring ? 60 : 'auto',
        boxShadow: ring
          ? '0 0 0 3px var(--accent), 0 0 0 10px var(--accent-soft)'
          : '0 1px 3px rgba(16,24,40,.05)',
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          padding: 'var(--card-pad) 16px',
          borderBottom: '1px solid var(--line-soft)',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Hoja de datos</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            Selecciona, copia y pega como en Excel · asigna un rol a cada columna
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={onAddColumn}
          title="Añadir una columna nueva"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            border: 'none',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Columna
        </button>
      </div>

      {/* Cuadrícula */}
      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onGridKeyDown}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          outline: 'none',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', width: 'max-content' }}>
          {/* Números de fila (fijos) */}
          <div style={{ flex: '0 0 auto', position: 'sticky', left: 0, zIndex: 2 }}>
            <div
              onClick={selectAll}
              title="Seleccionar todo"
              style={{
                height: 90,
                width: 44,
                background: 'var(--row2)',
                borderRight: '1px solid var(--line)',
                borderBottom: '1px solid var(--line)',
                cursor: 'pointer',
              }}
            />
            {rows.map((n, r) => {
              const rowSel = rect && r >= rect.r1 && r <= rect.r2;
              return (
                <div
                  key={n}
                  onClick={() => selectRow(r)}
                  className="mono"
                  style={{
                    height: 34,
                    width: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    color: rowSel ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: rowSel ? 600 : 400,
                    background: rowSel ? 'var(--accent-soft)' : 'var(--row2)',
                    borderRight: '1px solid var(--line)',
                    borderBottom: '1px solid var(--line-soft)',
                    cursor: 'pointer',
                  }}
                >
                  {n}
                </div>
              );
            })}
          </div>

          {/* Columnas de datos */}
          {columns.map((col, ci) => {
            const meta = roleMeta(col.role);
            const colSel = rect && ci >= rect.c1 && ci <= rect.c2;
            return (
              <div
                key={col.id}
                style={{ flex: '0 0 134px', borderRight: '1px solid var(--line)' }}
              >
                {/* Cabecera de columna */}
                <div
                  style={{
                    height: 90,
                    boxSizing: 'border-box',
                    padding: '8px 9px',
                    background: 'var(--row)',
                    borderBottom: '1px solid var(--line)',
                    borderTop: `3px solid ${col.color}`,
                  }}
                >
                  {/* Franja superior clicable = seleccionar toda la columna */}
                  <div
                    onClick={() => selectColumn(ci)}
                    title="Seleccionar columna"
                    style={{
                      height: 4,
                      margin: '-8px -9px 6px',
                      background: colSel ? 'var(--accent-soft)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7 }}>
                    <input
                      value={col.name}
                      onChange={(e) => onName(col.id, e.target.value)}
                      title="Nombre de la columna (leyenda del gráfico)"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        width: '100%',
                        fontWeight: 600,
                        fontSize: 12.5,
                        color: 'var(--ink)',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px dashed var(--line)',
                        padding: '1px 0',
                      }}
                    />
                    <span
                      className="mono"
                      style={{
                        flex: '0 0 auto',
                        fontSize: 10,
                        color: meta.fg,
                        background: meta.bg,
                        padding: '2px 5px',
                        borderRadius: 5,
                        fontWeight: 600,
                      }}
                    >
                      {meta.short}
                    </span>
                    <button
                      onClick={() => onDeleteColumn(col.id)}
                      title="Eliminar columna"
                      style={{
                        flex: '0 0 auto',
                        width: 18,
                        height: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 5,
                        color: 'var(--muted)',
                        fontSize: 14,
                        lineHeight: 1,
                        cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <select
                    value={col.role}
                    onChange={(e) => onRole(col.id, e.target.value as Role)}
                    title="Rol de la columna"
                    style={{
                      width: '100%',
                      fontSize: 12,
                      color: 'var(--ink)',
                      padding: '6px 7px',
                      border: '1px solid var(--line)',
                      borderRadius: 7,
                      background: 'var(--panel)',
                      cursor: 'pointer',
                    }}
                  >
                    {roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Celdas */}
                {rows.map((_, r) => {
                  const editingHere = editing && editing.c === ci && editing.r === r;
                  const selected = inRect(ci, r);
                  const active = isActive(ci, r);
                  if (editingHere) {
                    return (
                      <input
                        key={r}
                        className="mono"
                        autoFocus
                        value={editing!.value}
                        onChange={(e) =>
                          setEditing((ed) => (ed ? { ...ed, value: e.target.value } : ed))
                        }
                        onKeyDown={onEditKeyDown}
                        onBlur={commitEdit}
                        ref={(el) => {
                          if (el) {
                            const len = el.value.length;
                            el.setSelectionRange(len, len);
                          }
                        }}
                        inputMode="decimal"
                        style={{
                          height: 34,
                          width: '100%',
                          boxSizing: 'border-box',
                          textAlign: 'right',
                          padding: '0 11px',
                          fontSize: 12.5,
                          color: 'var(--ink)',
                          background: 'var(--panel)',
                          border: 'none',
                          boxShadow: 'inset 0 0 0 2px var(--accent)',
                          outline: 'none',
                          userSelect: 'text',
                        }}
                      />
                    );
                  }
                  return (
                    <div
                      key={r}
                      className="mono"
                      onMouseDown={(e) => onCellMouseDown(ci, r, e)}
                      onMouseEnter={() => onCellMouseEnter(ci, r)}
                      onDoubleClick={() => startEdit(ci, r, null)}
                      style={{
                        height: 34,
                        width: '100%',
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        textAlign: 'right',
                        padding: '0 11px',
                        fontSize: 12.5,
                        color: 'var(--ink)',
                        background: selected ? 'var(--accent-soft)' : 'transparent',
                        boxShadow: active ? 'inset 0 0 0 2px var(--accent)' : 'none',
                        borderBottom: '1px solid var(--line-soft)',
                        cursor: 'cell',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                      }}
                    >
                      {cellValue(ci, r)}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Añadir columna */}
          <div style={{ flex: '0 0 46px' }}>
            <button
              onClick={onAddColumn}
              title="Añadir columna"
              style={{
                height: 90,
                width: 46,
                background: 'var(--row)',
                border: 'none',
                borderBottom: '1px solid var(--line)',
                color: 'var(--accent)',
                fontSize: 22,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Consejos contextuales */}
      {showHelp && (
        <div
          style={{
            flex: '0 0 auto',
            borderTop: '1px solid var(--line-soft)',
            background: 'var(--row)',
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--accent)',
              marginBottom: 8,
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                fontSize: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
              }}
            >
              ?
            </span>
            Consejo
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted2)', lineHeight: 1.55 }}>
            {helpText ?? (
              <>
                Arrastra para seleccionar un rango; <b>Ctrl+C/V/X</b> para copiar, pegar
                o cortar y <b>Supr</b> para borrar. Doble clic (o empieza a escribir)
                para editar una celda. Cada gráfica necesita al menos una <b>X</b> y una{' '}
                <b>Y</b>; las columnas de <b>error</b> dibujan barras de incertidumbre.
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
