#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include <atomic>
#include <vector>

/**
 * MusicLab AI — plugin de análisis (VST3/AU). Fase 1 (híbrido): captura el audio
 * que pasa por la pista y lo envía al backend MusicLab (MT3) para obtener MIDI
 * multi-instrumento. El audio pasa inalterado (es un analizador, no procesa).
 */
class MusicLabAudioProcessor : public juce::AudioProcessor
{
public:
    MusicLabAudioProcessor();
    ~MusicLabAudioProcessor() override = default;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout&) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "MusicLab AI"; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return true; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock&) override;
    void setStateInformation (const void*, int) override;

    // ---- API para el editor ----
    void setCapturing (bool shouldCapture);
    bool isCapturing() const { return capturing.load(); }
    void clearCapture();
    double getCapturedSeconds() const;
    double getSampleRate2() const { return currentSampleRate; }

    /** Copia segura del audio capturado (mono) para enviarlo al backend. */
    std::vector<float> snapshotCapturedMono() const;

    // URL del backend, persistida con el estado del plugin.
    juce::String backendUrl { "http://localhost:3002" };

private:
    double currentSampleRate = 44100.0;
    std::atomic<bool> capturing { false };

    mutable juce::CriticalSection captureLock;
    std::vector<float> capturedMono;                 // protegido por captureLock
    static constexpr double kMaxCaptureSeconds = 8 * 60;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MusicLabAudioProcessor)
};
