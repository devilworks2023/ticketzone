import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';
import { analyzeAudioFile } from '../../services/audio/analyze';
import { lookupTrackMetadata } from '../../services/lookup';
import { buildGenericPattern } from '../../services/audio/genericPattern';
import { buildMidiFile } from '../../services/audio/midi';
import { estimateInstruments } from '../../services/audio/instruments';
import { generateTutorial } from '../../services/tutorial';
import { buildRecommendations } from '../../services/recommend';
import { compatibleCamelotCodes } from '../../services/recommend/camelot';
import type { AnalysisResult, RecommendationResult, KeyResult } from '../../../types';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const CAMELOT_MAJOR: Record<string, string> = {
  C: '8B', 'C#': '3B', D: '10B', 'D#': '5B', E: '12B', F: '7B',
  'F#': '2B', G: '9B', 'G#': '4B', A: '11B', 'A#': '6B', B: '1B',
};
const CAMELOT_MINOR: Record<string, string> = {
  C: '5A', 'C#': '12A', D: '7A', 'D#': '2A', E: '9A', F: '4A',
  'F#': '11A', G: '6A', 'G#': '1A', A: '8A', 'A#': '3A', B: '10A',
};

function keyFromText(text: string | undefined): KeyResult {
  const fallback: KeyResult = { tonic: 'C', mode: 'major', name: 'C mayor (sin datos, valor por defecto)', camelot: '8B', confidence: 0 };
  if (!text) return fallback;

  const match = text.trim().match(/^([A-G])([#b]?)\s*(major|minor|maj|min|m)?$/i);
  if (!match) return fallback;

  const letter = match[1].toUpperCase();
  const accidental = match[2] === 'b' ? undefined : match[2]; // normalize flats away; treat as natural if unknown
  const tonic = `${letter}${accidental ?? ''}`;
  const mode: 'major' | 'minor' = /min/i.test(match[3] ?? '') || match[3] === 'm' ? 'minor' : 'major';
  const camelotTable = mode === 'major' ? CAMELOT_MAJOR : CAMELOT_MINOR;

  return {
    tonic,
    mode,
    name: `${tonic} ${mode === 'major' ? 'mayor' : 'menor'}`,
    camelot: camelotTable[tonic] ?? fallback.camelot,
    confidence: 0.5,
  };
}

export const tracksRouter = createTRPCRouter({
  // Análisis de audio subido: ASÍNCRONO. La transcripción multi-instrumento del
  // track completo (MT3) puede tardar minutos, así que se procesa en segundo plano
  // y el cliente hace polling de `getJob`.
  startAnalysis: publicProcedure
    .input(z.object({
      base64Audio: z.string().min(1),
      fileName: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64Audio, 'base64');
      if (buffer.byteLength === 0) {
        throw new Error('El archivo de audio está vacío o no se pudo leer.');
      }

      const jobId = newId('job');
      const createdAt = new Date().toISOString();
      ctx.db.prepare(`
        INSERT INTO jobs (id, status, stage, created_at) VALUES (?, 'processing', ?, ?)
      `).run(jobId, 'en cola', createdAt);

      const db = ctx.db;
      const setStage = (stage: string) => {
        try { db.prepare('UPDATE jobs SET stage = ? WHERE id = ?').run(stage, jobId); } catch { /* noop */ }
      };

      // Procesamiento en segundo plano (fire-and-forget). El servidor es de una
      // sola instancia, así que basta con no esperar la promesa.
      (async () => {
        try {
          const analysis = await analyzeAudioFile(buffer, input.fileName, setStage);
          const id = newId('an');
          const result: AnalysisResult = {
            id,
            source: 'upload',
            fileName: input.fileName,
            ...analysis,
            createdAt: new Date().toISOString(),
          };
          db.prepare(`
            INSERT INTO analyses (id, source, file_name, source_url, payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(id, 'upload', input.fileName, null, JSON.stringify(result), result.createdAt);
          db.prepare("UPDATE jobs SET status = 'done', analysis_id = ?, stage = 'listo' WHERE id = ?").run(id, jobId);
        } catch (err) {
          db.prepare("UPDATE jobs SET status = 'error', error = ? WHERE id = ?")
            .run((err as Error).message || 'Error desconocido', jobId);
        }
      })();

      return { jobId };
    }),

  getJob: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ ctx, input }) => {
      const row = ctx.db.prepare('SELECT id, status, analysis_id, error, stage, created_at FROM jobs WHERE id = ?')
        .get(input.jobId) as { id: string; status: string; analysis_id: string | null; error: string | null; stage: string | null; created_at: string } | undefined;
      if (!row) return null;
      return {
        id: row.id,
        status: row.status as 'processing' | 'done' | 'error',
        analysisId: row.analysis_id ?? undefined,
        error: row.error ?? undefined,
        stage: row.stage ?? undefined,
        createdAt: row.created_at,
      };
    }),

  analyzeLink: publicProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const metadata = await lookupTrackMetadata(input.url);
      const bpm = metadata.bpm ?? 120;
      const key = keyFromText(metadata.key);

      const { noteEvents, drumHits } = buildGenericPattern(bpm, key);
      const midiBase64 = buildMidiFile({ bpm, key, noteEvents, drumHits });
      const instruments = estimateInstruments(
        { frames: [], sampleRate: 0, hopSize: 0, frameSize: 0, hopSec: 0, durationSec: 0 },
        noteEvents,
        drumHits,
        noteEvents.length ? noteEvents[noteEvents.length - 1].startSec + noteEvents[noteEvents.length - 1].durationSec : 1,
      );

      const base = {
        durationSec: drumHits.length ? drumHits[drumHits.length - 1].atSec : 0,
        bpm,
        bpmConfidence: metadata.bpm ? 0.6 : 0.15,
        key,
        instruments,
        noteEvents,
        drumHits,
        midiBase64,
        transcribed: false,
        transcriptionNote:
          'La transcripción multi-instrumento por IA solo está disponible al subir un archivo de audio; ' +
          'desde un enlace no tenemos acceso al audio para separarlo.',
        fullMidiBase64: undefined,
        transcribedInstruments: [],
      };

      const tutorial =
        `Nota: este patrón es orientativo. No tenemos acceso al audio real del track en ${metadata.platform} ` +
        `(no existe una API pública para descargarlo), así que generamos un patrón compositivo coherente con el ` +
        `tempo/tonalidad detectados en la página del track.\n\n` +
        generateTutorial(base);

      const id = newId('an');
      const result: AnalysisResult = {
        id,
        source: 'link',
        sourceUrl: input.url,
        ...base,
        tutorial,
        createdAt: new Date().toISOString(),
      };

      ctx.db.prepare(`
        INSERT INTO analyses (id, source, file_name, source_url, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, 'link', null, input.url, JSON.stringify(result), result.createdAt);

      return { analysis: result, metadata };
    }),

  getAnalysisById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const row = ctx.db.prepare('SELECT payload FROM analyses WHERE id = ?').get(input.id) as { payload: string } | undefined;
      if (!row) return null;
      return JSON.parse(row.payload) as AnalysisResult;
    }),

  history: publicProcedure.query(({ ctx }) => {
    const rows = ctx.db.prepare('SELECT payload FROM analyses ORDER BY created_at DESC LIMIT 50').all() as { payload: string }[];
    return rows.map((r) => JSON.parse(r.payload) as AnalysisResult);
  }),

  recommend: publicProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const seed = await lookupTrackMetadata(input.url);
      const { similarArtists, similarTracks } = await buildRecommendations(seed);

      const id = newId('rec');
      const result: RecommendationResult = {
        id,
        seed,
        similarArtists,
        similarTracks,
        createdAt: new Date().toISOString(),
      };

      ctx.db.prepare(`
        INSERT INTO recommendations (id, seed_url, payload, created_at)
        VALUES (?, ?, ?, ?)
      `).run(id, input.url, JSON.stringify(result), result.createdAt);

      const harmonicHint = seed.key ? compatibleCamelotCodes(seed.key) : [];

      return { ...result, harmonicHint };
    }),

  getRecommendationById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const row = ctx.db.prepare('SELECT payload FROM recommendations WHERE id = ?').get(input.id) as { payload: string } | undefined;
      if (!row) return null;
      return JSON.parse(row.payload) as RecommendationResult;
    }),

  recommendationHistory: publicProcedure.query(({ ctx }) => {
    const rows = ctx.db.prepare('SELECT payload FROM recommendations ORDER BY created_at DESC LIMIT 50').all() as { payload: string }[];
    return rows.map((r) => JSON.parse(r.payload) as RecommendationResult);
  }),
});
