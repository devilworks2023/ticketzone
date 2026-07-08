import { fetchJson } from './http';

interface MbArtist {
  name: string;
  tags?: { name: string; count: number }[];
  score?: number;
}

interface MbArtistSearchResponse {
  artists: MbArtist[];
}

const MB_HEADERS = { 'User-Agent': 'MusicLabAI/1.0 (contact: support@musiclab.ai)' };

export async function findArtistGenreTags(artist: string): Promise<string[]> {
  try {
    const url = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(`artist:${artist}`)}&fmt=json&limit=1`;
    const res = await fetchJson<MbArtistSearchResponse>(url, MB_HEADERS);
    const best = res.artists?.[0];
    return best?.tags?.sort((a, b) => b.count - a.count).map((t) => t.name) ?? [];
  } catch {
    return [];
  }
}

export async function findRelatedArtistsByTag(tag: string, excludeArtist: string, limit = 6): Promise<string[]> {
  try {
    const url = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(`tag:"${tag}"`)}&fmt=json&limit=${limit + 3}`;
    const res = await fetchJson<MbArtistSearchResponse>(url, MB_HEADERS);
    return (res.artists ?? [])
      .map((a) => a.name)
      .filter((name) => name.toLowerCase() !== excludeArtist.toLowerCase())
      .slice(0, limit);
  } catch {
    return [];
  }
}
