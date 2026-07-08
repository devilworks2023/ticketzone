import { decodeAudioBuffer, downsample } from './decode';
import { extractFeatures } from './features';
import { detectTempo } from './tempo';
import { detectKey } from './key';
import { extractNoteEvents, extractDrumHits, patternWindowSec } from './notes';
import { estimateInstruments } from './instruments';
import { buildMidiFile } from './midi';
import { generateTutorial } from '../tutorial';
import type { AnalysisResult } from '../../../types';

const ANALYSIS_SAMPLE_RATE = 22050;
const MAX_DURATION_SEC = 6 * 60;

export async function analyzeAudioFile(buffer: Buffer, fileName?: string): Promise<Omit<AnalysisResult, 'id' | 'createdAt' | 'source' | 'fileName' | 'sourceUrl'>> {
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

  const base = {
    durationSec: Math.round(decoded.durationSec * 10) / 10,
    bpm: tempoResult.bpm,
    bpmConfidence: tempoResult.confidence,
    key: keyResult,
    instruments,
    noteEvents,
    drumHits,
    midiBase64,
  };

  const tutorial = generateTutorial(base);

  return { ...base, tutorial };
}
