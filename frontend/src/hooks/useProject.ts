// Estado del proyecto: columnas de la hoja de datos y sus operaciones.
// Espejo (en React moderno) de la lógica del prototipo de diseño.
import { useCallback, useState } from 'react';
import type { Column, Dimension, ProjectFile, Role, Theme } from '../types';

let idSeq = 0;
const newId = () => `col-${Date.now()}-${idSeq++}`;

const DEFAULT_COLUMNS: Column[] = [
  {
    id: newId(),
    name: 'Tiempo (s)',
    role: 'x',
    color: '#3a6df0',
    values: ['1.0', '2.0', '3.0', '4.0', '5.0', '6.0', '7.0', '8.0', '9.0', '10.0'],
  },
  {
    id: newId(),
    name: 'Voltaje (V)',
    role: 'y',
    color: '#e8663d',
    values: ['3.1', '5.4', '6.9', '9.2', '11.3', '12.8', '15.4', '16.9', '19.2', '21.1'],
  },
  {
    id: newId(),
    name: 'σ Voltaje',
    role: 'ey',
    color: '#9aa1ad',
    values: ['0.8', '0.9', '0.7', '1.0', '0.8', '1.1', '0.9', '1.0', '0.8', '1.2'],
  },
];

// Datos de partida del entorno 3D: un plano ligeramente ruidoso
// (z ≈ 2·x − y + 1) sobre el que se puede ajustar nada más abrir la app.
const DEFAULT_COLUMNS_3D: Column[] = [
  {
    id: newId(),
    name: 'x (m)',
    role: 'x',
    color: '#3a6df0',
    values: ['0', '1', '2', '3', '0', '1', '2', '3', '0', '1', '2', '3'],
  },
  {
    id: newId(),
    name: 'y (m)',
    role: 'y',
    color: '#e8663d',
    values: ['0', '0', '0', '0', '1', '1', '1', '1', '2', '2', '2', '2'],
  },
  {
    id: newId(),
    name: 'z (V)',
    role: 'z',
    color: '#2f9e63',
    values: [
      '1.1', '2.9', '5.2', '6.8',
      '0.2', '2.1', '3.8', '6.1',
      '-0.9', '1.2', '3.1', '4.8',
    ],
  },
];

// Datos de partida del entorno de incertidumbres: un péndulo simple medido a
// seis longitudes, con la resolución del instrumento en su propia columna. Con
// g = 4π²L/T² se obtiene una g por fila y su error propagado.
const DEFAULT_COLUMNS_UNC: Column[] = [
  {
    id: newId(),
    name: 'L (m)',
    role: 'x',
    color: '#3a6df0',
    values: ['0.20', '0.40', '0.60', '0.80', '1.00', '1.20'],
  },
  {
    id: newId(),
    name: 'σL (m)',
    role: 'ex',
    color: '#9aa1ad',
    values: ['0.001', '0.001', '0.001', '0.001', '0.001', '0.001'],
  },
  {
    id: newId(),
    name: 'T (s)',
    role: '',
    color: '#e8663d',
    values: ['0.899', '1.271', '1.551', '1.797', '2.007', '2.198'],
  },
  {
    id: newId(),
    name: 'σT (s)',
    role: '',
    color: '#9aa1ad',
    values: ['0.004', '0.004', '0.004', '0.004', '0.004', '0.004'],
  },
];

const PALETTE = ['#3a6df0', '#e8663d', '#2f9e63', '#7c5cff', '#0e9d8f', '#d9488a'];

export interface ProjectApi {
  columns: Column[];
  dimension: Dimension;
  setDimension: (d: Dimension) => void;
  setName: (id: string, name: string) => void;
  setRole: (id: string, role: Role) => void;
  setCell: (id: string, row: number, value: string) => void;
  ensureRows: (n: number) => void;
  addColumn: () => void;
  deleteColumn: (id: string) => void;
  deleteColumnAt: (colIndex: number) => void;
  newProject: () => void;
  loadColumns: (cols: Column[]) => void;
  toProjectFile: (accent: string, theme: Theme) => ProjectFile;
  loadProjectFile: (p: ProjectFile) => void;
  rowCount: number;
  // --- Operaciones de hoja de cálculo (por índice de columna) --- //
  clearRange: (c1: number, r1: number, c2: number, r2: number) => void;
  pasteBlock: (startCol: number, startRow: number, block: string[][]) => void;
  insertRowsAt: (rowIndex: number, count: number) => void;
  deleteRowsAt: (r1: number, r2: number) => void;
}

/** Entorno al que sirve la hoja: cambia solo los datos de partida. */
export type SheetMode = Dimension | 'unc';

/**
 * Estado de la hoja de datos. El `mode` solo decide con qué columnas se
 * arranca y qué crea "Nuevo proyecto": el 3D usa tres coordenadas y ninguna
 * columna de error, y el de incertidumbres arranca con un péndulo medido.
 */
