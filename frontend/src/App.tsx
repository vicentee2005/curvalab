// CurvaLab — aplicación principal. Orquesta estado, menús y acciones.
import { useEffect, useRef, useState } from 'react';
import { Toolbar, type MenuDef } from './components/Toolbar';
import { PlotCard } from './components/PlotCard';
import { ResultsPanel } from './components/ResultsPanel';
import { DataSheet } from './components/DataSheet';
import { Wizard } from './components/Wizard';
import { Tour } from './components/Tour';
import { DegreeDialog, CustomDialog } from './components/FitDialog';
import { useProject } from './hooks/useProject';
import { useAppTheme } from './hooks/useAppTheme';
import { fitCurve, importFile, importText, ApiError } from './api';
import { buildFitRequest, extractFitData, isExtractError } from './lib/fitData';
import type {
  ChartConfig,
  ChartType,
  Column,
  FitModelId,
  FitResult,
  Handoff,
  PlotView,
  ProjectFile,
  Role,
} from './types';
import { DEFAULT_CHART_CONFIG, HANDOFF_KEY } from './types';

type Dialog = null | { kind: 'degree' } | { kind: 'custom' };

export default function App() {
  const project = useProject();
  // Tema y acento viven en un hook compartido con la portada y el entorno 3D.
  const { theme, setTheme, toggleTheme, accent, setAccent } = useAppTheme();
  const [showWizard, setShowWizard] = useState(true);
  const [showHelp, setShowHelp] = useState(true);
  const [tourStep, setTourStep] = useState(-1);
  const [dialog, setDialog] = useState<Dialog>(null);

  // Estado de la gráfica: se empieza en la pestaña de configuración y no hay
  // gráfica hasta que el usuario la crea explícitamente.
  const [plotView, setPlotView] = useState<PlotView>('config');
  const [chartConfig, setChartConfig] = useState<ChartConfig>(DEFAULT_CHART_CONFIG);
  const [chartCreated, setChartCreated] = useState(false);

  const patchChart = (patch: Partial<ChartConfig>) =>
    setChartConfig((c) => ({ ...c, ...patch }));

  /** Crea (o actualiza) la gráfica y salta a la vista de la gráfica. */
  function createChart() {
    setChartCreated(true);
    setPlotView('plot');
  }

  /** Elegir un tipo desde el menú Gráfico crea la gráfica directamente. */
  function setChartType(type: ChartType) {
    setChartConfig((c) => ({ ...c, type }));
    setChartCreated(true);
    setPlotView('plot');
  }

  const [fit, setFit] = useState<FitResult | null>(null);
  const [fitError, setFitError] = useState<string | null>(null);
  const [fitLoading, setFitLoading] = useState(false);

  const plotRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const openInputRef = useRef<HTMLInputElement | null>(null);

  // --- Acciones de ajuste ------------------------------------------------- //
  async function runFit(
    model: FitModelId,
    opts: {
      degree?: number;
      expression?: string;
      parameters?: string[];
      initialGuess?: number[];
    } = {},
  ) {
    const data = extractFitData(project.columns);
    if (isExtractError(data)) {
      setFit(null);
      setFitError(data.message);
      return;
    }
    setFitLoading(true);
    setFitError(null);
    try {
      const req = buildFitRequest(data, model, opts);
      const result = await fitCurve(req);
      setFit(result);
      setFitError(null);
    } catch (e) {
      setFit(null);
      setFitError(e instanceof ApiError ? e.message : 'Error al ajustar.');
    } finally {
      setFitLoading(false);
    }
  }

  // Datos que llegan de otro entorno (p. ej. la columna z ± σz calculada en el
  // de incertidumbres). Se recogen una sola vez y se borra el traspaso.
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(HANDOFF_KEY);
      if (raw) localStorage.removeItem(HANDOFF_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const handoff = JSON.parse(raw) as Handoff;
      if (!handoff?.columns?.length) return;
      project.loadColumns(handoff.columns);
      resetChart();
      setChartConfig((c) => ({ ...c, xLabel: '', yLabel: '', title: '', seriesName: '' }));
    } catch {
      /* traspaso corrupto: se ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-ajustar automáticamente cuando cambian los datos, si ya hay un ajuste.
  const lastModel = fit?.model;
  useEffect(() => {
    if (!lastModel) return;
    // Solo re-ajuste de modelos sin parámetros extra (lineal/exp/log/power).
    if (lastModel === 'polynomial' || lastModel === 'custom') return;
    const t = setTimeout(() => runFit(lastModel), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.columns]);

  // --- Archivo ------------------------------------------------------------ //
  function handleNewProject() {
    project.newProject();
    setFit(null);
    setFitError(null);
    resetChart();
  }

  /** Al cambiar los datos de raíz la gráfica deja de ser válida: hay que
   *  volver a pasar por la pestaña "Gráfica" y crearla de nuevo. */
  function resetChart() {
    setChartCreated(false);
    setPlotView('config');
  }

  function handleSave() {
    const data: ProjectFile = {
      ...project.toProjectFile(accent, theme),
      chartConfig,
      chartCreated,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'proyecto-curvalab.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleOpenClick() {
    openInputRef.current?.click();
  }

  async function handleOpenFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as ProjectFile;
      if (data.app !== 'CurvaLab') throw new Error('bad');
      project.loadProjectFile(data);
      if (data.accent) setAccent(data.accent);
      if (data.theme) setTheme(data.theme);
      // Los proyectos guardados antes de esta función no traen configuración.
      setChartConfig({ ...DEFAULT_CHART_CONFIG, ...(data.chartConfig ?? {}) });
      const restored = data.chartCreated ?? false;
      setChartCreated(restored);
      setPlotView(restored ? 'plot' : 'config');
      setFit(null);
      setFitError(null);
    } catch {
      setFitError('No se pudo abrir el proyecto (¿es un .json de CurvaLab?).');
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
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

  // Vuelca datos importados en columnas nuevas. Usa los roles sugeridos por la
  // importación inteligente del backend; si no vienen, cae a X/Y posicional.
  function applyImported(
    colNames: string[],
    rows: (number | null)[][],
    roles?: string[],
  ) {
    const palette = ['#3a6df0', '#e8663d', '#2f9e63', '#7c5cff', '#0e9d8f', '#d9488a'];
    const validRoles = new Set<Role>(['', 'x', 'y', 'z', 'ex', 'ey', 'ez']);
    const cols: Column[] = colNames.map((name, i) => {
      const suggested = roles?.[i];
      const role: Role =
        suggested && validRoles.has(suggested as Role)
          ? (suggested as Role)
          : i === 0
            ? 'x'
            : i === 1
              ? 'y'
              : '';
      return {
        id: `imp-${Date.now()}-${i}`,
        name: name || `col${i + 1}`,
        role,
        color: palette[i % palette.length],
        values: rows.map((r) => (r[i] == null ? '' : String(r[i]))),
      };
    });
    if (cols.length > 0) {
      project.loadColumns(cols);
      setFit(null);
      setFitError(null);
      // Los datos entran en la hoja, pero la gráfica NO se crea sola: el
      // usuario decide el tipo de representación en la pestaña "Gráfica".
      resetChart();
      // Las etiquetas heredan los nombres de las columnas importadas.
      setChartConfig((c) => ({ ...c, xLabel: '', yLabel: '', title: '', seriesName: '' }));
    }
  }

  function handleExportPlot() {
    const el = plotRef.current as any;
    if (el && (window as any).Plotly) {
      (window as any).Plotly.downloadImage(el, {
        format: 'png',
        filename: 'curvalab-grafica',
        width: 1200,
        height: 750,
      });
    }
  }

  // --- Menús -------------------------------------------------------------- //
  const menus: MenuDef[] = [
    {
      id: 'archivo',
      label: 'Archivo',
      items: [
        { label: 'Nuevo proyecto', shortcut: 'Ctrl+N', onClick: handleNewProject },
        { label: 'Abrir…', shortcut: 'Ctrl+O', onClick: handleOpenClick },
        { divider: true },
        { label: 'Importar CSV / TXT / Excel', onClick: handleImportClick },
        { label: 'Pegar datos del portapapeles', shortcut: 'Ctrl+V', onClick: handlePaste },
        { divider: true },
        { label: 'Guardar', shortcut: 'Ctrl+S', onClick: handleSave },
        { label: 'Exportar gráfica (PNG)', onClick: handleExportPlot },
      ],
    },
    {
      id: 'grafico',
      label: 'Gráfico',
      items: [
        { label: 'Configurar gráfica…', onClick: () => setPlotView('config') },
        { divider: true },
        { label: 'Tipo: dispersión', onClick: () => setChartType('scatter') },
        { label: 'Tipo: líneas', onClick: () => setChartType('lines') },
        { label: 'Tipo: puntos y líneas', onClick: () => setChartType('lines+markers') },
        { label: 'Tipo: barras', onClick: () => setChartType('bars') },
        { divider: true },
        { label: 'Títulos y leyendas…', onClick: () => setPlotView('config') },
        {
          label: chartConfig.showGrid ? 'Ocultar cuadrícula' : 'Mostrar cuadrícula',
          onClick: () => patchChart({ showGrid: !chartConfig.showGrid }),
        },
        {
          label: chartConfig.showLegend ? 'Ocultar leyenda' : 'Mostrar leyenda',
          onClick: () => patchChart({ showLegend: !chartConfig.showLegend }),
        },
      ],
    },
    {
      id: 'analisis',
      label: 'Análisis',
      items: [
        { label: 'Ajuste lineal', onClick: () => runFit('linear') },
        { label: 'Ajuste polinómico…', onClick: () => setDialog({ kind: 'degree' }) },
        { label: 'Ajuste exponencial', onClick: () => runFit('exponential') },
        { label: 'Ajuste logarítmico', onClick: () => runFit('logarithmic') },
        { label: 'Ajuste potencial (y = a·xᵇ)', onClick: () => runFit('power') },
        { label: 'Ajuste no lineal (fórmula propia)…', onClick: () => setDialog({ kind: 'custom' }) },
        { divider: true },
        { label: 'Estadísticas descriptivas', disabled: true },
        { label: 'Interpolación', disabled: true },
      ],
    },
    {
      id: 'ayuda',
      label: 'Ayuda',
      items: [
        { label: 'Guía de inicio rápido', onClick: () => setTourStep(0) },
        { label: 'Tutoriales', disabled: true },
        { label: 'Atajos de teclado', disabled: true },
        { divider: true },
        { label: 'Acerca de CurvaLab', disabled: true },
      ],
    },
  ];

  // Atajos de teclado básicos.
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
        handleOpenClick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tourActive = tourStep >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflow: 'hidden' }}>
      <Toolbar
        menus={menus}
        brand="CurvaLab 2D"
        switchLinks={[
          { to: '/3d', label: 'Superficies 3D' },
          { to: '/incertidumbres', label: 'Incertidumbres' },
        ]}
        onToggleWizard={() => setShowWizard((v) => !v)}
        onToggleTheme={toggleTheme}
        onToggleHelp={() => setShowHelp((v) => !v)}
        isDark={theme === 'dark'}
        ringToolbar={tourActive && tourStep === 0}
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0, padding: 'var(--gap)', gap: 'var(--gap)' }}>
        {/* Columna central */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: 'var(--gap)' }}>
          <PlotCard
            columns={project.columns}
            dimension={project.dimension}
            onDimension={project.setDimension}
            view={plotView}
            onView={setPlotView}
            config={chartConfig}
            onConfigChange={patchChart}
            created={chartCreated}
            onCreate={createChart}
            fit={fit}
            isDark={theme === 'dark'}
            accent={accent}
            ring={tourActive && tourStep === 1}
            plotRef={plotRef}
          />
          <ResultsPanel
            fit={fit}
            error={fitError}
            loading={fitLoading}
            ring={tourActive && tourStep === 3}
          />
        </div>

        {/* Panel derecho */}
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
        />
      </div>

      {showWizard && (
        <Wizard onClose={() => setShowWizard(false)} ring={tourActive && tourStep === 4} />
      )}

      {tourActive && (
        <Tour
          step={tourStep}
          onNext={() => setTourStep((s) => (s + 1 >= 4 ? -1 : s + 1))}
          onStop={() => setTourStep(-1)}
        />
      )}

      {dialog?.kind === 'degree' && (
        <DegreeDialog
          onCancel={() => setDialog(null)}
          onConfirm={(degree) => {
            setDialog(null);
            runFit('polynomial', { degree });
          }}
        />
      )}
      {dialog?.kind === 'custom' && (
        <CustomDialog
          onCancel={() => setDialog(null)}
          onConfirm={(expression, parameters, initialGuess) => {
            setDialog(null);
            runFit('custom', { expression, parameters, initialGuess });
          }}
        />
      )}

      {/* Inputs de fichero ocultos */}
      <input
        ref={fileInputRef}
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
