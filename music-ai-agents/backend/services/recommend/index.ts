import { searchItunesTracks } from '../lookup/itunes';
import { findArtistGenreTags, findRelatedArtistsByTag } from '../lookup/musicbrainz';
import { buildSearchLinks } from './searchLinks';
import type { TrackMetadata, RecommendationItem } from '../../../types';

export async function buildRecommendations(seed: TrackMetadata): Promise<{
  similarArtists: { name: string; reason: string }[];
  similarTracks: RecommendationItem[];
}> {
  const genreTags = await findArtistGenreTags(seed.artist);
  const primaryTag = seed.genre?.split(',')[0]?.trim() || genreTags[0];

  const [relatedArtists, genreTracks, artistTracks] = await Promise.all([
    primaryTag ? findRelatedArtistsByTag(primaryTag, seed.artist) : Promise.resolve([] as string[]),
    primaryTag ? searchItunesTracks(primaryTag, 10) : Promise.resolve([]),
    searchItunesTracks(seed.artist, 6),
  ]);

  const similarArtists = relatedArtists.map((name) => ({
    name,
    reason: primaryTag
      ? `Comparte el género/etiqueta "${primaryTag}" con ${seed.artist}`
      : `Sugerido a partir de similitud con ${seed.artist}`,
  }));

  const seenTitles = new Set<string>();
  const candidateTracks = [...artistTracks, ...genreTracks].filter((t) => {
    const key = `${t.artistName}::${t.trackName}`.toLowerCase();
    if (seenTitles.has(key)) return false;
    if (t.artistName.toLowerCase() === seed.artist.toLowerCase() && t.trackName.toLowerCase() === seed.title.toLowerCase()) return false;
    seenTitles.add(key);
    return true;
  });

  const similarTracks: RecommendationItem[] = candidateTracks.slice(0, 10).map((t) => {
    const sameArtist = t.artistName.toLowerCase() === seed.artist.toLowerCase();
    const sameGenre = primaryTag && t.primaryGenreName?.toLowerCase().includes(primaryTag.toLowerCase());
    const matchScore = (sameArtist ? 0.6 : 0) + (sameGenre ? 0.4 : 0.2);

    return {
      title: t.trackName,
      artist: t.artistName,
      genre: t.primaryGenreName,
      matchReason: sameArtist
        ? `Mismo artista (${t.artistName})`
        : sameGenre
          ? `Mismo género (${t.primaryGenreName}) que "${seed.title}"`
          : `Relacionado con la búsqueda de "${primaryTag ?? seed.artist}"`,
      matchScore: Math.round(matchScore * 100) / 100,
      searchLinks: buildSearchLinks(t.trackName, t.artistName),
    };
  }).sort((a, b) => b.matchScore - a.matchScore);

  return { similarArtists, similarTracks };
}
