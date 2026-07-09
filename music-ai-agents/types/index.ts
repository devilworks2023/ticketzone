export type InstrumentTag = 'bajo' | 'bateria' | 'melodia' | 'armonia_pad';

export interface NoteEvent {
  midiNote: number;
  noteName: string;
  startSec: number;
  durationSec: number;
  velocity: number;
}

export interface DrumHit {
  type: 'kick' | 'snare' | 'hihat';
  atSec: number;
  velocity: number;
}

export interface InstrumentBreakdown {
  tag: InstrumentTag;
  label: string;
  presence: number;
}

export interface KeyResult {
  tonic: string;
  mode: 'major' | 'minor';
  name: string;
  camelot: string;
  confidence: number;
}

// Instrumento distinguido por la IA de transcripción (MT3), etiquetado por su
// programa General MIDI (más de 6 categorías posibles). Cada uno trae su propio
// MIDI del track completo.
export interface TranscribedInstrument {
  program: number;
  name: string;
  isDrum: boolean;
  noteCount: number;
  midiBase64: string;
}

export interface AnalysisResult {
  id: string;
  source: 'upload' | 'link';
  fileName?: string;
  sourceUrl?: string;
  durationSec: number;
  bpm: number;
  bpmConfidence: number;
  key: KeyResult;
  instruments: InstrumentBreakdown[];
  noteEvents: NoteEvent[];
  drumHits: DrumHit[];
  midiBase64: string;
  tutorial: string;
  createdAt: string;
  // Transcripción multi-instrumento por IA (MT3) del track completo. Presente
  // solo al subir audio y si el servicio de transcripción estuvo disponible.
  transcribed: boolean;
  transcriptionNote?: string;
  fullMidiBase64?: string;
  transcribedInstruments: TranscribedInstrument[];
}

export type JobStatus = 'processing' | 'done' | 'error';

export interface AnalysisJob {
  id: string;
  status: JobStatus;
  analysisId?: string;
  error?: string;
  stage?: string;
  createdAt: string;
}

export type LookupPlatform =
  | 'bandcamp'
  | 'soundcloud'
  | 'spotify'
  | 'beatport'
  | 'juno'
  | 'apple-music'
  | 'unknown';

export interface TrackMetadata {
  platform: LookupPlatform;
  url: string;
  title: string;
  artist: string;
  genre?: string;
  bpm?: number;
  key?: string;
  artworkUrl?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface RecommendationItem {
  title: string;
  artist: string;
  genre?: string;
  bpm?: number;
  camelotKey?: string;
  matchReason: string;
  matchScore: number;
  searchLinks: {
    beatport: string;
    bandcamp: string;
    juno: string;
    spotify: string;
  };
}

export interface RecommendationResult {
  id: string;
  seed: TrackMetadata;
  similarArtists: { name: string; reason: string }[];
  similarTracks: RecommendationItem[];
  createdAt: string;
}
