import { fetchJson } from './http';
import { fallbackFromUrl } from './bandcamp';
import type { TrackMetadata } from '../../../types';

interface SoundCloudOEmbed {
  title: string;
  thumbnail_url?: string;
}

export async function lookupSoundCloud(url: string): Promise<TrackMetadata> {
  try {
    const oembed = await fetchJson<SoundCloudOEmbed>(
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    );
    const match = oembed.title.match(/^(.*)\s+by\s+(.*)$/i);
    const title = match ? match[1].trim() : oembed.title;
    const artist = match ? match[2].trim() : 'Artista desconocido';

    return {
      platform: 'soundcloud',
      url,
      title,
      artist,
      artworkUrl: oembed.thumbnail_url,
      confidence: 'high',
    };
  } catch {
    return fallbackFromUrl(url, 'soundcloud');
  }
}
