import { downsample } from './decode';
import { extractFeatures } from './features';
import { extractNoteEvents, extractDrumHits } from './notes';
import { buildMidiFile } from './midi';
import { separateStems } from '../separation/client';
import type { KeyResult, StemName, StemResult } from '../../../types';

const ANALYSIS_SAMPLE_RATE = 22050;

const STEM_META: Record<StemName, { label: string; kind: 'drums' | 'melodic' }> = {
  drums: { label: 'Batería', kind: 'drums' },
  bass: { label: 'Bajo', kind: 'melodic' },
  vocals: { label: 'Voz', kind: 'melodic' },
  guitar: { label: 'Guitarra', kind: 'melodic' },
  piano: { label: 'Piano / teclado', kind: 'melodic' },
  other: { label: 'Otros (synths, etc.)', kind: 'melodic' },
};

const STEM_ORDER: StemName[] = ['drums', 'bass', 'piano', 'guitar', 'vocals', 'other'];

function rmsOf(signal: Float32Array): number {
  if (signal.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < signal.length; i++) sum += signal[i] * signal[i];
  return Math.sqrt(sum / signal.length);
}

/**
 * Separa el audio en stems por instrumento (Demucs) y transcribe cada uno a MIDI
 * usando el mismo DSP que la mezcla completa: la batería vía detección de onsets,
 * los stems melódicos vía seguimiento de la nota dominante.
 */
export async function buildStems(
  mono: Float32Array,
  sampleRate: number,
  bpm: number,
  key: KeyResult,
  windowSec: number,
): Promise<StemResult[]> {
  const separation = await separateStems(mono, sampleRate);

  const rmsByStem: { name: StemName; rms: number; pcm: Float32Array }[] = [];
  for (const [name, pcm] of Object.entries(separation.stems)) {
    if (!pcm) continue;
    rmsByStem.push({ name: name as StemName, rms: rmsOf(pcm), pcm });
  }

  const totalRms = rmsByStem.reduce((a, s) => a + s.rms, 0) || 1;
  const maxRms = rmsByStem.reduce((a, s) => Math.max(a, s.rms), 0) || 1;
  // Un stem cuya energía es una fracción mínima del más fuerte es, casi siempre,
  // "sangrado" de la separación (un instrumento que no está realmente en la pista).
  // Lo dejamos sin transcribir para no generar notas espurias a partir del ruido.
  const SILENCE_RATIO = 0.12;

  const results: StemResult[] = [];

  for (const { name, rms, pcm } of rmsByStem) {
    const meta = STEM_META[name] ?? { label: name, kind: 'melodic' as const };
    const isPresent = rms >= maxRms * SILENCE_RATIO;
    const { data, sampleRate: sr } = downsample(pcm, separation.sampleRate, ANALYSIS_SAMPLE_RATE);
    const features = extractFeatures(data, sr);

    let noteEvents: StemResult['noteEvents'] = [];
    let drumHits: StemResult['drumHits'] = [];

    if (meta.kind === 'drums') {
      if (isPresent) drumHits = extractDrumHits(features, windowSec);
    } else if (isPresent) {
      noteEvents = extractNoteEvents(features, windowSec);
    }

    const midiBase64 = buildMidiFile({ bpm, key, noteEvents, drumHits });

    results.push({
      stem: name,
      label: meta.label,
      kind: meta.kind,
      presence: Math.round((rms / totalRms) * 100) / 100,
      noteEvents,
      drumHits,
      midiBase64,
    });
  }

  results.sort((a, b) => STEM_ORDER.indexOf(a.stem) - STEM_ORDER.indexOf(b.stem));
  return results;
}
