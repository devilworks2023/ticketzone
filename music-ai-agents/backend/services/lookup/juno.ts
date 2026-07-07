import { parse } from 'node-html-parser';
import { fetchText } from './http';
import { fallbackFromUrl } from './bandcamp';
import type { TrackMetadata } from '../../../types';

function meta(root: ReturnType<typeof parse>, property: string): string | undefined {
  const el = root.querySelector(`meta[property="${property}"]`) || root.querySelector(`meta[name="${property}"]`);
  return el?.getAttribute('content')?.trim();
}

/** Ver nota de limitaciones en beatport.ts: Juno Download tampoco expone API pública. */
export async function lookupJuno(url: string): Promise<TrackMetadata> {
  try {
    const html = await fetchText(url);
    const root = parse(html);

    const ogTitle = meta(root, 'og:title');
    const image = meta(root, 'og:image');
    const bodyText = root.text;

    const bpmMatch = bodyText.match(/BPM[:\s]+(\d{2,3})/i);
    const keyMatch = bodyText.match(/Key[:\s]+([A-G][#b]?\s*(?:major|minor|maj|min)?)/i);

    let title = 'Título desconocido';
    let artist = 'Artista desconocido';
    if (ogTitle) {
      const match = ogTitle.match(/^(.*?)\s*[-–]\s*(.*)$/);
      if (match) {
        artist = match[1].trim();
        title = match[2].trim();
      } else {
        title = ogTitle;
      }
    }

    return {
      platform: 'juno',
      url,
      title,
      artist,
      bpm: bpmMatch ? Number(bpmMatch[1]) : undefined,
      key: keyMatch?.[1]?.trim(),
      artworkUrl: image,
      confidence: ogTitle ? 'medium' : 'low',
    };
  } catch {
    return fallbackFromUrl(url, 'juno');
  }
}
