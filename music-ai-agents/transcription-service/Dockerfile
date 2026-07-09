# Servicio de transcripción multi-instrumento (MT3) para MusicLab AI.
#
# ADVERTENCIA: imagen grande y pesada (jax + tensorflow + t5x + checkpoint).
# Necesita bastante memoria (recomendado >= 3-4 GB RAM). La transcripción en CPU
# tarda ~0.8x el tiempo real del audio. Es un servicio EXPLORATORIO/costoso.

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git build-essential libsndfile1 ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

# 1) Clonar MT3 e instalar su stack (t5x/flax/tensorflow/seqio/note-seq desde git,
#    igual que el colab oficial). Fijamos jax a la versión validada.
RUN git clone --depth 1 --branch main https://github.com/magenta/mt3 /mt3

# t5x depende de 'tensorflow-cpu', que NO tiene wheels para arm64 (Apple Silicon).
# Clonamos t5x, cambiamos esa dependencia por 'tensorflow' (que sí tiene wheel
# aarch64) y lo instalamos antes que mt3. Además quitamos la referencia por URL a
# t5x dentro de mt3 para que use el t5x ya instalado (y no reinstale el original).
# En x86_64 el cambio es inocuo. Esto mantiene el build NATIVO (sin emular x86,
# que rompería TensorFlow por AVX bajo Rosetta).
RUN git clone --depth 1 https://github.com/google-research/t5x /t5x \
    && grep -rlZ 'tensorflow-cpu' /t5x --include='*.txt' --include='setup.py' 2>/dev/null \
       | xargs -0 -r sed -i 's/tensorflow-cpu/tensorflow/g'

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt \
    && pip install --no-cache-dir /t5x \
    && sed -i "s|t5x @ git+https://github.com/google-research/t5x#egg=t5x|t5x|" /mt3/setup.py \
    && pip install --no-cache-dir -e /mt3

# 2) Descargar el checkpoint multi-instrumento (~172 MB) en build para que el
#    arranque en producción no dependa de la red.
RUN mkdir -p /mt3/checkpoints && python - <<'PY'
import json, os, urllib.request, urllib.parse
items, tok = [], None
while True:
    url = "https://storage.googleapis.com/storage/v1/b/mt3/o?prefix=checkpoints/mt3/" + (f"&pageToken={tok}" if tok else "")
    d = json.load(urllib.request.urlopen(url, timeout=120)); items += d.get('items', []); tok = d.get('nextPageToken')
    if not tok: break
root = "/mt3/checkpoints"
for it in items:
    name = it['name']
    if name.endswith('/'): continue
    dst = os.path.join(root, name[len('checkpoints/'):])
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    urllib.request.urlretrieve("https://storage.googleapis.com/mt3/" + urllib.parse.quote(name), dst)
print("checkpoint descargado")
PY

COPY inference.py app.py /app/

ENV MT3_CHECKPOINT=/mt3/checkpoints/mt3
ENV MT3_GIN_DIR=/mt3/mt3/gin
ENV MT3_MODEL_TYPE=mt3
ENV JAX_PLATFORMS=cpu
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
