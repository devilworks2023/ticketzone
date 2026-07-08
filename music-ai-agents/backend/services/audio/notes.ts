import { midiToNoteName } from './dsp';
import type { FeatureExtraction, FrameFeatures } from './features';
import type { NoteEvent, DrumHit } from '../../../types';

/** How much of the track (in seconds) to transcribe into a MIDI pattern. Kept short on purpose:
 *  the goal is a learnable loop/pattern, not a full-song transcription. */
export function patternWindowSec(bpm: number, trackDurationSec: number): number {
  const barSec = (60 / bpm) * 4;
  const eightBars = barSec * 8;
  return Math.min(trackDurationSec, Math.max(barSec * 2, Math.min(eightBars, 32)));
}

export function extractNoteEvents(extraction: FeatureExtraction, windowSec: number): NoteEvent[] {
  const frames = extraction.frames.filter((f) => f.timeSec <= windowSec);
  if (frames.length === 0) return [];

  const maxRms = Math.max(...frames.map((f) => f.rms), 1e-6);
  const voicedThreshold = maxRms * 0.12;
  const clarityThreshold = 1.6;

  const events: NoteEvent[] = [];
  let current: { midiSum: number; count: number; startSec: number; velocitySum: number } | null = null;

  const flush = (endSec: number) => {
    if (!current) return;
    const duration = endSec - current.startSec;
    if (duration >= extraction.hopSec * 1.5) {
      const avgMidi = Math.round(current.midiSum / current.count);
      events.push({
        midiNote: avgMidi,
        noteName: midiToNoteName(avgMidi),
        startSec: Math.round(current.startSec * 1000) / 1000,
        durationSec: Math.round(duration * 1000) / 1000,
        velocity: Math.round(Math.min(1, current.velocitySum / current.count) * 100),
      });
    }
    current = null;
  };

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const isVoiced = f.rms > voicedThreshold && f.clarity > clarityThreshold && f.dominantMidi > 0;

    if (!isVoiced) {
      flush(f.timeSec);
      continue;
    }

    if (current && Math.abs(f.dominantMidi - current.midiSum / current.count) <= 0.7) {
      current.midiSum += f.dominantMidi;
      current.count += 1;
      current.velocitySum += f.rms / maxRms;
    } else {
      flush(f.timeSec);
      current = { midiSum: f.dominantMidi, count: 1, startSec: f.timeSec, velocitySum: f.rms / maxRms };
    }
  }
  flush(windowSec);

  return events;
}

function classifyOnset(f: FrameFeatures): DrumHit['type'] {
  const total = f.lowEnergy + f.midEnergy + f.highEnergy + 1e-9;
  const lowRatio = f.lowEnergy / total;
  const highRatio = f.highEnergy / total;

  if (lowRatio > 0.45) return 'kick';
  if (highRatio > 0.4 && f.zcr > 0.1) return 'hihat';
  return 'snare';
}

export function extractDrumHits(extraction: FeatureExtraction, windowSec: number): DrumHit[] {
  const frames = extraction.frames.filter((f) => f.timeSec <= windowSec);
  if (frames.length < 4) return [];

  const fluxValues = frames.map((f) => f.flux);
  const mean = fluxValues.reduce((a, b) => a + b, 0) / fluxValues.length;
  const variance = fluxValues.reduce((a, b) => a + (b - mean) ** 2, 0) / fluxValues.length;
  const std = Math.sqrt(variance);
  const threshold = mean + std * 1.2;

  const hits: DrumHit[] = [];
  const minIntervalSec = 0.08;
  let lastOnsetSec = -Infinity;

  for (let i = 1; i < frames.length - 1; i++) {
    const f = frames[i];
    const isLocalMax = f.flux >= frames[i - 1].flux && f.flux >= frames[i + 1].flux;
    if (f.flux > threshold && isLocalMax && f.timeSec - lastOnsetSec >= minIntervalSec) {
      hits.push({
        type: classifyOnset(f),
        atSec: Math.round(f.timeSec * 1000) / 1000,
        velocity: Math.round(Math.min(1, f.flux / (threshold * 3)) * 100),
      });
      lastOnsetSec = f.timeSec;
    }
  }

  return hits;
}
