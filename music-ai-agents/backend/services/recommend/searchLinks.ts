export function buildSearchLinks(title: string, artist: string) {
  const q = encodeURIComponent(`${artist} ${title}`.trim());
  return {
    beatport: `https://www.beatport.com/search?q=${q}`,
    bandcamp: `https://bandcamp.com/search?q=${q}`,
    juno: `https://www.junodownload.com/search/?q%5Ball%5D%5B0%5D=${q}`,
    spotify: `https://open.spotify.com/search/${q}`,
  };
}
