import { NOTE_NAMES } from './dsp';
import type { FeatureExtraction } from './features';
import type { KeyResult } from '../../../types';

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const CAMELOT_MAJOR = ['8B', '3B', '10B', '5B', '12B', '7B', '2B', '9B', '4B', '11B', '6B', '1B'];
const CAMELOT_MINOR = ['5A', '12A', '7A', '2A', '9A', '4A', '11A', '6A', '1A', '8A', '3A', '10A'];

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length;
  const meanA = a.reduce((x, y) => x + y, 0) / n;
  const meanB = b.reduce((x, y) => x + y, 0) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

function rotate(profile: number[], n: number): number[] {
  return profile.map((_, i) => profile[(i - n + 12 * 100) % 12]);
}

export function detectKey(extraction: FeatureExtraction): KeyResult {
  const chromaSum = new Array(12).fill(0);
  for (const frame of extraction.frames) {
    for (let i = 0; i < 12; i++) chromaSum[i] += frame.chroma[i] * frame.rms;
  }

  const total = chromaSum.reduce((a, b) => a + b, 0);
  const chromaNorm = total > 0 ? chromaSum.map((v) => v / total) : chromaSum;

  let best = { tonic: 0, mode: 'major' as 'major' | 'minor', score: -Infinity };

  for (let tonic = 0; tonic < 12; tonic++) {
    const majorScore = pearsonCorrelation(chromaNorm, rotate(MAJOR_PROFILE, tonic));
    const minorScore = pearsonCorrelation(chromaNorm, rotate(MINOR_PROFILE, tonic));
    if (majorScore > best.score) best = { tonic, mode: 'major', score: majorScore };
    if (minorScore > best.score) best = { tonic, mode: 'minor', score: minorScore };
  }

  const tonicName = NOTE_NAMES[best.tonic];
  const camelot = best.mode === 'major' ? CAMELOT_MAJOR[best.tonic] : CAMELOT_MINOR[best.tonic];

  return {
    tonic: tonicName,
    mode: best.mode,
    name: `${tonicName} ${best.mode === 'major' ? 'mayor' : 'menor'}`,
    camelot,
    confidence: Math.round(Math.max(0, best.score) * 100) / 100,
  };
}
