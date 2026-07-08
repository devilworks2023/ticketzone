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

export type StemName = 'drums' | 'bass' | 'vocals' | 'guitar' | 'piano' | 'other';

export interface StemResult {
  stem: StemName;
  label: string;
  kind: 'drums' | 'melodic';
  presence: number;
  noteEvents: NoteEvent[];
  drumHits: DrumHit[];
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
  // Separación real por IA (Demucs). Presente solo cuando el servicio de
  // separación estuvo disponible y produjo stems por instrumento.
  separated: boolean;
  separationNote?: string;
  stems: StemResult[];
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
