#pragma once
#include <juce_audio_utils/juce_audio_utils.h>
#include "PluginProcessor.h"
#include "BackendClient.h"

/** Fila de un instrumento resultante: muestra su nombre y permite arrastrar su
 *  .mid directamente al DAW (drag-and-drop externo de archivos). */
class InstrumentRow : public juce::Component
{
public:
    InstrumentRow (juce::String label, juce::File midiFile);
    void paint (juce::Graphics&) override;
    void resized() override;
    void mouseDrag (const juce::MouseEvent&) override;

private:
    juce::String text;
    juce::File file;
    juce::Label nameLabel;
    juce::Label hintLabel;
};

class MusicLabAudioProcessorEditor : public juce::AudioProcessorEditor,
                                     private juce::Timer
{
public:
    explicit MusicLabAudioProcessorEditor (MusicLabAudioProcessor&);
    ~MusicLabAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    void toggleCapture();
    void runAnalysis();
    void showResult (const BackendClient::Result&);

    MusicLabAudioProcessor& proc;

    juce::Label title;
    juce::Label urlLabel;
    juce::TextEditor urlField;
    juce::TextButton captureButton { "Capturar" };
    juce::TextButton clearButton { "Borrar" };
    juce::TextButton analyzeButton { "Analizar (MT3)" };
    juce::Label statusLabel;
    juce::Viewport resultsViewport;
    juce::Component resultsHolder;
    juce::OwnedArray<InstrumentRow> rows;

    juce::File tempDir;
    std::unique_ptr<juce::ThreadPool> pool;
    std::atomic<bool> busy { false };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MusicLabAudioProcessorEditor)
};