export function useProject(mode: SheetMode = '2d'): ProjectApi {
  const is3D = mode === '3d';
  const [columns, setColumns] = useState<Column[]>(
    is3D ? DEFAULT_COLUMNS_3D : mode === 'unc' ? DEFAULT_COLUMNS_UNC : DEFAULT_COLUMNS,
  );
  const [dimension, setDimension] = useState<Dimension>(is3D ? '3d' : '2d');

  const rowCount = Math.max(10, ...columns.map((c) => c.values.length)) + 2;

  const setName = useCallback((id: string, name: string) => {
    setColumns((cs) => cs.map((c) => (c.id === id ? { ...c, name } : c)));
  }, []);

  const setRole = useCallback((id: string, role: Role) => {
    setColumns((cs) => cs.map((c) => (c.id === id ? { ...c, role } : c)));
  }, []);

  const setCell = useCallback((id: string, row: number, value: string) => {
    setColumns((cs) =>
      cs.map((c) => {
        if (c.id !== id) return c;
        const values = c.values.slice();
        while (values.length <= row) values.push('');
        values[row] = value;
        return { ...c, values };
      }),
    );
  }, []);

  const ensureRows = useCallback((n: number) => {
    setColumns((cs) =>
      cs.map((c) => {
        if (c.values.length > n) return c;
        const values = c.values.slice();
        while (values.length <= n) values.push('');
        return { ...c, values };
      }),
    );
  }, []);

  const addColumn = useCallback(() => {
    setColumns((cs) => [
      ...cs,
      {
        id: newId(),
        name: `Columna ${cs.length + 1}`,
        role: '' as Role,
        color: PALETTE[cs.length % PALETTE.length],
        values: [],
      },
    ]);
  }, []);

  const deleteColumn = useCallback((id: string) => {
    setColumns((cs) => (cs.length <= 1 ? cs : cs.filter((c) => c.id !== id)));
  }, []);

  const deleteColumnAt = useCallback((colIndex: number) => {
    setColumns((cs) => (cs.length <= 1 ? cs : cs.filter((_, i) => i !== colIndex)));
  }, []);

  // Borra el contenido de un rectángulo de celdas (por índice de columna/fila).
  const clearRange = useCallback((c1: number, r1: number, c2: number, r2: number) => {
    const lo = Math.min(c1, c2);
    const hi = Math.max(c1, c2);
    const rlo = Math.min(r1, r2);
    const rhi = Math.max(r1, r2);
    setColumns((cs) =>
      cs.map((c, ci) => {
        if (ci < lo || ci > hi) return c;
        const values = c.values.slice();
        for (let r = rlo; r <= rhi; r++) {
          if (r < values.length) values[r] = '';
        }
        return { ...c, values };
      }),
    );
  }, []);

  // Pega un bloque 2D (filas × columnas) desde (startCol, startRow), añadiendo
  // filas y columnas nuevas si el bloque no cabe — como en una hoja de cálculo.
  const pasteBlock = useCallback(
    (startCol: number, startRow: number, block: string[][]) => {
      const height = block.length;
      const width = Math.max(0, ...block.map((row) => row.length));
      if (height === 0 || width === 0) return;
      setColumns((cs) => {
        const next = cs.map((c) => ({ ...c, values: c.values.slice() }));
        // Añadir columnas si el bloque sobresale por la derecha.
        while (next.length < startCol + width) {
          next.push({
            id: newId(),
            name: `Columna ${next.length + 1}`,
            role: '' as Role,
            color: PALETTE[next.length % PALETTE.length],
            values: [],
          });
        }
        for (let r = 0; r < height; r++) {
          for (let cc = 0; cc < block[r].length; cc++) {
            const col = next[startCol + cc];
            const row = startRow + r;
            while (col.values.length <= row) col.values.push('');
            col.values[row] = block[r][cc];
          }
        }
        return next;
      });
    },
    [],
  );

  // Inserta `count` filas vacías en todas las columnas a partir de rowIndex.
  const insertRowsAt = useCallback((rowIndex: number, count: number) => {
    setColumns((cs) =>
      cs.map((c) => {
        const values = c.values.slice();
        while (values.length < rowIndex) values.push('');
        values.splice(rowIndex, 0, ...Array(count).fill(''));
        return { ...c, values };
      }),
    );
  }, []);

  // Elimina las filas r1..r2 (inclusive) de todas las columnas.
  const deleteRowsAt = useCallback((r1: number, r2: number) => {
    const lo = Math.min(r1, r2);
    const hi = Math.max(r1, r2);
    setColumns((cs) =>
      cs.map((c) => {
        const values = c.values.slice();
        if (lo < values.length) values.splice(lo, hi - lo + 1);
        return { ...c, values };
      }),
    );
  }, []);

  const newProject = useCallback(() => {
    const base: Column[] = [
      { id: newId(), name: 'x', role: 'x', color: '#3a6df0', values: [] },
      { id: newId(), name: 'y', role: 'y', color: '#e8663d', values: [] },
    ];
    if (is3D) {
      base.push({ id: newId(), name: 'z', role: 'z', color: '#2f9e63', values: [] });
    }
    setColumns(base);
  }, [is3D]);

  const loadColumns = useCallback((cols: Column[]) => {
    setColumns(cols.map((c) => ({ ...c, id: c.id || newId() })));
  }, []);

  const toProjectFile = useCallback(
    (accent: string, theme: Theme): ProjectFile => ({
      version: 1,
      app: 'CurvaLab',
      columns,
      dimension,
      accent,
      theme,
      savedAt: new Date().toISOString(),
    }),
    [columns, dimension],
  );

  const loadProjectFile = useCallback((p: ProjectFile) => {
    setColumns(p.columns.map((c) => ({ ...c, id: c.id || newId() })));
    setDimension(p.dimension || '2d');
  }, []);

  return {
    columns,
    dimension,
    setDimension,
    setName,
    setRole,
    setCell,
    ensureRows,
    addColumn,
    deleteColumn,
    deleteColumnAt,
    newProject,
    loadColumns,
    toProjectFile,
    loadProjectFile,
    rowCount,
    clearRange,
    pasteBlock,
    insertRowsAt,
    deleteRowsAt,
  };
}

export { PALETTE };
