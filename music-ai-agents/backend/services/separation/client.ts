import type { StemName } from '../../../types';

export interface SeparatedStems {
  sampleRate: number;
  stems: Partial<Record<StemName, Float32Array>>;
  elapsedSec?: number;
}

const SERVICE_URL = process.env.SEPARATION_SERVICE_URL || 'http://localhost:8000';
const TIMEOUT_MS = Number(process.env.SEPARATION_TIMEOUT_MS || 180000);

/** Devuelve true si el servicio de separación responde /health. */
export async function isSeparationAvailable(): Promise<boolean> {
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
 * Envía PCM mono float32 al servicio Demucs y recibe un stem por instrumento.
 * Lanza si el servicio no responde o falla — el orquestador decide el fallback.
 */
export async function separateStems(mono: Float32Array, sampleRate: number): Promise<SeparatedStems> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body = mono.buffer.slice(mono.byteOffset, mono.byteOffset + mono.byteLength) as ArrayBuffer;
    const res = await fetch(`${SERVICE_URL}/separate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Sample-Rate': String(sampleRate),
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`El servicio de separación respondió ${res.status}`);
    }

    const json = (await res.json()) as { sampleRate: number; stems: Record<string, string>; elapsedSec?: number };
    const stems: Partial<Record<StemName, Float32Array>> = {};

    for (const [name, b64] of Object.entries(json.stems)) {
      const buf = Buffer.from(b64, 'base64');
      const floats = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
      stems[name as StemName] = Float32Array.from(floats);
    }

    return { sampleRate: json.sampleRate, stems, elapsedSec: json.elapsedSec };
  } finally {
    clearTimeout(timeout);
  }
}
