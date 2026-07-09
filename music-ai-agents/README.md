# MusicLab AI

Aplicación independiente (Expo + tRPC/Hono) con dos agentes de IA para productores/DJs:

1. **Agente Analizador** — sube un archivo de audio (WAV/MP3/AIFF/FLAC/M4A/OGG…) o pega el enlace
   de un track y obtén tempo (BPM), tonalidad (con código Camelot), un **patrón MIDI** de la mezcla,
   y una guía de texto sobre cómo reconstruir un track. Al subir audio, además **transcribe el track
   completo con IA (MT3)**, distinguiendo los instrumentos por su programa General MIDI y devolviendo
   un **MIDI por instrumento** más el **MIDI completo** de todas las pistas.
2. **Agente de Recomendaciones** — pega el enlace de un track y descubre artistas y canciones
   afines, con enlaces de búsqueda directos en Beatport, Bandcamp, Juno y Spotify.

## Arquitectura (dos servicios)

- **web** — frontend Expo Web + backend tRPC/Hono (mismo proceso en producción). `Dockerfile` raíz.
- **transcription** — servicio Python con **MT3** (`magenta/mt3`, checkpoint multi-instrumento) que
  transcribe el audio a MIDI multipista. Vive en `transcription-service/`. El backend lo descubre por
  `TRANSCRIPTION_SERVICE_URL`. Si está caído, el analizador **degrada con gracia** al análisis de la
  mezcla (`transcribed: false`) sin romperse.

Como transcribir un track completo con MT3 en CPU tarda **minutos**, el análisis de audio es
**asíncrono**: `startAnalysis` crea un job y devuelve un `jobId`; el cliente hace *polling* de `getJob`
hasta que termina. El análisis por enlace (sin audio) sigue siendo síncrono.

## Cómo correrlo en local

Opción rápida con Docker (ambos servicios):

```bash
docker compose up --build
# web:           http://localhost:3002
# transcription: interno (http://transcription:8000)
```

O a mano, en tres terminales:

```bash
npm install
npm run backend   # backend tRPC/Hono en http://localhost:3002
npm run start     # app Expo web

# servicio de transcripción (Python, pesado):
cd transcription-service && pip install -r requirements.txt
# (requiere el repo mt3 instalado y el checkpoint; ver Dockerfile)
uvicorn app:app --port 8000
# y arranca el backend con TRANSCRIPTION_SERVICE_URL=http://localhost:8000
```

Variables:
- `EXPO_PUBLIC_MUSICLAB_API_BASE_URL` — URL del backend para el cliente.
- `TRANSCRIPTION_SERVICE_URL` — URL del servicio MT3 (default `http://localhost:8001` en dev, `http://transcription:8000` en Docker).
- `TRANSCRIPTION_TIMEOUT_MS` — timeout de la transcripción (default 900000, 15 min).
- `FFMPEG_PATH` — ruta a ffmpeg si no está en el PATH.

## Publicar en la web (Railway / Render)

Son **dos servicios** desplegables por separado desde este mismo repo:

1. **web** (`Dockerfile` raíz): exporta el frontend Expo Web y lo sirve desde el mismo proceso
   Hono que expone la API en `/api/trpc` — un único puerto. Incluye ffmpeg (para decodificar
   AIFF/FLAC/M4A/OGG…). La base de datos es SQLite en disco (`/app/data/musiclab.db`), así que
   necesita **volumen/disco persistente**.
2. **transcription** (`transcription-service/Dockerfile`): el servicio MT3. Es una imagen **muy
   grande** (jax + tensorflow + t5x + checkpoint) y consume CPU/RAM (**recomendado ≥ 3-4 GB RAM**);
   transcribir en CPU tarda ~0.8x el tiempo real del audio. No necesita disco persistente.

El servicio **web** se conecta al de **transcription** por la variable `TRANSCRIPTION_SERVICE_URL`.

> Nota: el servicio de transcripción es **opcional**. Si no lo despliegas (o lo apagas para ahorrar
> coste), el analizador sigue funcionando y solo omite la transcripción por instrumento
> (`transcribed: false`), mostrando el análisis de la mezcla.

