import { fetchJson } from './http';
import { fallbackFromUrl } from './bandcamp';
import type { TrackMetadata } from '../../../types';

interface SpotifyOEmbed {
  title: string;
  thumbnail_url?: string;
}

export async function lookupSpotify(url: string): Promise<TrackMetadata> {
  try {
    const oembed = await fetchJson<SpotifyOEmbed>(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
    );
    const match = oembed.title.match(/^(.*)\s+[-–]\s+(.*)$/);
    const title = match ? match[2].trim() : oembed.title;
    const artist = match ? match[1].trim() : 'Artista desconocido';

    return {
      platform: 'spotify',
      url,
      title,
      artist,
      artworkUrl: oembed.thumbnail_url,
      confidence: 'high',
    };
  } catch {
    return fallbackFromUrl(url, 'spotify');
  }
}
