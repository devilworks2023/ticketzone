import MidiWriter from 'midi-writer-js';
import type { NoteEvent, DrumHit, KeyResult } from '../../../types';

const PPQ = 128;

function secToTicks(sec: number, bpm: number): number {
  const ticksPerSecond = (bpm / 60) * PPQ;
  return Math.max(1, Math.round(sec * ticksPerSecond));
}

function drumPitchFor(type: DrumHit['type']): string {
  switch (type) {
    case 'kick':
      return 'C2';
    case 'snare':
      return 'D2';
    case 'hihat':
    default:
      return 'F#2';
  }
}

export function buildMidiFile(params: {
  bpm: number;
  key: KeyResult;
  noteEvents: NoteEvent[];
  drumHits: DrumHit[];
}): string {
  const { bpm, key, noteEvents, drumHits } = params;

  const melodyTrack = new MidiWriter.Track();
  melodyTrack.addTrackName('Melodía / Bajo detectado');
  melodyTrack.setTempo(bpm);
  melodyTrack.setKeySignature(key.tonic, key.mode === 'minor' ? 'm' : undefined);
  melodyTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 1 }));

  for (const note of noteEvents) {
    melodyTrack.addEvent(
      new MidiWriter.NoteEvent({
        pitch: [note.noteName],
        startTick: secToTicks(note.startSec, bpm),
        duration: `T${secToTicks(note.durationSec, bpm)}`,
        velocity: Math.max(1, Math.min(100, note.velocity)),
        channel: 1,
      }),
    );
  }

  const drumTrack = new MidiWriter.Track();
  drumTrack.addTrackName('Batería detectada');

  for (const hit of drumHits) {
    drumTrack.addEvent(
      new MidiWriter.NoteEvent({
        pitch: [drumPitchFor(hit.type)],
        startTick: secToTicks(hit.atSec, bpm),
        duration: 'T64',
        velocity: Math.max(1, Math.min(100, hit.velocity)),
        channel: 10,
      }),
    );
  }

  const tracks = drumHits.length > 0 ? [melodyTrack, drumTrack] : [melodyTrack];
  const writer = new MidiWriter.Writer(tracks);
  return writer.base64();
}
