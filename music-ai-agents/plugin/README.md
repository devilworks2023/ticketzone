# MusicLab AI — plugin (VST3 / AU)

Plugin de análisis para DAW (Ableton Live, Bitwig, etc.) que convierte audio a
MIDI multi-instrumento reutilizando el backend MusicLab AI ya desplegado.

Es un plugin **analizador** (deja pasar el audio sin tocarlo). Estado actual:

- **Fase 1 (implementada): híbrido.** Captura el audio que pasa por la pista y lo
  envía al backend (MT3) para obtener el MIDI del track completo y un MIDI por
  instrumento. Cada resultado se **arrastra** desde el plugin al DAW como `.mid`.
- **Fase 2 (pendiente): nativo offline.** Integrar basic-pitch (ONNX) dentro del
  plugin para audio→MIDI rápido sin servidor.

## Cómo se usa (una vez instalado)

1. Pon **MusicLab AI** en una pista con audio (como insert).
2. Escribe la URL de tu backend en el campo *Backend* (por defecto
   `http://localhost:3002`; pon aquí la URL pública de tu despliegue).
3. Pulsa **Capturar** y reproduce el fragmento; pulsa de nuevo para parar.
4. Pulsa **Analizar (MT3)**. La transcripción del track completo tarda (el plugin
   muestra la etapa en curso).
5. Aparecen el *Track completo* y cada instrumento detectado: **arrástralos** a la
   línea de tiempo del DAW para crear clips MIDI.

> Nota: por diseño, un VST no puede inyectar clips MIDI en el DAW automáticamente;
> el mecanismo estándar es arrastrar el `.mid`, que es lo que hace este plugin.

## Compilar

Requiere CMake ≥ 3.22 y un compilador C++17. JUCE se descarga solo (FetchContent).

```bash
cd music-ai-agents/plugin
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j
# Artefactos en build/MusicLabAI_artefacts/Release/{VST3,AU,Standalone}/
```

### Binario de Mac sin tener un Mac

El workflow `.github/workflows/plugin-macos.yml` compila en un runner macOS y
sube **MusicLab AI.vst3** y **MusicLab AI.component** (AU) como artefacto. Ejecuta
el workflow (pestaña *Actions* → *Build MusicLab AI plugin (macOS)* → *Run
workflow*, o haz push a `music-ai-agents/plugin/`) y descarga el artefacto
`MusicLabAI-macOS`.

Instalación en Mac:
- VST3 → `~/Library/Audio/Plug-Ins/VST3/` (Live y **Bitwig**).
- AU (`.component`) → `~/Library/Audio/Plug-Ins/Components/` (solo Live).

En Ableton Live activa *Preferencias → Plug-Ins → Usar VST3* y reescanea.
En Bitwig añade la carpeta VST3 en *Settings → Locations* y reescanea.

## Formatos

- **VST3**: funciona en Live y Bitwig (macOS/Windows/Linux).
- **AU**: solo macOS; útil en Live (Bitwig no usa AU).
- **Standalone**: app suelta para probar sin DAW.
