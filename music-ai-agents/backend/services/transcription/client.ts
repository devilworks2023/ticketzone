import type { TranscribedInstrument } from '../../../types';

export interface TranscriptionResult {
  durationSec: number;
  elapsedSec: number;
  fullMidiBase64: string;
  instruments: TranscribedInstrument[];
}

const SERVICE_URL = process.env.TRANSCRIPTION_SERVICE_URL || 'http://localhost:8001';
const TIMEOUT_MS = Number(process.env.TRANSCRIPTION_TIMEOUT_MS || 900000); // hasta 15 min

export async function isTranscriptionAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === 'healthy';
  } catch {
    return false;
  }
}

/**
 * Envía PCM mono float32 al servicio MT3 y recibe la transcripción multi-instrumento
 * (MIDI completo del track + un MIDI por instrumento). Lanza si el servicio falla;
 * el orquestador decide el fallback.
 */
export async function transcribeStems(mono: Float32Array, sampleRate: number): Promise<TranscriptionResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body = mono.buffer.slice(mono.byteOffset, mono.byteOffset + mono.byteLength) as ArrayBuffer;
    const res = await fetch(`${SERVICE_URL}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Sample-Rate': String(sampleRate),
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`El servicio de transcripción respondió ${res.status}`);
    }
    return (await res.json()) as TranscriptionResult;
  } finally {
    clearTimeout(timeout);
  }
}
