import type { FeatureExtraction } from './features';
import type { NoteEvent, DrumHit, InstrumentBreakdown } from '../../../types';

/**
 * Heuristic instrument-family estimation from spectral-band energy, percussive onset density
 * and melodic-line stability. This is signal-processing based approximation, not a trained
 * classifier — it labels broad roles (bass/drums/lead/pad) rather than exact instrument names.
 */
export function estimateInstruments(
  extraction: FeatureExtraction,
  noteEvents: NoteEvent[],
  drumHits: DrumHit[],
  windowSec: number,
): InstrumentBreakdown[] {
  const frames = extraction.frames.filter((f) => f.timeSec <= windowSec);
  const totalEnergy = frames.reduce((a, f) => a + f.lowEnergy + f.midEnergy + f.highEnergy, 0) || 1;
  const lowEnergy = frames.reduce((a, f) => a + f.lowEnergy, 0);
  const midEnergy = frames.reduce((a, f) => a + f.midEnergy, 0);

  const bassPresence = lowEnergy / totalEnergy;
  const drumDensity = Math.min(1, drumHits.length / Math.max(1, windowSec * 4));
  const melodicPresence = Math.min(1, noteEvents.length / Math.max(1, windowSec * 1.5));
  const padPresence = Math.max(0, (midEnergy / totalEnergy) * (1 - melodicPresence));

  const breakdown: InstrumentBreakdown[] = [
    { tag: 'bajo', label: 'Bajo / línea grave', presence: round(bassPresence) },
    { tag: 'bateria', label: 'Batería / percusión', presence: round(drumDensity) },
    { tag: 'melodia', label: 'Melodía / lead', presence: round(melodicPresence) },
    { tag: 'armonia_pad', label: 'Armonía / pad sostenido', presence: round(padPresence) },
  ];

  return breakdown.sort((a, b) => b.presence - a.presence);
}

function round(n: number): number {
  return Math.round(Math.max(0, Math.min(1, n)) * 100) / 100;
}
