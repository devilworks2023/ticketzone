import { parse } from 'node-html-parser';
import { fetchText } from './http';
import { fallbackFromUrl } from './bandcamp';
import type { TrackMetadata } from '../../../types';

function meta(root: ReturnType<typeof parse>, property: string): string | undefined {
  const el = root.querySelector(`meta[property="${property}"]`) || root.querySelector(`meta[name="${property}"]`);
  return el?.getAttribute('content')?.trim();
}

/**
 * Beatport y Juno no ofrecen una API pública para terceros. Este scraper hace un mejor esfuerzo
 * leyendo metadatos públicos (OpenGraph / datos embebidos) de la página del track. Si el sitio
 * bloquea la petición (protección anti-bot) se recurre a un título/artista aproximado a partir
 * de la URL, marcado con confidence: 'low'.
 */
export async function lookupBeatport(url: string): Promise<TrackMetadata> {
  try {
    const html = await fetchText(url);
    const root = parse(html);

    const ogTitle = meta(root, 'og:title');
    const description = meta(root, 'og:description') ?? '';
    const image = meta(root, 'og:image');

    let title = 'Título desconocido';
    let artist = 'Artista desconocido';
    if (ogTitle) {
      const match = ogTitle.match(/^(.*)\s+by\s+(.*?)(?:\s+on Beatport)?$/i);
      if (match) {
        title = match[1].trim();
        artist = match[2].trim();
      } else {
        title = ogTitle;
      }
    }

    const bpmMatch = description.match(/(\d{2,3})\s*BPM/i);
    const keyMatch = description.match(/Key:\s*([A-G][#b]?\s*(?:major|minor|maj|min)?)/i);
    const genreMatch = description.match(/Genre:\s*([^,|]+)/i);

    return {
      platform: 'beatport',
      url,
      title,
      artist,
      genre: genreMatch?.[1]?.trim(),
      bpm: bpmMatch ? Number(bpmMatch[1]) : undefined,
      key: keyMatch?.[1]?.trim(),
      artworkUrl: image,
      confidence: ogTitle ? 'medium' : 'low',
    };
  } catch {
    return fallbackFromUrl(url, 'beatport');
  }
}
