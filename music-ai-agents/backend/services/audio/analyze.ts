import { decodeAudioBuffer, downsample } from './decode';
import { extractFeatures } from './features';
import { detectTempo } from './tempo';
import { detectKey } from './key';
import { extractNoteEvents, extractDrumHits, patternWindowSec } from './notes';
import { estimateInstruments } from './instruments';
import { buildMidiFile } from './midi';
import { transcribeStems } from '../transcription/client';
import { generateTutorial } from '../tutorial';
import type { AnalysisResult, TranscribedInstrument } from '../../../types';

const ANALYSIS_SAMPLE_RATE = 22050;
const MAX_DURATION_SEC = 8 * 60;

export type AnalyzeBase = Omit<AnalysisResult, 'id' | 'createdAt' | 'source' | 'fileName' | 'sourceUrl'>;

/**
 * Analiza el audio completo: tempo/tonalidad/patrón de mezcla (DSP propio) +
 * transcripción multi-instrumento del track completo con MT3. `onStage` permite
 * reportar progreso al job asíncrono.
 */
export async function analyzeAudioFile(
  buffer: Buffer,
  fileName?: string,
  onStage?: (stage: string) => void,
): Promise<AnalyzeBase> {
  onStage?.('decodificando audio');
  const decoded = await decodeAudioBuffer(buffer, fileName);

  let mono = decoded.mono;
  if (decoded.durationSec > MAX_DURATION_SEC) {
    mono = mono.subarray(0, Math.floor(MAX_DURATION_SEC * decoded.sampleRate));
  }

  onStage?.('analizando tempo y tonalidad');
  const { data, sampleRate } = downsample(mono, decoded.sampleRate, ANALYSIS_SAMPLE_RATE);
  const extraction = extractFeatures(data, sampleRate);

  const tempoResult = detectTempo(extraction);
  const keyResult = detectKey(extraction);

  const windowSec = patternWindowSec(tempoResult.bpm, extraction.durationSec);
  const noteEvents = extractNoteEvents(extraction, windowSec);
  const drumHits = extractDrumHits(extraction, windowSec);
  const instruments = estimateInstruments(extraction, noteEvents, drumHits, windowSec);

  const midiBase64 = buildMidiFile({ bpm: tempoResult.bpm, key: keyResult, noteEvents, drumHits });

  // Transcripción multi-instrumento del track completo con MT3. Si el servicio
  // no está disponible, degradamos con gracia (transcribed: false).
  let transcribed = false;
  let transcriptionNote: string | undefined;
  let fullMidiBase64: string | undefined;
  let transcribedInstruments: TranscribedInstrument[] = [];

  try {
    onStage?.('separando instrumentos con IA (puede tardar)');
    const result = await transcribeStems(mono, decoded.sampleRate);
    transcribedInstruments = result.instruments;
    fullMidiBase64 = result.fullMidiBase64;
    transcribed = transcribedInstruments.length > 0;
    if (!transcribed) {
      transcriptionNote = 'La IA no detectó instrumentos con notas suficientes en el audio.';
    }
  } catch {
    transcriptionNote =
      'El servicio de transcripción por IA no está disponible en este momento; se muestra el análisis de la mezcla completa.';
  }

  const base: Omit<AnalyzeBase, 'tutorial'> = {
    durationSec: Math.round(decoded.durationSec * 10) / 10,
    bpm: tempoResult.bpm,
    bpmConfidence: tempoResult.confidence,
    key: keyResult,
    instruments,
    noteEvents,
    drumHits,
    midiBase64,
    transcribed,
    transcriptionNote,
    fullMidiBase64,
    transcribedInstruments,
  };

  const tutorial = generateTutorial(base);
  return { ...base, tutorial };
}
