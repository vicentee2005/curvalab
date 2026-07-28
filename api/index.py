"""Punto de entrada de la API en Vercel.

En local el backend se arranca con `uvicorn app.main:app` desde `backend/`. En
Vercel, cada fichero de `api/` se convierte en una función serverless, así que
aquí solo se añade `backend/` al path y se reexporta la misma aplicación
FastAPI: el motor de cálculo es exactamente el mismo en los dos sitios.

El runtime de Python de Vercel busca una variable llamada `app` con una
aplicación ASGI, y `vercel.json` reescribe todo `/api/*` hacia este fichero
conservando la ruta original, que es la que ve FastAPI.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Mismo import que en local: `app.main`, con backend/ como raíz.
BACKEND = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.main import app  # noqa: E402  (el sys.path tiene que ir antes)

__all__ = ["app"]
