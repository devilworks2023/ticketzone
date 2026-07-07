import { parse } from 'node-html-parser';
import { fetchJson, fetchText } from './http';
import type { TrackMetadata } from '../../../types';

interface BandcampOEmbed {
  title: string;
  author_name: string;
  thumbnail_url?: string;
}

export async function lookupBandcamp(url: string): Promise<TrackMetadata> {
  try {
    const oembed = await fetchJson<BandcampOEmbed>(`https://bandcamp.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    const [title, artist] = splitTitleAuthor(oembed.title, oembed.author_name);

    let genre: string | undefined;
    try {
      const html = await fetchText(url);
      const root = parse(html);
      const tagEls = root.querySelectorAll('a.tag');
      const tags = tagEls.map((el) => el.text.trim()).filter(Boolean);
      if (tags.length > 0) genre = tags.slice(0, 3).join(', ');
    } catch {
      // La página de detalle puede fallar sin afectar los metadatos base del oEmbed.
    }

    return {
      platform: 'bandcamp',
      url,
      title,
      artist,
      genre,
      artworkUrl: oembed.thumbnail_url,
      confidence: 'high',
    };
  } catch {
    return fallbackFromUrl(url, 'bandcamp');
  }
}

function splitTitleAuthor(title: string, authorName: string): [string, string] {
  const match = title.match(/^(.*)\s+by\s+(.*)$/i);
  if (match) return [match[1].trim(), match[2].trim()];
  return [title, authorName];
}

export function fallbackFromUrl(url: string, platform: TrackMetadata['platform']): TrackMetadata {
  const guess = guessTitleArtistFromUrl(url);
  return {
    platform,
    url,
    title: guess.title,
    artist: guess.artist,
    confidence: 'low',
  };
}

export function guessTitleArtistFromUrl(url: string): { title: string; artist: string } {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    const subdomain = host.split('.')[0];
    const segments = u.pathname.split('/').filter(Boolean);
    const slug = segments[segments.length - 1] || segments[segments.length - 2] || 'track';
    const humanize = (s: string) => s.replace(/[-_]+/g, ' ').replace(/\d{4,}/g, '').trim();
    return {
      title: humanize(slug) || 'Título desconocido',
      artist: humanize(subdomain === 'bandcamp' ? segments[0] ?? 'Artista desconocido' : subdomain),
    };
  } catch {
    return { title: 'Título desconocido', artist: 'Artista desconocido' };
  }
}
