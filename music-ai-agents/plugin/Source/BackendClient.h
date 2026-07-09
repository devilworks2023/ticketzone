#pragma once
#include <juce_core/juce_core.h>
#include <functional>

/**
 * Cliente del backend MusicLab AI (el mismo servidor tRPC/Hono desplegado).
 * Sube el audio capturado, lanza el análisis asíncrono (MT3), hace polling del
 * job y descarga los MIDIs resultantes. Todo pensado para correr en un hilo
 * aparte (no en el hilo de audio ni en el de UI directamente).
 */
class BackendClient
{
public:
    struct Instrument
    {
        juce::String name;
        int program = 0;
        bool isDrum = false;
        int noteCount = 0;
        juce::MemoryBlock midi;   // bytes del .mid
    };

    struct Result
    {
        bool ok = false;
        juce::String message;
        double bpm = 0.0;
        juce::String key;
        bool transcribed = false;
        juce::MemoryBlock fullMidi;
        juce::Array<Instrument> instruments;
    };

    explicit BackendClient (juce::String baseUrl) : base (baseUrl.trimCharactersAtEnd ("/")) {}

    // Callback de progreso (etapa legible). Se invoca desde el hilo del cliente.
    std::function<void (const juce::String&)> onStage;

    /** Flujo completo y bloqueante: WAV -> startAnalysis -> polling -> resultado. */
    Result analyze (const juce::MemoryBlock& wavData);

private:
    juce::String base;

    juce::var trpcMutation (const juce::String& proc, const juce::var& input, bool& ok);
    juce::var trpcQuery    (const juce::String& proc, const juce::var& input, bool& ok);
    static juce::MemoryBlock decodeBase64 (const juce::String& b64);
};
