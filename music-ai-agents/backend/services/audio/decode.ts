import wavDecoder from 'wav-decoder';
import { MPEGDecoder } from 'mpg123-decoder';

export interface DecodedAudio {
  sampleRate: number;
  mono: Float32Array;
  durationSec: number;
}

function looksLikeWav(bytes: Uint8Array): boolean {
  return bytes.length > 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45; // WAVE
}

function downmix(channelData: Float32Array[]): Float32Array {
  if (channelData.length === 1) return channelData[0];
  const length = channelData[0].length;
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const ch of channelData) sum += ch[i] ?? 0;
    mono[i] = sum / channelData.length;
  }
  return mono;
}

async function decodeWav(buffer: Buffer): Promise<DecodedAudio> {
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const decoded = await wavDecoder.decode(arrayBuffer);
  const mono = downmix(decoded.channelData as Float32Array[]);
  return {
    sampleRate: decoded.sampleRate,
    mono,
    durationSec: mono.length / decoded.sampleRate,
  };
}

async function decodeMp3(buffer: Buffer): Promise<DecodedAudio> {
  const decoder = new MPEGDecoder();
  await decoder.ready;
  try {
    const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const { channelData, sampleRate } = decoder.decode(uint8);
    if (!channelData.length || channelData[0].length === 0) {
      throw new Error('El decodificador MP3 no produjo muestras de audio.');
    }
    const mono = downmix(channelData as Float32Array[]);
    return {
      sampleRate,
      mono,
      durationSec: mono.length / sampleRate,
    };
  } finally {
    decoder.free();
  }
}

export async function decodeAudioBuffer(buffer: Buffer, fileName?: string): Promise<DecodedAudio> {
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, Math.min(buffer.byteLength, 16));
  const ext = fileName?.split('.').pop()?.toLowerCase();

  if (looksLikeWav(bytes) || ext === 'wav') {
    return decodeWav(buffer);
  }

  try {
    return await decodeMp3(buffer);
  } catch (err) {
    throw new Error(
      `No se pudo decodificar el archivo de audio. Formatos soportados: WAV y MP3. Detalle: ${(err as Error).message}`,
    );
  }
}

export function downsample(mono: Float32Array, fromRate: number, toRate: number): { data: Float32Array; sampleRate: number } {
  if (toRate >= fromRate) return { data: mono, sampleRate: fromRate };
  const ratio = fromRate / toRate;
  const newLength = Math.floor(mono.length / ratio);
  const out = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(mono.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += mono[j];
      count++;
    }
    out[i] = count > 0 ? sum / count : 0;
  }
  return { data: out, sampleRate: toRate };
}
