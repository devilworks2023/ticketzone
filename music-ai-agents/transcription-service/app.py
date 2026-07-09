"""
Servicio de transcripción multi-instrumento con MT3 (magenta/mt3).

Comunicación con el backend Node por PCM crudo float32 little-endian (mono):

  POST /transcribe
    header  X-Sample-Rate: <int>
    body    bytes = float32 LE mono PCM
    ->      JSON {
              "durationSec": 14.3,
              "elapsedSec": 11.7,
              "fullMidiBase64": "...",              # MIDI multipista completo
              "instruments": [
                {"program": 33, "name": "Electric Bass (finger)",
                 "isDrum": false, "noteCount": 5, "midiBase64": "..."}
              ]
            }

El modelo MT3 se carga una vez al arrancar. Inferencia en CPU.
"""

import asyncio
import base64
import os
import tempfile
import time

import numpy as np
import librosa
import note_seq
import pretty_midi
import nest_asyncio
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from inference import InferenceModel, SAMPLE_RATE

# MT3/t5x/tensorstore usan asyncio.run() internamente; nest_asyncio permite
# esas llamadas anidadas dentro de contextos con event loop.
nest_asyncio.apply()

CHECKPOINT = os.environ.get("MT3_CHECKPOINT", "/mt3/checkpoints/mt3")
MODEL_TYPE = os.environ.get("MT3_MODEL_TYPE", "mt3")
# Tope de duración a transcribir (segundos). MT3 en CPU va ~0.8x tiempo real;
# un tope evita esperas desmedidas con pistas muy largas.
MAX_SECONDS = int(os.environ.get("MT3_MAX_SECONDS", "420"))

app = FastAPI(title="MusicLab AI — MT3 Transcription Service")

_model = None


def get_model():
    global _model
    if _model is None:
        print(f"[mt3] cargando modelo desde {CHECKPOINT}...", flush=True)
        t0 = time.time()
        _model = InferenceModel(CHECKPOINT, MODEL_TYPE)
        print(f"[mt3] modelo listo en {time.time() - t0:.1f}s", flush=True)
    return _model


def _pretty_midi_to_b64(pm: pretty_midi.PrettyMIDI) -> str:
    with tempfile.NamedTemporaryFile(suffix=".mid", delete=True) as tmp:
        pm.write(tmp.name)
        tmp.seek(0)
        data = tmp.read()
    return base64.b64encode(data).decode("ascii")


def _split_by_instrument(pm: pretty_midi.PrettyMIDI):
    """Agrupa las pistas por (programa, is_drum) y devuelve un MIDI por grupo."""
    groups = {}
    for inst in pm.instruments:
        key = ("drum", 0) if inst.is_drum else ("prog", inst.program)
        groups.setdefault(key, []).append(inst)

    results = []
    for (kind, prog), insts in groups.items():
        is_drum = kind == "drum"
        note_count = sum(len(i.notes) for i in insts)
        if note_count == 0:
            continue
        sub = pretty_midi.PrettyMIDI()
        merged = pretty_midi.Instrument(program=0 if is_drum else prog, is_drum=is_drum)
        for i in insts:
            merged.notes.extend(i.notes)
        sub.instruments.append(merged)
        name = "Batería" if is_drum else pretty_midi.program_to_instrument_name(prog)
        results.append(
            {
                "program": int(prog),
                "name": name,
                "isDrum": bool(is_drum),
                "noteCount": int(note_count),
                "midiBase64": _pretty_midi_to_b64(sub),
            }
        )
    results.sort(key=lambda r: -r["noteCount"])
    return results


@app.get("/health")
def health():
    return {"status": "healthy", "model": MODEL_TYPE, "loaded": _model is not None}


def _run_transcription(audio: np.ndarray, sample_rate: int) -> dict:
    """Trabajo bloqueante (se ejecuta en un hilo, fuera del event loop de FastAPI)."""
    if sample_rate != SAMPLE_RATE:
        audio = librosa.resample(audio, orig_sr=sample_rate, target_sr=SAMPLE_RATE)

    max_samples = MAX_SECONDS * SAMPLE_RATE
    if audio.size > max_samples:
        audio = audio[:max_samples]

    model = get_model()
    t0 = time.time()
    ns = model(audio)
    elapsed = time.time() - t0

    pm = note_seq.note_sequence_to_pretty_midi(ns)
    instruments = _split_by_instrument(pm)
    full_b64 = _pretty_midi_to_b64(pm)

    print(f"[mt3] transcrito {audio.size / SAMPLE_RATE:.1f}s en {elapsed:.1f}s, "
          f"{len(instruments)} instrumentos", flush=True)

    return {
        "durationSec": round(float(pm.get_end_time()), 2),
        "elapsedSec": round(elapsed, 1),
        "fullMidiBase64": full_b64,
        "instruments": instruments,
    }


@app.post("/transcribe")
async def transcribe(request: Request):
    sample_rate = int(request.headers.get("X-Sample-Rate", str(SAMPLE_RATE)))
    raw = await request.body()
    if not raw:
        return JSONResponse({"error": "cuerpo vacío"}, status_code=400)

    audio = np.frombuffer(raw, dtype="<f4").astype(np.float32).copy()
    if audio.size == 0:
        return JSONResponse({"error": "PCM inválido"}, status_code=400)

    return await asyncio.to_thread(_run_transcription, audio, sample_rate)
