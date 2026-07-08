import { autocorrelate, findPeakIndex } from './dsp';
import type { FeatureExtraction } from './features';

export interface TempoResult {
  bpm: number;
  confidence: number;
}

/** Estimates tempo by autocorrelating the spectral-flux (onset) envelope. */
export function detectTempo(extraction: FeatureExtraction): TempoResult {
  const { frames, hopSec } = extraction;
  if (frames.length < 8) return { bpm: 120, confidence: 0 };

  const flux = new Float64Array(frames.length);
  for (let i = 0; i < frames.length; i++) flux[i] = frames[i].flux;

  const mean = flux.reduce((a, b) => a + b, 0) / flux.length;
  for (let i = 0; i < flux.length; i++) flux[i] -= mean;

  const minBpm = 60;
  const maxBpm = 190;
  const minLag = Math.max(1, Math.round(60 / maxBpm / hopSec));
  const maxLag = Math.min(flux.length - 1, Math.round(60 / minBpm / hopSec));

  if (maxLag <= minLag) return { bpm: 120, confidence: 0 };

  const corr = autocorrelate(flux, minLag, maxLag);
  const peakIdx = findPeakIndex(corr);
  const lag = peakIdx + minLag;
  const bpm = 60 / (lag * hopSec);

  const maxCorr = corr[peakIdx];
  const avgCorr = corr.reduce((a, b) => a + Math.abs(b), 0) / corr.length;
  const confidence = avgCorr > 0 ? Math.min(1, Math.max(0, maxCorr / (avgCorr * 4))) : 0;

  let finalBpm = bpm;
  while (finalBpm < 80) finalBpm *= 2;
  while (finalBpm > 175) finalBpm /= 2;

  return { bpm: Math.round(finalBpm * 10) / 10, confidence: Math.round(confidence * 100) / 100 };
}
