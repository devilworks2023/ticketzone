# Servicio de separación de instrumentos (Demucs) para MusicLab AI.
# Se despliega como un servicio APARTE del backend/web principal porque
# torch + demucs pesan mucho y necesitan bastante memoria (recomendado >= 2 GB RAM).

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./

# Pre-descarga el modelo en build para que el arranque en producción sea rápido
# y no dependa de la red en tiempo de ejecución.
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs_6s')"

ENV DEMUCS_MODEL=htdemucs_6s
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
