# Imagen del backend de CurvaLab (FastAPI + SciPy + SymPy).
#
# Se despliega en Hugging Face Spaces con SDK "docker". El frontend NO va aquí:
# se compila aparte y se sirve como sitio estático en Vercel.
#
# Por qué separados: numpy + scipy + sympy ocupan unos 240 MB descomprimidos y
# una función serverless de Vercel no puede pasar de 225 MB. En una imagen
# Docker no hay ese límite.
FROM python:3.12-slim

WORKDIR /app

# Las dependencias primero, para que Docker reutilice la caché mientras solo
# cambie el código.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app

# Hugging Face Spaces enruta el tráfico al puerto 7860.
EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
