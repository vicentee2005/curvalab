// CurvaLab 3D — entorno de ajuste de superficies z = f(x, y).
//
// Independiente del entorno 2D: su propia hoja (tres columnas, sin errores),
// su propio motor (/api/fit-surface) y su propia escena rotable. Lo único que
// comparte es el aspecto visual, la barra superior y la hoja de cálculo.
import { useEffect, useMemo, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Toolbar, type MenuDef } from '../components/Toolbar';
import { DataSheet } from '../components/DataSheet';
import { SurfaceCard } from '../components/SurfaceCard';
import { SurfaceResults } from '../components/SurfaceResults';
import { Wizard, WIZARD_STEPS_3D } from '../components/Wizard';
import { Tour, TOUR_STEPS_3D } from '../components/Tour';
import { DEFAULT_CAMERA } from '../components/SurfacePlot';
import {
  SurfaceCustomDialog,
  SurfaceDegreeDialog,
} from '../components/SurfaceFitDialog';
import { useProject } from '../hooks/useProject';
import { useAppTheme } from '../hooks/useAppTheme';
import { ROLE_OPTIONS_3D } from '../lib/roles';
import { extractSurfaceData, isSurfaceError } from '../lib/surfaceData';
import { fitSurface, importFile, importText, ApiError } from '../api';
import type {
  Camera3D,
  Column,
  PlotView,
  Role,
  Surface3DConfig,
  Surface3DProjectFile,
  SurfaceFitResult,
  SurfaceModelId,
} from '../types';
import { DEFAULT_SURFACE_CONFIG } from '../types';

type Dialog = null | { kind: 'degree' } | { kind: 'custom' };

/** Perspectivas predefinidas del menú Vista. */
const VIEWS: Record<string, Camera3D> = {
  inicial: DEFAULT_CAMERA,
  planta: { eye: { x: 0, y: 0, z: 2.4 }, up: { x: 0, y: 1, z: 0 } },
  alzado: { eye: { x: 0, y: -2.5, z: 0.05 }, up: { x: 0, y: 0, z: 1 } },
  perfil: { eye: { x: 2.5, y: 0, z: 0.05 }, up: { x: 0, y: 0, z: 1 } },
};

