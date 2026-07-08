import { midiToNoteName } from './dsp';
import type { NoteEvent, DrumHit, KeyResult } from '../../../types';

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

const TONIC_TO_PC: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
};

// Common diatonic progressions expressed as 0-indexed scale degrees.
const MAJOR_PROGRESSION = [0, 4, 5, 3]; // I - V - vi - IV
const MINOR_PROGRESSION = [0, 5, 2, 6]; // i - VI - III - VII

function scaleDegreeMidi(tonicPc: number, scale: number[], degree: number, octaveBase: number): number {
  const octaveShift = Math.floor(degree / scale.length);
  const idx = ((degree % scale.length) + scale.length) % scale.length;
  return octaveBase * 12 + tonicPc + scale[idx] + octaveShift * 12;
}

function triadFor(tonicPc: number, mode: 'major' | 'minor', rootDegree: number, octaveBase: number): number[] {
  const scale = mode === 'major' ? MAJOR_SCALE : MINOR_SCALE;
  return [0, 2, 4].map((interval) => scaleDegreeMidi(tonicPc, scale, rootDegree + interval, octaveBase));
}

/**
 * Genera un patrón de 4 compases (bajo + acordes) orientativo a partir de la tonalidad y el
 * tempo detectados en los metadatos de un enlace externo. No es una transcripción del audio
 * real (no tenemos acceso al archivo de audio de la tienda/plataforma), sino un punto de
 * partida compositivo coherente con esa tonalidad y tempo para aprender a construir un track.
 */
export function buildGenericPattern(bpm: number, key: KeyResult): { noteEvents: NoteEvent[]; drumHits: DrumHit[] } {
  const tonicPc = TONIC_TO_PC[key.tonic] ?? 0;
  const progression = key.mode === 'major' ? MAJOR_PROGRESSION : MINOR_PROGRESSION;
  const scale = key.mode === 'major' ? MAJOR_SCALE : MINOR_SCALE;
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;

  const noteEvents: NoteEvent[] = [];

  progression.forEach((degree, barIndex) => {
    const barStart = barIndex * barSec;
    const bassMidi = scaleDegreeMidi(tonicPc, scale, degree, 2);
    noteEvents.push({
      midiNote: bassMidi,
      noteName: midiToNoteName(bassMidi),
      startSec: Math.round(barStart * 1000) / 1000,
      durationSec: Math.round(barSec * 1000) / 1000,
      velocity: 85,
    });

    const chord = triadFor(tonicPc, key.mode, degree, 4);
    chord.forEach((midiNote) => {
      noteEvents.push({
        midiNote,
        noteName: midiToNoteName(midiNote),
        startSec: Math.round(barStart * 1000) / 1000,
        durationSec: Math.round(barSec * 1000) / 1000,
        velocity: 60,
      });
    });
  });

  const drumHits: DrumHit[] = [];
  const totalBars = progression.length;
  for (let bar = 0; bar < totalBars; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      const t = bar * barSec + beat * beatSec;
      drumHits.push({ type: 'kick', atSec: Math.round(t * 1000) / 1000, velocity: 90 });
      if (beat % 2 === 1) {
        drumHits.push({ type: 'snare', atSec: Math.round(t * 1000) / 1000, velocity: 75 });
      }
      drumHits.push({ type: 'hihat', atSec: Math.round((t + beatSec / 2) * 1000) / 1000, velocity: 55 });
    }
  }

  return { noteEvents, drumHits };
}
