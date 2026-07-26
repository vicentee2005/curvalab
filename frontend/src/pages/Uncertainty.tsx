// CurvaLab · Incertidumbres — propagación de errores a una magnitud indirecta.
//
// Dos caminos que se calculan a la vez: la fórmula de propagación gaussiana
// (con las derivadas parciales que deriva SymPy en el backend) y una simulación
// Monte Carlo. El segundo no supone que la fórmula sea lineal, así que sirve de
// comprobación del primero.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toolbar, type MenuDef } from '../components/Toolbar';
import { DataSheet } from '../components/DataSheet';
import { VariablesPanel } from '../components/VariablesPanel';
import { PropagationCard } from '../components/PropagationCard';
import { Wizard, WIZARD_STEPS_UNC } from '../components/Wizard';
import { Tour, TOUR_STEPS_UNC } from '../components/Tour';
import { useProject, PALETTE } from '../hooks/useProject';
import { useAppTheme } from '../hooks/useAppTheme';
import {
  ApiError,
  formulaSymbols,
  importFile,
  importText,
  propagate,
  propagateTable,
} from '../api';
import type {
  Column,
  PropagateResult,
  PropagateTableResult,
  Role,
  TableBinding,
  UncertainVariable,
  UncertaintyMode,
  UncertaintyProjectFile,
  Handoff,
} from '../types';
import { HANDOFF_KEY } from '../types';

let varSeq = 0;
const newVarId = () => `var-${Date.now()}-${varSeq++}`;

const emptyVar = (name: string): UncertainVariable => ({
  id: newVarId(),
  name,
  value: '',
  uncertainty: '',
  distribution: 'normal',
  note: '',
});

