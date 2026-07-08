import { fetchJson } from './http';

export interface ITunesTrack {
  trackName: string;
  artistName: string;
  primaryGenreName?: string;
  trackViewUrl?: string;
  artworkUrl100?: string;
  collectionName?: string;
}

interface ITunesSearchResponse {
  results: ITunesTrack[];
}

export async function searchItunesTracks(term: string, limit = 8): Promise<ITunesTrack[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`;
    const res = await fetchJson<ITunesSearchResponse>(url);
    return res.results ?? [];
  } catch {
    return [];
  }
}

export async function lookupItunesArtistTopTracks(artist: string, limit = 8): Promise<ITunesTrack[]> {
  return searchItunesTracks(artist, limit);
}