### Railway

1. New Project → Deploy from GitHub repo → selecciona este repo (dos veces, un servicio por deploy).
2. **Servicio web**: **Settings → Root Directory** = `music-ai-agents`. Añade un **Volume** en
   `/app/data`. Railway asigna `PORT` solo.
3. **Servicio transcription**: **Root Directory** = `music-ai-agents/transcription-service`. Sin
   volumen. Dale una instancia con memoria suficiente (**≥ 3-4 GB**). El build es largo (descarga
   el modelo y compila el stack).
4. En el servicio **web**, añade la variable `TRANSCRIPTION_SERVICE_URL` apuntando a la URL interna
   del servicio de transcripción (Railway permite referenciar servicios entre sí en el mismo proyecto).
5. Deploy. Railway te da la URL pública del servicio web (`*.up.railway.app`) o tu dominio propio.

### Render

1. **Web Service** #1: Root Directory `music-ai-agents`, runtime Docker, añade un **Disk** en
   `/app/data`.
2. **Web Service** #2: Root Directory `music-ai-agents/transcription-service`, runtime Docker,
   instancia con ≥ 3-4 GB RAM.
3. En el servicio #1 añade `TRANSCRIPTION_SERVICE_URL` con la URL interna del #2.

### Notas

- Healthchecks: `/health` en ambos servicios.
- Si quieres el despliegue **más barato**: publica solo el servicio **web** y omite el de
  transcripción; la app funciona igual sin la función de instrumentos por IA (analiza tempo/tonalidad
  y patrón de la mezcla).
- Publicar en tiendas móviles (App Store / Play Store) es un paso aparte: requiere cuentas de
  desarrollador propias y build con `eas build`/`eas submit` — no está configurado todavía.

## Qué es real y qué es heurístico/orientativo (léase antes de usar)

Este proyecto prioriza hacer trabajo de señal real en vez de simular resultados. Aun así, hay
límites técnicos y de plataforma que conviene conocer:

- **Análisis de audio subido: real.** Formatos: WAV y MP3 se decodifican con librerías JS puras
  (`wav-decoder`, `mpg123-decoder`); **AIFF, FLAC, M4A/AAC, OGG, OPUS, WMA y otros** vía **ffmpeg**
  (si está instalado en el servidor — lo está en la imagen Docker). Luego se procesa con DSP propio:
  FFT, detección de tempo por autocorrelación del flujo espectral, detección de tonalidad con
  perfiles de Krumhansl-Schmuckler sobre un vector de croma, seguimiento de altura (pitch) por
  picos espectrales con interpolación parabólica, y detección de onsets para percusión. El MIDI
  generado (`midi-writer-js`) proviene directamente de esas notas/onsets detectados.
  > Sin ffmpeg en el servidor, el backend sigue admitiendo WAV y MP3; el resto de formatos requieren
  > ffmpeg (`apt-get install ffmpeg` o equivalente).
- **Transcripción multi-instrumento: IA real (MT3).** Al subir audio, el servicio `transcription`
  usa **MT3** (`magenta/mt3`, modelo transformer entrenado) para transcribir el **track completo** a
  MIDI multipista, distinguiendo instrumentos por su **programa General MIDI** (bajo, piano, guitarra,
  cuerdas, vientos, batería… muchas más categorías que un número fijo). Devuelve un MIDI por
  instrumento y el MIDI completo con todas las pistas. La barra de "instrumentación estimada" que se
  muestra aparte sigue siendo una heurística rápida por bandas; la transcripción real por IA es la
  sección "Instrumentos del track (IA)".
  > La conversión audio→MIDI nunca es una partitura perfecta: MT3 aproxima notas, tiempos y qué
  > instrumento toca qué. La calidad depende mucho del material (mejor en grabaciones limpias que en
  > mezclas muy densas o muy saturadas).
- **Duración y espera:** se transcribe el track completo (con un tope de seguridad configurable,
  `MT3_MAX_SECONDS`, por defecto 7 min). Como MT3 en CPU va a ~0.8x tiempo real, el análisis es
  **asíncrono** (job + polling) y puede tardar varios minutos en canciones largas.
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
