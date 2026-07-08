export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function frequencyToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

export function midiToNoteName(midiNote: number): string {
  const n = Math.round(midiNote);
  const name = NOTE_NAMES[((n % 12) + 12) % 12];
  const octave = Math.floor(n / 12) - 1;
  return `${name}${octave}`;
}

export function nextPowerOfTwo(n: number): number {
  return 2 ** Math.ceil(Math.log2(n));
}

/** In-place iterative radix-2 Cooley-Tukey FFT. `real`/`imag` length must be a power of two. */
export function fft(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  if (n <= 1) return;

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = real[i + k];
        const uIm = imag[i + k];
        const vRe = real[i + k + len / 2] * curRe - imag[i + k + len / 2] * curIm;
        const vIm = real[i + k + len / 2] * curIm + imag[i + k + len / 2] * curRe;
        real[i + k] = uRe + vRe;
        imag[i + k] = uIm + vIm;
        real[i + k + len / 2] = uRe - vRe;
        imag[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
        curIm = nextIm;
      }
    }
  }
}

export function magnitudeSpectrum(frame: Float32Array): Float64Array {
  const n = nextPowerOfTwo(frame.length);
  const real = new Float64Array(n);
  const imag = new Float64Array(n);
  const window = hannWindow(frame.length);
  for (let i = 0; i < frame.length; i++) real[i] = frame[i] * window[i];
  fft(real, imag);
  const mags = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) mags[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  return mags;
}

export function hannWindow(size: number): Float64Array {
  const w = new Float64Array(size);
  for (let i = 0; i < size; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  return w;
}

export function rms(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

export function zeroCrossingRate(frame: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < frame.length; i++) {
    if ((frame[i] >= 0) !== (frame[i - 1] >= 0)) crossings++;
  }
  return crossings / frame.length;
}

export interface Frame {
  data: Float32Array;
  startSample: number;
}

export function frameSignal(signal: Float32Array, frameSize: number, hopSize: number): Frame[] {
  const frames: Frame[] = [];
  for (let start = 0; start + frameSize <= signal.length; start += hopSize) {
    frames.push({ data: signal.subarray(start, start + frameSize), startSample: start });
  }
  return frames;
}

/** Autocorrelation of a real signal over lags [minLag, maxLag]. Returns array indexed from 0 -> lag=minLag. */
export function autocorrelate(signal: Float64Array | Float32Array, minLag: number, maxLag: number): Float64Array {
  const out = new Float64Array(maxLag - minLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < signal.length; i++) {
      sum += signal[i] * signal[i + lag];
    }
    out[lag - minLag] = sum;
  }
  return out;
}

export function findPeakIndex(arr: Float64Array): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}
