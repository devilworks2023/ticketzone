import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { DecodedAudio } from './decode';

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
// Sample rate al que ffmpeg entrega el PCM. Lo fijamos para conocerlo con certeza
// (44.1 kHz es suficiente para el análisis y la separación posteriores).
const FFMPEG_SAMPLE_RATE = 44100;

let ffmpegAvailable: boolean | null = null;

/** Comprueba (y cachea) si el binario de ffmpeg está disponible en el sistema. */
export function isFfmpegAvailable(): Promise<boolean> {
  if (ffmpegAvailable !== null) return Promise.resolve(ffmpegAvailable);
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG_BIN, ['-version']);
    proc.on('error', () => {
      ffmpegAvailable = false;
      resolve(false);
    });
    proc.on('close', (code) => {
      ffmpegAvailable = code === 0;
      resolve(ffmpegAvailable);
    });
  });
}

/**
 * Decodifica cualquier formato soportado por ffmpeg (AIFF, FLAC, M4A/AAC, OGG,
 * WMA, OPUS, WAV, MP3, etc.) a PCM float32 mono.
 *
 * Escribimos el input a un archivo temporal en vez de usar stdin porque los
 * contenedores tipo MP4/M4A/MOV necesitan poder hacer "seek" (el átomo moov con
 * el índice puede estar al final), algo imposible con un pipe. El PCM de salida
 * sí sale por stdout.
 */
export async function decodeViaFfmpeg(buffer: Buffer): Promise<DecodedAudio> {
  const tmpPath = path.join(os.tmpdir(), `musiclab-in-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await fs.promises.writeFile(tmpPath, buffer);

  try {
    return await new Promise<DecodedAudio>((resolve, reject) => {
      const args = [
        '-hide_banner',
        '-loglevel', 'error',
        '-i', tmpPath,
        '-ac', '1', // mono
        '-ar', String(FFMPEG_SAMPLE_RATE),
        '-f', 'f32le', // PCM float32 little-endian crudo
        'pipe:1',
      ];

      const proc = spawn(FFMPEG_BIN, args);
      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      proc.stdout.on('data', (d: Buffer) => chunks.push(d));
      proc.stderr.on('data', (d: Buffer) => errChunks.push(d));

      proc.on('error', (err) => reject(new Error(`No se pudo ejecutar ffmpeg: ${err.message}`)));

      proc.on('close', (code) => {
        if (code !== 0) {
          const detail = Buffer.concat(errChunks).toString('utf-8').trim().split('\n').slice(-2).join(' ');
          reject(new Error(`ffmpeg falló al decodificar (código ${code}). ${detail}`));
          return;
        }
        const pcm = Buffer.concat(chunks);
        if (pcm.byteLength === 0) {
          reject(new Error('ffmpeg no produjo audio (¿archivo sin pista de audio o corrupto?).'));
          return;
        }
        const mono = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 4));
        resolve({
          sampleRate: FFMPEG_SAMPLE_RATE,
          mono: Float32Array.from(mono),
          durationSec: mono.length / FFMPEG_SAMPLE_RATE,
        });
      });
    });
  } finally {
    fs.promises.unlink(tmpPath).catch(() => {});
  }
}