export function Surface3D() {
  const project = useProject('3d');
  const { theme, toggleTheme, accent, setAccent, setTheme } = useAppTheme();

  const [view, setView] = useState<PlotView>('config');
  const [config, setConfig] = useState<Surface3DConfig>(DEFAULT_SURFACE_CONFIG);
  const [created, setCreated] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  // Ayuda: asistente flotante, consejos de la hoja y guía de inicio, igual que
  // en el 2D pero con los textos de este entorno.
  const [showWizard, setShowWizard] = useState(true);
  const [showHelp, setShowHelp] = useState(true);
  const [tourStep, setTourStep] = useState(-1);
  const tourActive = tourStep >= 0;

  const [fit, setFit] = useState<SurfaceFitResult | null>(null);
  const [fitError, setFitError] = useState<string | null>(null);
  const [fitLoading, setFitLoading] = useState(false);

  const cameraRef = useRef<Camera3D | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const openInputRef = useRef<HTMLInputElement | null>(null);

  const patchConfig = (patch: Partial<Surface3DConfig>) =>
    setConfig((c) => ({ ...c, ...patch }));

  // --- Datos y etiquetas -------------------------------------------------- //
  const extracted = useMemo(
    () => extractSurfaceData(project.columns),
    [project.columns],
  );
  const dataError = isSurfaceError(extracted) ? extracted.message : null;
  const data = isSurfaceError(extracted) ? null : extracted;

  const derived = {
    x: project.columns.find((c) => c.role === 'x')?.name || 'X',
    y: project.columns.find((c) => c.role === 'y')?.name || 'Y',
    z: project.columns.find((c) => c.role === 'z')?.name || 'Z',
  };
  const labels = {
    x: config.xLabel.trim() || derived.x,
    y: config.yLabel.trim() || derived.y,
    z: config.zLabel.trim() || derived.z,
  };
  const title =
    config.title.trim() || `${derived.z} frente a ${derived.x} e ${derived.y}`;

  // --- Ajuste ------------------------------------------------------------- //
  async function runFit(
    model: SurfaceModelId,
    opts: { degree?: number; expression?: string; parameters?: string[]; initialGuess?: number[] } = {},
  ) {
    if (!data) {
      setFit(null);
      setFitError(dataError);
      return;
    }
    setFitLoading(true);
    setFitError(null);
    try {
      const result = await fitSurface({
        model,
        x: data.x,
        y: data.y,
        z: data.z,
        degree: opts.degree,
        expression: opts.expression ?? null,
        parameters: opts.parameters ?? null,
        initial_guess: opts.initialGuess ?? null,
        grid_points: 55,
      });
      setFit(result);
      setFitError(null);
      // Un ajuste solo se ve si la escena existe: la creamos si hacía falta.
      setCreated(true);
      setView('plot');
    } catch (e) {
      setFit(null);
      setFitError(e instanceof ApiError ? e.message : 'Error al ajustar la superficie.');
    } finally {
      setFitLoading(false);
    }
  }

  // Re-ajustar al cambiar los datos, solo en los modelos sin parámetros extra.
  const lastModel = fit?.model;
  useEffect(() => {
    if (lastModel !== 'plane' && lastModel !== 'gaussian2d') return;
    const t = setTimeout(() => runFit(lastModel), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.columns]);

  // --- Escena ------------------------------------------------------------- //
  function applyCamera(cam: Camera3D) {
    cameraRef.current = cam;
    const el = plotRef.current as any;
    if (el && el.data) Plotly.relayout(el, { 'scene.camera': cam } as any);
  }

  /** Descarga un PNG con exactamente la perspectiva que se está viendo. */
  function exportImage() {
    const el = plotRef.current as any;
    if (!el || !el.data) {
      setFitError('Crea primero la gráfica para poder exportarla.');
      return;
    }
    Plotly.downloadImage(el, {
      format: 'png',
      filename: 'curvalab-superficie',
      width: 1400,
      height: 900,
    });
  }

  function createChart() {
    setCreated(true);
    setView('plot');
  }

  /** Al cambiar los datos de raíz la escena deja de valer: hay que recrearla. */
  function resetChart() {
    setCreated(false);
    setView('config');
    setFit(null);
  }

  // --- Archivo ------------------------------------------------------------ //
  function handleNewProject() {
    project.newProject();
    setFitError(null);
    resetChart();
  }

  function handleSave() {
    const file: Surface3DProjectFile = {
      version: 1,
      app: 'CurvaLab3D',
      columns: project.columns,
      accent,
      theme,
      savedAt: new Date().toISOString(),
      config,
      created,
      camera: cameraRef.current,
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'proyecto-curvalab-3d.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleOpenFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Surface3DProjectFile;
      if (parsed.app !== 'CurvaLab3D') {
        setFitError(
          'Ese proyecto es del entorno 2D. Ábrelo desde el enlace de ajuste de curvas.',
        );
        return;
      }
      project.loadColumns(parsed.columns);
      if (parsed.accent) setAccent(parsed.accent);
      if (parsed.theme) setTheme(parsed.theme);
      setConfig({ ...DEFAULT_SURFACE_CONFIG, ...(parsed.config ?? {}) });
      cameraRef.current = parsed.camera ?? null;
      const restored = parsed.created ?? false;
      setCreated(restored);
      setView(restored ? 'plot' : 'config');
      setFit(null);
      setFitError(null);
    } catch {
      setFitError('No se pudo abrir el proyecto (¿es un .json de CurvaLab 3D?).');
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const result = await importFile(file);
      applyImported(result.columns, result.rows, result.roles);
    } catch (err) {
      setFitError(err instanceof ApiError ? err.message : 'No se pudo importar el fichero.');
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setFitError('El portapapeles está vacío.');
        return;
      }
      const result = await importText(text);
      applyImported(result.columns, result.rows, result.roles);
    } catch (err) {
      setFitError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo leer el portapapeles (permite el acceso o pega en las celdas).',
      );
    }
  }

  function applyImported(colNames: string[], rows: (number | null)[][], roles?: string[]) {
    const palette = ['#3a6df0', '#e8663d', '#2f9e63', '#7c5cff', '#0e9d8f', '#d9488a'];
    const assigned = assignRoles3D(colNames.length, roles);
    const cols: Column[] = colNames.map((name, i) => ({
      id: `imp3d-${Date.now()}-${i}`,
      name: name || `col${i + 1}`,
      role: assigned[i],
      color: palette[i % palette.length],
      values: rows.map((r) => (r[i] == null ? '' : String(r[i]))),
    }));
    if (cols.length === 0) return;
    project.loadColumns(cols);
    setFitError(null);
    resetChart();
    // Las etiquetas vuelven a heredar los nombres de las columnas importadas.
    setConfig((c) => ({ ...c, xLabel: '', yLabel: '', zLabel: '', title: '' }));
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
        { label: 'Exportar imagen (PNG)', onClick: exportImage },
      ],
    },
    {
      id: 'vista',
      label: 'Vista',
      items: [
        { label: 'Configurar gráfica…', onClick: () => setView('config') },
        { divider: true },
        { label: 'Perspectiva inicial', onClick: () => applyCamera(VIEWS.inicial) },
        { label: 'Planta (desde arriba)', onClick: () => applyCamera(VIEWS.planta) },
        { label: 'Alzado (plano X–Z)', onClick: () => applyCamera(VIEWS.alzado) },
        { label: 'Perfil (plano Y–Z)', onClick: () => applyCamera(VIEWS.perfil) },
        { divider: true },
        {
          label: config.showGrid ? 'Ocultar cuadrícula' : 'Mostrar cuadrícula',
          onClick: () => patchConfig({ showGrid: !config.showGrid }),
        },
        {
          label: config.showColorbar ? 'Ocultar barra de color' : 'Mostrar barra de color',
          onClick: () => patchConfig({ showColorbar: !config.showColorbar }),
        },
      ],
    },
    {
      id: 'analisis',
      label: 'Análisis',
      items: [
        { label: 'Plano (z = a·x + b·y + c)', onClick: () => runFit('plane') },
        { label: 'Superficie polinómica…', onClick: () => setDialog({ kind: 'degree' }) },
        { label: 'Gaussiana 2D (campana)', onClick: () => runFit('gaussian2d') },
        { label: 'Fórmula propia z = f(x, y)…', onClick: () => setDialog({ kind: 'custom' }) },
        { divider: true },
        {
          label: 'Quitar la superficie ajustada',
          disabled: !fit,
          onClick: () => {
            setFit(null);
            setFitError(null);
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
        { label: 'Atajos de teclado', disabled: true },
        { divider: true },
        { label: 'Acerca de CurvaLab', disabled: true },
      ],
    },
  ];

  // Atajos de teclado (los mismos que en el 2D).
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
  }, [project.columns, config, created]);

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
        brand="CurvaLab 3D"
        switchLinks={[
          { to: '/2d', label: 'Ajuste 2D' },
          { to: '/incertidumbres', label: 'Incertidumbres' },
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
          }}
        >
          <SurfaceCard
            data={data}
            blockedReason={dataError}
            fit={fit}
            config={config}
            onConfigChange={patchConfig}
            view={view}
            onView={setView}
            created={created}
            onCreate={createChart}
            derived={derived}
            labels={labels}
            title={title}
            isDark={theme === 'dark'}
            accent={accent}
            cameraRef={cameraRef}
            plotRef={plotRef}
            onExport={exportImage}
            onResetView={() => applyCamera(DEFAULT_CAMERA)}
            ring={tourActive && tourStep === 1}
          />
          <SurfaceResults
            fit={fit}
            error={fitError}
            loading={fitLoading}
            ring={tourActive && tourStep === 3}
          />
        </div>

        <DataSheet
          columns={project.columns}
          rowCount={project.rowCount}
          showHelp={showHelp}
          ring={tourActive && tourStep === 2}
          roleOptions={ROLE_OPTIONS_3D}
          helpText={
            <>
              Arrastra para seleccionar un rango; <b>Ctrl+C/V/X</b> para copiar,
              pegar o cortar y <b>Supr</b> para borrar. Doble clic (o empieza a
              escribir) para editar una celda. La superficie necesita las tres
              coordenadas: una <b>X</b>, una <b>Y</b> y una <b>Z</b>. Los puntos
              no tienen que estar en rejilla.
            </>
          }
          onName={project.setName}
          onRole={project.setRole}
          onCell={project.setCell}
          onAddColumn={project.addColumn}
          onDeleteColumn={project.deleteColumn}
          onClearRange={project.clearRange}
          onPasteBlock={project.pasteBlock}
        />
      </div>

      {showWizard && (
        <Wizard
          onClose={() => setShowWizard(false)}
          title="Asistente: ajustar una superficie"
          steps={WIZARD_STEPS_3D}
        />
      )}

      {tourActive && (
        <Tour
          step={tourStep}
          steps={TOUR_STEPS_3D}
          onNext={() => setTourStep((s) => (s + 1 >= TOUR_STEPS_3D.length ? -1 : s + 1))}
          onStop={() => setTourStep(-1)}
        />
      )}

      {dialog?.kind === 'degree' && (
        <SurfaceDegreeDialog
          onCancel={() => setDialog(null)}
          onConfirm={(degree) => {
            setDialog(null);
            runFit('poly2d', { degree });
          }}
        />
      )}
      {dialog?.kind === 'custom' && (
        <SurfaceCustomDialog
          onCancel={() => setDialog(null)}
          onConfirm={(expression, parameters, initialGuess) => {
            setDialog(null);
            runFit('custom', { expression, parameters, initialGuess });
          }}
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

/**
 * Traduce los roles sugeridos por la importación inteligente al entorno 3D.
 *
 * Aquí no existen las columnas de error, así que un ΔX sugerido se queda sin
 * asignar; y como el 3D necesita las tres coordenadas, las que falten se
 * rellenan por posición con las columnas libres (de izquierda a derecha).
 */
function assignRoles3D(nCols: number, roles?: string[]): Role[] {
  const out: Role[] = Array.from({ length: nCols }, (_, i) => {
    const r = roles?.[i];
    return r === 'x' || r === 'y' || r === 'z' ? (r as Role) : '';
  });
  for (const wanted of ['x', 'y', 'z'] as const) {
    if (out.includes(wanted)) continue;
    const free = out.findIndex((r) => r === '');
    if (free === -1) break;
    out[free] = wanted;
  }
  return out;
}