/** Número desde una celda de texto: acepta la coma decimal española. */
function num(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

export function Uncertainty() {
  const project = useProject('unc');
  const navigate = useNavigate();
  const { theme, setTheme, toggleTheme, accent, setAccent } = useAppTheme();

  const [expression, setExpression] = useState('4*pi**2*L/T**2');
  const [variables, setVariables] = useState<UncertainVariable[]>([
    { ...emptyVar('L'), value: '1.000', uncertainty: '0.001' },
    { ...emptyVar('T'), value: '2.006', uncertainty: '0.004' },
  ]);
  const [bindings, setBindings] = useState<Record<string, TableBinding>>({});
  const [mode, setMode] = useState<UncertaintyMode>('single');
  const [label, setLabel] = useState('g');
  const [samples, setSamples] = useState(10000);

  const [symbols, setSymbols] = useState<string[]>(['L', 'T']);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [result, setResult] = useState<PropagateResult | null>(null);
  const [tableResult, setTableResult] = useState<PropagateTableResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showWizard, setShowWizard] = useState(true);
  const [showHelp, setShowHelp] = useState(true);
  const [tourStep, setTourStep] = useState(-1);
  const tourActive = tourStep >= 0;

  const plotRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const openInputRef = useRef<HTMLInputElement | null>(null);

  // --- La fórmula manda: SymPy dice qué variables hacen falta -------------- //
  useEffect(() => {
    if (!expression.trim()) {
      setSymbols([]);
      setParseError(null);
      return;
    }
    setParsing(true);
    const t = setTimeout(() => {
      formulaSymbols(expression)
        .then((s) => {
          setSymbols(s);
          setParseError(null);
        })
        .catch((e) => {
          setParseError(e instanceof ApiError ? e.message : 'No se pudo leer la fórmula.');
        })
        .finally(() => setParsing(false));
    }, 400);
    return () => {
      clearTimeout(t);
      setParsing(false);
    };
  }, [expression]);

  // Una variable nueva en la fórmula estrena fila; las que desaparecen se
  // conservan (el usuario puede estar a mitad de escribir) y se avisan aparte.
  useEffect(() => {
    setVariables((vs) => {
      const known = new Set(vs.map((v) => v.name));
      const nuevas = symbols.filter((s) => !known.has(s)).map(emptyVar);
      return nuevas.length ? [...vs, ...nuevas] : vs;
    });
  }, [symbols]);

  const patchVar = useCallback((id: string, patch: Partial<UncertainVariable>) => {
    setVariables((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }, []);

  const removeVar = useCallback((id: string) => {
    setVariables((vs) => vs.filter((v) => v.id !== id));
  }, []);

  const patchBinding = useCallback((name: string, patch: Partial<TableBinding>) => {
    setBindings((b) => {
      const previo = b[name] ?? { valueColumn: '', errorColumn: '' };
      return { ...b, [name]: { ...previo, ...patch } };
    });
  }, []);

  const activas = useMemo(
    () => variables.filter((v) => symbols.includes(v.name)),
    [variables, symbols],
  );

  // --- Cálculo ------------------------------------------------------------ //
  async function compute() {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'single') {
        setTableResult(null);
        const faltan = activas.filter((v) => num(v.value) == null).map((v) => v.name);
        if (faltan.length) {
          throw new ApiError(
            `Falta el valor de ${faltan.join(', ')}. Cada variable de la fórmula necesita un número.`,
          );
        }
        const res = await propagate({
          expression,
          variables: activas.map((v) => ({
            name: v.name,
            value: num(v.value) ?? 0,
            uncertainty: Math.abs(num(v.uncertainty) ?? 0),
            distribution: v.distribution,
          })),
          monte_carlo: true,
          samples,
          seed: 20260726,
        });
        setResult(res);
      } else {
        setResult(null);
        const res = await propagateTable({
          expression,
          variables: activas.map((v) => {
            const b = bindings[v.name] ?? { valueColumn: '', errorColumn: '' };
            const valCol = project.columns.find((c) => c.id === b.valueColumn);
            const errCol = project.columns.find((c) => c.id === b.errorColumn);
            return {
              name: v.name,
              values: valCol ? valCol.values.map(num) : [num(v.value) ?? 0],
              uncertainties: errCol
                ? errCol.values.map(num)
                : [Math.abs(num(v.uncertainty) ?? 0)],
              distribution: v.distribution,
            };
          }),
        });
        setTableResult(res);
      }
    } catch (e) {
      setResult(null);
      setTableResult(null);
      setError(e instanceof ApiError ? e.message : 'No se pudo propagar el error.');
    } finally {
      setLoading(false);
    }
  }

  /** Vuelca la columna calculada (y su error) al final de la hoja. */
  function addColumns() {
    if (!tableResult) return;
    const fmt = (v: number | null) => (v == null ? '' : String(Number(v.toPrecision(8))));
    const nuevas: Column[] = [
      {
        id: `unc-${Date.now()}-z`,
        name: label,
        role: 'y' as Role,
        color: PALETTE[2],
        values: tableResult.z.map(fmt),
      },
      {
        id: `unc-${Date.now()}-sz`,
        name: `σ${label}`,
        role: 'ey' as Role,
        color: '#9aa1ad',
        values: tableResult.sz.map(fmt),
      },
    ];
    // Si ya se habían añadido antes, se reemplazan en vez de acumularse.
    const previas = new Set([label, `σ${label}`]);
    project.loadColumns([...project.columns.filter((c) => !previas.has(c.name)), ...nuevas]);
  }

  /** Deja los datos preparados y abre el entorno 2D con ellos. */
  function sendTo2D() {
    if (!tableResult) return;
    addColumns();
    const fmt = (v: number | null) => (v == null ? '' : String(Number(v.toPrecision(8))));
    const previas = new Set([label, `σ${label}`]);
    const columns: Column[] = [
      ...project.columns.filter((c) => !previas.has(c.name)),
      {
        id: `unc-${Date.now()}-z`,
        name: label,
        role: 'y' as Role,
        color: PALETTE[2],
        values: tableResult.z.map(fmt),
      },
      {
        id: `unc-${Date.now()}-sz`,
        name: `σ${label}`,
        role: 'ey' as Role,
        color: '#9aa1ad',
        values: tableResult.sz.map(fmt),
      },
    ];
    const handoff: Handoff = {
      from: 'incertidumbres',
      columns,
      note: `${label} = ${expression}`,
    };
    try {
      localStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
    } catch {
      /* sin localStorage no hay traspaso, pero tampoco se rompe nada */
    }
    navigate('/2d');
  }

  // --- Archivo ------------------------------------------------------------ //
  function handleNewProject() {
    project.newProject();
    setResult(null);
    setTableResult(null);
    setError(null);
  }

  function handleSave() {
    const file: UncertaintyProjectFile = {
      version: 1,
      app: 'CurvaLabU',
      expression,
      variables,
      bindings,
      mode,
      columns: project.columns,
      accent,
      theme,
      savedAt: new Date().toISOString(),
      samples,
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'proyecto-curvalab-incertidumbres.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleOpenFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as UncertaintyProjectFile;
      if (parsed.app !== 'CurvaLabU') {
        setError('Ese proyecto es de otro entorno. Ábrelo desde su propio enlace.');
        return;
      }
      setExpression(parsed.expression ?? '');
      setVariables(parsed.variables ?? []);
      setBindings(parsed.bindings ?? {});
      setMode(parsed.mode ?? 'single');
      if (parsed.columns) project.loadColumns(parsed.columns);
      if (parsed.accent) setAccent(parsed.accent);
      if (parsed.theme) setTheme(parsed.theme);
      if (parsed.samples) setSamples(parsed.samples);
      setResult(null);
      setTableResult(null);
      setError(null);
    } catch {
      setError('No se pudo abrir el proyecto (¿es un .json de este entorno?).');
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const res = await importFile(file);
      applyImported(res.columns, res.rows, res.roles);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo importar el fichero.');
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setError('El portapapeles está vacío.');
        return;
      }
      const res = await importText(text);
      applyImported(res.columns, res.rows, res.roles);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo leer el portapapeles (permite el acceso o pega en las celdas).',
      );
    }
  }

  function applyImported(colNames: string[], rows: (number | null)[][], roles?: string[]) {
    const valid = new Set<Role>(['', 'x', 'y', 'z', 'ex', 'ey', 'ez']);
    const cols: Column[] = colNames.map((name, i) => ({
      id: `imp-unc-${Date.now()}-${i}`,
      name: name || `col${i + 1}`,
      role: valid.has(roles?.[i] as Role) ? (roles?.[i] as Role) : '',
      color: PALETTE[i % PALETTE.length],
      values: rows.map((r) => (r[i] == null ? '' : String(r[i]))),
    }));
    if (!cols.length) return;
    project.loadColumns(cols);
    // Los enganches apuntaban a columnas que ya no existen.
    setBindings({});
    setTableResult(null);
    setError(null);
    setMode('table');
  }

  // --- Menús -------------------------------------------------------------- //
  const menus: MenuDef[] = [
    {
      id: 'archivo',
      label: 'Archivo',
      items: [
        { label: 'Nuevo proyecto', shortcut: 'Ctrl+N', onClick: handleNewProject },
        { label: 'Abrir…', shortcut: 'Ctrl+O', onClick: () => openInputRef.current?.click() },
        { divider: true },
        { label: 'Importar CSV / TXT / Excel', onClick: () => importInputRef.current?.click() },
        { label: 'Pegar datos del portapapeles', shortcut: 'Ctrl+V', onClick: handlePaste },
        { divider: true },
        { label: 'Guardar', shortcut: 'Ctrl+S', onClick: handleSave },
      ],
    },
    {
      id: 'calculo',
      label: 'Cálculo',
      items: [
        { label: 'Propagar el error', onClick: compute },
        { divider: true },
        {
          label: mode === 'single' ? '• Medida única' : 'Medida única',
          onClick: () => setMode('single'),
        },
        {
          label: mode === 'table' ? '• Por filas (hoja de datos)' : 'Por filas (hoja de datos)',
          onClick: () => setMode('table'),
        },
        { divider: true },
        {
          label: 'Añadir el resultado a la hoja',
          disabled: !tableResult,
          onClick: addColumns,
        },
        {
          label: 'Ajustar el resultado en el entorno 2D',
          disabled: !tableResult,
          onClick: sendTo2D,
        },
        { divider: true },
        {
          label: 'Limpiar el resultado',
          disabled: !result && !tableResult,
          onClick: () => {
            setResult(null);
            setTableResult(null);
            setError(null);
          },
        },
      ],
    },
    {
      id: 'ayuda',
      label: 'Ayuda',
      items: [
        { label: 'Guía de inicio rápido', onClick: () => setTourStep(0) },
        {
          label: showWizard ? 'Ocultar el asistente' : 'Mostrar el asistente',
          onClick: () => setShowWizard((v) => !v),
        },
        {
          label: showHelp ? 'Ocultar los consejos' : 'Mostrar los consejos',
          onClick: () => setShowHelp((v) => !v),
        },
        { divider: true },
        { label: 'Tutoriales', disabled: true },
        { label: 'Acerca de CurvaLab', disabled: true },
      ],
    },
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        handleSave();
      } else if (k === 'n') {
        e.preventDefault();
        handleNewProject();
      } else if (k === 'o') {
        e.preventDefault();
        openInputRef.current?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.columns, expression, variables, mode]);

  const isTable = mode === 'table';

  // La guía resalta la hoja de datos en su tercer paso, así que hay que
  // asegurarse de que esté a la vista al llegar ahí.
  function nextTourStep() {
    const n = tourStep + 1 >= TOUR_STEPS_UNC.length ? -1 : tourStep + 1;
    if (n === 2) setMode('table');
    setTourStep(n);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <Toolbar
        menus={menus}
        brand="CurvaLab · Incertidumbres"
        switchLinks={[
          { to: '/2d', label: 'Ajuste 2D' },
          { to: '/3d', label: 'Superficies 3D' },
        ]}
        onToggleWizard={() => setShowWizard((v) => !v)}
        onToggleTheme={toggleTheme}
        onToggleHelp={() => setShowHelp((v) => !v)}
        isDark={theme === 'dark'}
        ringToolbar={tourActive && tourStep === 0}
      />

      <div
        style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          padding: 'var(--gap)',
          gap: 'var(--gap)',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            gap: 'var(--gap)',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              position: 'relative',
              zIndex: tourActive && tourStep === 1 ? 60 : 'auto',
              boxShadow:
                tourActive && tourStep === 1
                  ? '0 0 0 3px var(--accent), 0 0 0 10px var(--accent-soft)'
                  : 'none',
              borderRadius: 14,
            }}
          >
            <VariablesPanel
              expression={expression}
              onExpression={setExpression}
              mode={mode}
              onMode={setMode}
              variables={variables}
              symbols={symbols}
              parsing={parsing}
              parseError={parseError}
              onPatch={patchVar}
              onRemove={removeVar}
              columns={project.columns}
              bindings={bindings}
              onBinding={patchBinding}
              samples={samples}
              onSamples={setSamples}
              onCompute={compute}
              computing={loading}
            />
          </div>

          {/* Nombre de la magnitud: solo afecta a las etiquetas del resultado. */}
          <div
            style={{
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12.5,
              color: 'var(--muted)',
              padding: '0 4px',
            }}
          >
            <span>La magnitud calculada se llama</span>
            <input
              className="mono"
              value={label}
              onChange={(e) => setLabel(e.target.value || 'z')}
              style={{
                width: 90,
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                borderRadius: 7,
                color: 'var(--ink)',
                padding: '5px 9px',
                fontSize: 13,
              }}
            />
            <span>— se usa en el resultado y en las columnas que se añadan.</span>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 320,
              display: 'flex',
              position: 'relative',
              zIndex: tourActive && tourStep === 3 ? 60 : 'auto',
              boxShadow:
                tourActive && tourStep === 3
                  ? '0 0 0 3px var(--accent), 0 0 0 10px var(--accent-soft)'
                  : 'none',
              borderRadius: 14,
            }}
          >
            <PropagationCard
              result={result}
              tableResult={tableResult}
              error={error}
              loading={loading}
              isDark={theme === 'dark'}
              accent={accent}
              plotRef={plotRef}
              label={label}
              onAddColumns={addColumns}
              onSendTo2D={sendTo2D}
            />
          </div>
        </div>

        {/* La hoja solo pinta algo cuando se trabaja por filas. */}
        {isTable && (
          <DataSheet
            columns={project.columns}
            rowCount={project.rowCount}
            showHelp={showHelp}
            ring={tourActive && tourStep === 2}
            onName={project.setName}
            onRole={project.setRole}
            onCell={project.setCell}
            onAddColumn={project.addColumn}
            onDeleteColumn={project.deleteColumn}
            onClearRange={project.clearRange}
            onPasteBlock={project.pasteBlock}
            helpText={
              <>
                Cada variable de la fórmula se engancha a una columna desde el
                desplegable de arriba. Una variable sin columna es una{' '}
                <b>constante</b> igual en todas las filas. Los <b>roles</b> (X, Y,
                ΔY) solo importan si luego mandas el resultado al entorno 2D.
              </>
            }
          />
        )}
      </div>

      {showWizard && (
        <Wizard
          onClose={() => setShowWizard(false)}
          title="Asistente: propagar incertidumbres"
          steps={WIZARD_STEPS_UNC}
        />
      )}

      {tourActive && (
        <Tour
          step={tourStep}
          steps={TOUR_STEPS_UNC}
          onNext={nextTourStep}
          onStop={() => setTourStep(-1)}
        />
      )}

      <input
        ref={importInputRef}
        type="file"
        accept=".csv,.txt,.dat,.tsv,.prn,.xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
      <input
        ref={openInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleOpenFile}
      />
    </div>
  );
}
