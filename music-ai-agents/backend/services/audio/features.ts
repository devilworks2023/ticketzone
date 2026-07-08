import { frameSignal, magnitudeSpectrum, rms, zeroCrossingRate, frequencyToMidi } from './dsp';

export interface FrameFeatures {
  timeSec: number;
  rms: number;
  zcr: number;
  flux: number;
  lowEnergy: number;
  midEnergy: number;
  highEnergy: number;
  chroma: number[];
  dominantFreq: number;
  dominantMidi: number;
  clarity: number;
}

export interface FeatureExtraction {
  sampleRate: number;
  hopSize: number;
  frameSize: number;
  hopSec: number;
  frames: FrameFeatures[];
  durationSec: number;
}

const LOW_BAND_HZ = 250;
const MID_BAND_HZ = 2000;
const PITCH_MIN_HZ = 45;
const PITCH_MAX_HZ = 1400;
const CHROMA_MIN_HZ = 60;
const CHROMA_MAX_HZ = 5000;

export function extractFeatures(mono: Float32Array, sampleRate: number, frameSize = 2048, hopSize = 1024): FeatureExtraction {
  const frames = frameSignal(mono, frameSize, hopSize);
  const binHz = sampleRate / frameSize;
  const nyquistBins = frameSize / 2;

  let prevMag: Float64Array | null = null;
  const result: FrameFeatures[] = [];

  for (const frame of frames) {
    const mags = magnitudeSpectrum(frame.data);

    let flux = 0;
    if (prevMag) {
      for (let i = 0; i < mags.length; i++) {
        const diff = mags[i] - prevMag[i];
        if (diff > 0) flux += diff;
      }
    }
    prevMag = mags;

    let lowEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;
    const chroma = new Array(12).fill(0);

    let peakBin = -1;
    let peakMag = -Infinity;
    let sumMagInPitchRange = 0;
    let countInPitchRange = 0;

    for (let bin = 1; bin < nyquistBins; bin++) {
      const freq = bin * binHz;
      const mag = mags[bin];
      const energy = mag * mag;

      if (freq < LOW_BAND_HZ) lowEnergy += energy;
      else if (freq < MID_BAND_HZ) midEnergy += energy;
      else highEnergy += energy;

      if (freq >= CHROMA_MIN_HZ && freq <= CHROMA_MAX_HZ) {
        const midi = Math.round(frequencyToMidi(freq));
        const pc = ((midi % 12) + 12) % 12;
        chroma[pc] += energy;
      }

      if (freq >= PITCH_MIN_HZ && freq <= PITCH_MAX_HZ) {
        sumMagInPitchRange += mag;
        countInPitchRange++;
        if (mag > peakMag) {
          peakMag = mag;
          peakBin = bin;
        }
      }
    }

    let dominantFreq = 0;
    let clarity = 0;
    if (peakBin > 0 && peakBin < nyquistBins - 1) {
      const a = mags[peakBin - 1];
      const b = mags[peakBin];
      const c = mags[peakBin + 1];
      const denom = a - 2 * b + c;
      const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
      dominantFreq = (peakBin + shift) * binHz;
      const meanMag = countInPitchRange > 0 ? sumMagInPitchRange / countInPitchRange : 0;
      clarity = meanMag > 0 ? peakMag / meanMag : 0;
    }

    const dominantMidi = dominantFreq > 0 ? frequencyToMidi(dominantFreq) : 0;

    result.push({
      timeSec: frame.startSample / sampleRate,
      rms: rms(frame.data),
      zcr: zeroCrossingRate(frame.data),
      flux,
      lowEnergy,
      midEnergy,
      highEnergy,
      chroma,
      dominantFreq,
      dominantMidi,
      clarity,
    });
  }

  return {
    sampleRate,
    hopSize,
    frameSize,
    hopSec: hopSize / sampleRate,
    frames: result,
    durationSec: mono.length / sampleRate,
  };
}
