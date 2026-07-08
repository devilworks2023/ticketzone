import { decodeAudioBuffer, downsample } from './decode';
import { extractFeatures } from './features';
import { detectTempo } from './tempo';
import { detectKey } from './key';
import { extractNoteEvents, extractDrumHits, patternWindowSec } from './notes';
import { estimateInstruments } from './instruments';
import { buildMidiFile } from './midi';
import { buildStems } from './stems';
import { generateTutorial } from '../tutorial';
import type { AnalysisResult, StemResult } from '../../../types';

const ANALYSIS_SAMPLE_RATE = 22050;
const MAX_DURATION_SEC = 6 * 60;
// Solo separamos el tramo que vamos a transcribir (el patrón), no la canción
// entera: acota el tiempo de CPU de Demucs y es suficiente para aprender el patrón.
const MAX_SEPARATION_SEC = 40;

export async function analyzeAudioFile(
  buffer: Buffer,
  fileName?: string,
): Promise<Omit<AnalysisResult, 'id' | 'createdAt' | 'source' | 'fileName' | 'sourceUrl'>> {
  const decoded = await decodeAudioBuffer(buffer, fileName);

  let mono = decoded.mono;
  if (decoded.durationSec > MAX_DURATION_SEC) {
    mono = mono.subarray(0, Math.floor(MAX_DURATION_SEC * decoded.sampleRate));
  }

  const { data, sampleRate } = downsample(mono, decoded.sampleRate, ANALYSIS_SAMPLE_RATE);
  const extraction = extractFeatures(data, sampleRate);

  const tempoResult = detectTempo(extraction);
  const keyResult = detectKey(extraction);

  const windowSec = patternWindowSec(tempoResult.bpm, extraction.durationSec);
  const noteEvents = extractNoteEvents(extraction, windowSec);
  const drumHits = extractDrumHits(extraction, windowSec);
  const instruments = estimateInstruments(extraction, noteEvents, drumHits, windowSec);

  const midiBase64 = buildMidiFile({ bpm: tempoResult.bpm, key: keyResult, noteEvents, drumHits });

  // Separación real por instrumento (Demucs). Si el servicio no está disponible,
  // caemos con gracia al análisis de mezcla completa (separated: false).
  let stems: StemResult[] = [];
  let separated = false;
  let separationNote: string | undefined;

  try {
    const sepDurationSec = Math.min(windowSec, MAX_SEPARATION_SEC);
    const sepMono = mono.subarray(0, Math.floor(sepDurationSec * decoded.sampleRate));
    stems = await buildStems(sepMono, decoded.sampleRate, tempoResult.bpm, keyResult, windowSec);
    separated = stems.length > 0;
    if (!separated) {
      separationNote = 'El servicio de separación no devolvió instrumentos; se muestra solo la mezcla completa.';
    }
  } catch {
    separationNote =
      'El servicio de separación por IA no está disponible en este momento; se muestra el análisis de la mezcla completa.';
  }

  const base = {
    durationSec: Math.round(decoded.durationSec * 10) / 10,
    bpm: tempoResult.bpm,
    bpmConfidence: tempoResult.confidence,
    key: keyResult,
    instruments,
    noteEvents,
    drumHits,
    midiBase64,
    separated,
    separationNote,
    stems,
  };

  const tutorial = generateTutorial(base);

  return { ...base, tutorial };
}
