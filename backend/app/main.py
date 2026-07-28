"""API FastAPI de CurvaLab / BestFit.

Backend sin estado: expone el motor de ajuste (SciPy), la propagación de
incertidumbres (SymPy) y la importación de tablas al frontend React. No hay
base de datos ni sesiones; guardar y abrir proyectos es responsabilidad del
cliente (fichero JSON local).
"""
from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from .fitting import FitError, run_fit
from .formula import FormulaError, formula_symbols
from .importer import ImportError_, parse_excel, parse_table
from .schemas import (
    FitRequest,
    FitResponse,
    FormulaSymbolsRequest,
    FormulaSymbolsResponse,
    ImportResponse,
    PropagateRequest,
    PropagateResponse,
    PropagateTableRequest,
    PropagateTableResponse,
    SurfaceFitRequest,
    SurfaceFitResponse,
)
from .surface import run_surface_fit
from .uncertainty import PropagationError, propagate, propagate_table

app = FastAPI(
    title="CurvaLab API",
    description="Motor de ajuste de curvas y análisis de errores (SciPy).",
    version="0.1.0",
)

# CORS solo hace falta en desarrollo: Vite sirve el frontend en localhost:5173
# (o 4173 con `vite preview`) mientras el backend escucha en el 8000. Desplegado
# en Vercel ambos comparten origen y estas cabeceras no llegan a usarse.
# CURVALAB_ORIGINS (lista separada por comas) permite añadir orígenes sin tocar
# el código, por si el frontend acaba sirviéndose desde otro dominio.
_extra_origins = [
    origen.strip()
    for origen in os.environ.get("CURVALAB_ORIGINS", "").split(",")
    if origen.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",  # vite preview
        *_extra_origins,
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    """Comprobación de salud sencilla."""
    return {"status": "ok", "service": "curvalab-api"}


@app.post("/api/fit", response_model=FitResponse)
def fit(req: FitRequest) -> FitResponse:
    """Ajusta el modelo indicado a los datos y devuelve parámetros + bondad."""
    try:
        return run_fit(req)
    except FitError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/fit-surface", response_model=SurfaceFitResponse)
def fit_surface(req: SurfaceFitRequest) -> SurfaceFitResponse:
    """Ajusta una superficie z = f(x,y) y devuelve parámetros + malla.

    Es el motor del entorno 3D (/3d): trabaja con tres columnas de puntos
    dispersos y sin barras de error.
    """
    try:
        return run_surface_fit(req)
    except FitError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/propagate", response_model=PropagateResponse)
def propagate_uncertainty(req: PropagateRequest) -> PropagateResponse:
    """Propaga incertidumbres a una medida indirecta z = f(x, y, ...).

    Devuelve a la vez el resultado analítico (derivadas simbólicas de SymPy) y
    el de la simulación Monte Carlo, para poder compararlos.
    """
    try:
        return propagate(req)
    except PropagationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/propagate-table", response_model=PropagateTableResponse)
def propagate_uncertainty_table(req: PropagateTableRequest) -> PropagateTableResponse:
    """Aplica la fórmula fila a fila y propaga el error en cada una."""
    try:
        return propagate_table(req)
    except PropagationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/formula-symbols", response_model=FormulaSymbolsResponse)
def formula_symbols_endpoint(req: FormulaSymbolsRequest) -> FormulaSymbolsResponse:
    """Lista las variables que aparecen en una fórmula.

    Permite que la tabla de variables del entorno de propagación se construya
    sola conforme el usuario escribe, sin duplicar el parser en el navegador.
    """
    try:
        return FormulaSymbolsResponse(symbols=formula_symbols(req.expression))
    except FormulaError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/import", response_model=ImportResponse)
async def import_file(file: UploadFile = File(...)) -> ImportResponse:
    """Importa un CSV/TXT/XLSX subido y devuelve columnas y filas numéricas.

    El Excel (binario) se enruta a `parse_excel`; todo lo demás se trata como
    texto (CSV/TXT/DAT/TSV) y se enruta a `parse_table`.
    """
    raw = await file.read()
    filename = file.filename or ""
    try:
        if filename.lower().endswith((".xlsx", ".xls")):
            return parse_excel(raw, filename)
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = raw.decode("latin-1")
        return parse_table(text)
    except ImportError_ as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/import-text", response_model=ImportResponse)
def import_text(payload: dict) -> ImportResponse:
    """Importa datos pegados como texto (portapapeles) desde el frontend."""
    text = payload.get("text", "")
    try:
        return parse_table(text)
    except ImportError_ as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
