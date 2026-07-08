import { lookupBandcamp } from './bandcamp';
import { lookupSoundCloud } from './soundcloud';
import { lookupSpotify } from './spotify';
import { lookupBeatport } from './beatport';
import { lookupJuno } from './juno';
import type { LookupPlatform, TrackMetadata } from '../../../types';

export function detectPlatform(url: string): LookupPlatform {
  const host = safeHost(url);
  if (!host) return 'unknown';
  if (host.includes('bandcamp.com')) return 'bandcamp';
  if (host.includes('soundcloud.com')) return 'soundcloud';
  if (host.includes('open.spotify.com')) return 'spotify';
  if (host.includes('beatport.com')) return 'beatport';
  if (host.includes('junodownload.com')) return 'juno';
  if (host.includes('music.apple.com')) return 'apple-music';
  return 'unknown';
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return null;
  }
}

export async function lookupTrackMetadata(url: string): Promise<TrackMetadata> {
  const platform = detectPlatform(url);

  switch (platform) {
    case 'bandcamp':
      return lookupBandcamp(url);
    case 'soundcloud':
      return lookupSoundCloud(url);
    case 'spotify':
      return lookupSpotify(url);
    case 'beatport':
      return lookupBeatport(url);
    case 'juno':
      return lookupJuno(url);
    default:
      return {
        platform: 'unknown',
        url,
        title: 'Enlace no reconocido',
        artist: 'Desconocido',
        confidence: 'low',
      };
  }
}
