# MusicLab AI

Aplicación independiente (Expo + tRPC/Hono) con dos agentes de IA para productores/DJs:

1. **Agente Analizador** — sube un archivo de audio (WAV/MP3) o pega el enlace de un track y
   obtén tempo (BPM), tonalidad (con código Camelot), una estimación heurística de
   instrumentación, y un **patrón MIDI real** (bajo/melodía + batería) exportable/compartible,
   junto con una guía de texto sobre cómo reconstruir un track con ese patrón.
2. **Agente de Recomendaciones** — pega el enlace de un track y descubre artistas y canciones
   afines, con enlaces de búsqueda directos en Beatport, Bandcamp, Juno y Spotify.

## Cómo correrlo

```bash
npm install
npm run backend   # levanta el backend tRPC/Hono en http://localhost:3002
npm run start     # levanta la app Expo (otra terminal)
```

Variable opcional `EXPO_PUBLIC_MUSICLAB_API_BASE_URL` para apuntar el cliente a otra URL del backend.

## Qué es real y qué es heurístico/orientativo (léase antes de usar)

Este proyecto prioriza hacer trabajo de señal real en vez de simular resultados. Aun así, hay
límites técnicos y de plataforma que conviene conocer:

- **Análisis de audio subido (WAV/MP3): real.** Se decodifica el audio (WAV vía `wav-decoder`,
  MP3 vía el decodificador WASM `mpg123-decoder`), y se procesa con DSP propio: FFT, detección de
  tempo por autocorrelación del flujo espectral, detección de tonalidad con perfiles de
  Krumhansl-Schmuckler sobre un vector de croma, seguimiento de altura (pitch) por picos
  espectrales con interpolación parabólica, y detección de onsets para percusión. El MIDI
  generado (`midi-writer-js`) proviene directamente de esas notas/onsets detectados.
- **Instrumentación:** es una **estimación heurística** por energía espectral en bandas y
  densidad de onsets (bajo / batería / melodía / armonía), no una clasificación con un modelo
  entrenado de separación de instrumentos. Se documenta así en la propia respuesta.
- **Transcripción:** se limita a una ventana corta (hasta ~8 compases / 32s) desde el inicio del
  audio: el objetivo es un *patrón* aprendible, no transcribir la canción completa. También es
  principalmente monofónica (mejor para líneas de bajo/lead que para acordes polifónicos densos).
- **Enlaces a Beatport / Bandcamp / Juno / Spotify / SoundCloud: no hay forma de descargar el
  audio real** de esas plataformas (no exponen esa API para terceros). Para esos casos:
  - Bandcamp, SoundCloud y Spotify sí tienen **oEmbed público** (título/artista/miniatura) y se
    usa tal cual.
  - Beatport y Juno **no tienen API pública**; se intenta leer metadatos públicos de la página
    (Open Graph, BPM/Key si aparecen en el texto) con un *best-effort scraper*, y si el sitio
    bloquea la petición (ej. protección anti-bot) se cae a un título/artista aproximado desde la
    URL, marcado explícitamente con `confidence: 'low'`.
  - Como no tenemos el audio, el "patrón MIDI" para un enlace es una **progresión armónica
    orientativa** (bajo + acordes diatónicos + batería base) generada a partir del tempo/tonalidad
    de la metadata (o valores por defecto si no hay datos), **no una transcripción del audio
    real**. Esto se indica explícitamente en la guía de texto devuelta.
- **Recomendaciones:** usan APIs públicas reales sin necesidad de credenciales — [iTunes Search
  API](https://performance-partners.apple.com/search-api) para tracks/artistas por género o
  nombre, y [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API) para tags de género y
  artistas relacionados. No se inventan BPM/tonalidad para los resultados recomendados porque esas
  APIs no los proveen.
- **"Enviar tracks a las plataformas":** por diseño, esta app **no sube ni publica** nada en
  Beatport/Bandcamp/Juno (no existe una API pública de terceros para eso; solo lo permiten a
  través de agregadores/distribuidoras). En su lugar, la IA **usa** los enlaces a tracks de esas
  plataformas como entrada para analizarlos y recomendar música similar.

## Estructura

```
backend/
  services/audio/     DSP real: decode, features (FFT/chroma), tempo, key, notes, instruments, midi
  services/lookup/     metadata de Bandcamp/SoundCloud/Spotify (oEmbed) y Beatport/Juno (scraping best-effort)
  services/recommend/  motor de recomendaciones (iTunes + MusicBrainz) y utilidades Camelot
  trpc/routes/tracks.ts  endpoints: analyzeUpload, analyzeLink, recommend, history
app/
  index.tsx            selector de agentes
  analyzer/            subir audio o pegar enlace → resultado + descarga MIDI
  recommender/         pegar enlace → artistas/tracks similares con enlaces de búsqueda
  history/             historial local de análisis y recomendaciones
```
