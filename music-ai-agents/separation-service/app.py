"""
Servicio de separación de instrumentos con Demucs (htdemucs_6s).

Comunicación con el backend Node mediante PCM crudo float32 little-endian
(mono) para evitar cualquier problema de formatos de audio entre servicios:

  POST /separate
    header  X-Sample-Rate: <int>        (sample rate del PCM enviado)
    body    bytes = float32 LE mono PCM
    ->      JSON { "sampleRate": 44100,
                   "stems": { "drums": <base64 float32 mono>, "bass": ..., ... } }

El modelo se carga una sola vez al arrancar. Inferencia en CPU.
"""

import base64
import io
import os
import time

import numpy as np
import torch
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from demucs.pretrained import get_model
from demucs.apply import apply_model

MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs_6s")

app = FastAPI(title="MusicLab AI — Separation Service")

_model = None


def get_cached_model():
    global _model
    if _model is None:
        print(f"[demucs] cargando modelo {MODEL_NAME}...", flush=True)
        t0 = time.time()
        m = get_model(MODEL_NAME)
        m.eval()
        _model = m
        print(f"[demucs] modelo listo en {time.time() - t0:.1f}s — stems: {m.sources}", flush=True)
    return _model


@app.on_event("startup")
def _warmup():
    # Cargamos el modelo al arrancar para que la primera petición no pague la carga.
    get_cached_model()


@app.get("/health")
def health():
    return {"status": "healthy", "model": MODEL_NAME, "loaded": _model is not None}


@app.post("/separate")
async def separate(request: Request):
    sample_rate = int(request.headers.get("X-Sample-Rate", "44100"))
    raw = await request.body()
    if len(raw) == 0:
        return JSONResponse({"error": "cuerpo vacío"}, status_code=400)

    mono = np.frombuffer(raw, dtype="<f4").copy()
    if mono.size == 0:
        return JSONResponse({"error": "PCM inválido"}, status_code=400)

    model = get_cached_model()
    target_sr = model.samplerate

    wav = torch.from_numpy(mono).float().unsqueeze(0)  # (1, N)

    # Resample al sample rate del modelo si hace falta.
    if sample_rate != target_sr:
        import torchaudio

        wav = torchaudio.functional.resample(wav, sample_rate, target_sr)

    # Demucs espera estéreo (2 canales).
    wav = wav.repeat(2, 1)

    ref = wav.mean(0)
    std = ref.std() + 1e-8
    wav_n = (wav - ref.mean()) / std

    t0 = time.time()
    with torch.no_grad():
        sources = apply_model(model, wav_n[None], device="cpu", progress=False)[0]
    sources = sources * std + ref.mean()
    elapsed = time.time() - t0

    stems = {}
    for i, name in enumerate(model.sources):
        stem_mono = sources[i].mean(0).numpy().astype("<f4")  # downmix a mono
        stems[name] = base64.b64encode(stem_mono.tobytes()).decode("ascii")

    print(f"[demucs] separado en {elapsed:.1f}s ({len(mono)/sample_rate:.1f}s de audio)", flush=True)

    return {"sampleRate": target_sr, "stems": stems, "elapsedSec": round(elapsed, 1)}
