#include "PluginEditor.h"

using namespace juce;

// ---------- InstrumentRow ----------
InstrumentRow::InstrumentRow (String label, File midiFile) : text (label), file (midiFile)
{
    addAndMakeVisible (nameLabel);
    nameLabel.setText (text, dontSendNotification);
    nameLabel.setColour (Label::textColourId, Colours::white);

    addAndMakeVisible (hintLabel);
    hintLabel.setText ("arrastra al DAW  •  .mid", dontSendNotification);
    hintLabel.setColour (Label::textColourId, Colours::grey);
    hintLabel.setJustificationType (Justification::centredRight);
}

void InstrumentRow::paint (Graphics& g)
{
    g.setColour (Colour (0xff1e1e2e));
    g.fillRoundedRectangle (getLocalBounds().toFloat().reduced (1.0f), 6.0f);
}

void InstrumentRow::resized()
{
    auto r = getLocalBounds().reduced (10, 4);
    hintLabel.setBounds (r.removeFromRight (150));
    nameLabel.setBounds (r);
}

void InstrumentRow::mouseDrag (const MouseEvent&)
{
    if (file.existsAsFile())
    {
        StringArray files;
        files.add (file.getFullPathName());
        // Arrastre externo: suelta el .mid en la línea de tiempo del DAW.
        performExternalDragDropOfFiles (files, false, this);
    }
}

// ---------- Editor ----------
MusicLabAudioProcessorEditor::MusicLabAudioProcessorEditor (MusicLabAudioProcessor& p)
    : AudioProcessorEditor (&p), proc (p)
{
    pool = std::make_unique<ThreadPool> (1);
    tempDir = File::getSpecialLocation (File::tempDirectory).getChildFile ("MusicLabAI");
    tempDir.createDirectory();

    addAndMakeVisible (title);
    title.setText ("MusicLab AI", dontSendNotification);
    title.setFont (Font (20.0f, Font::bold));
    title.setColour (Label::textColourId, Colour (0xff8b5cf6));

    addAndMakeVisible (urlLabel);
    urlLabel.setText ("Backend:", dontSendNotification);
    urlLabel.setColour (Label::textColourId, Colours::lightgrey);

    addAndMakeVisible (urlField);
    urlField.setText (proc.backendUrl, dontSendNotification);
    urlField.setColour (TextEditor::backgroundColourId, Colour (0xff151521));
    urlField.setColour (TextEditor::textColourId, Colours::white);
    urlField.onTextChange = [this] { proc.backendUrl = urlField.getText().trim(); };

    addAndMakeVisible (captureButton);
    captureButton.setClickingTogglesState (true);
    captureButton.onClick = [this] { toggleCapture(); };

    addAndMakeVisible (clearButton);
    clearButton.onClick = [this] { proc.clearCapture(); };

    addAndMakeVisible (analyzeButton);
    analyzeButton.onClick = [this] { runAnalysis(); };

    addAndMakeVisible (statusLabel);
    statusLabel.setColour (Label::textColourId, Colours::lightgrey);
    statusLabel.setText ("Pon el plugin en una pista con audio, captura y analiza.", dontSendNotification);

    addAndMakeVisible (resultsViewport);
    resultsViewport.setViewedComponent (&resultsHolder, false);
    resultsViewport.setScrollBarsShown (true, false);

    setSize (460, 520);
    startTimerHz (5);
}

MusicLabAudioProcessorEditor::~MusicLabAudioProcessorEditor()
{
    stopTimer();
    if (pool) pool->removeAllJobs (true, 2000);
}

void MusicLabAudioProcessorEditor::paint (Graphics& g)
{
    g.fillAll (Colour (0xff0b0b14));
}

void MusicLabAudioProcessorEditor::resized()
{
    auto r = getLocalBounds().reduced (14);
    title.setBounds (r.removeFromTop (30));
    r.removeFromTop (6);

    auto urlRow = r.removeFromTop (28);
    urlLabel.setBounds (urlRow.removeFromLeft (70));
    urlField.setBounds (urlRow);
    r.removeFromTop (8);

    auto btnRow = r.removeFromTop (34);
    captureButton.setBounds (btnRow.removeFromLeft (130));
    btnRow.removeFromLeft (8);
    clearButton.setBounds (btnRow.removeFromLeft (90));
    btnRow.removeFromLeft (8);
    analyzeButton.setBounds (btnRow);
    r.removeFromTop (8);

    statusLabel.setBounds (r.removeFromTop (40));
    r.removeFromTop (6);

    resultsViewport.setBounds (r);
    resultsHolder.setSize (resultsViewport.getWidth() - 8,
                           jmax (resultsViewport.getHeight(), rows.size() * 44));
    int y = 0;
    for (auto* row : rows) { row->setBounds (0, y, resultsHolder.getWidth(), 40); y += 44; }
}

void MusicLabAudioProcessorEditor::timerCallback()
{
    captureButton.setButtonText (proc.isCapturing() ? "Capturando…" : "Capturar");
    if (! busy.load())
    {
        auto secs = proc.getCapturedSeconds();
        if (! proc.isCapturing() && secs == 0.0) return;
        analyzeButton.setEnabled (secs > 0.5);
    }
}

void MusicLabAudioProcessorEditor::toggleCapture()
{
    proc.setCapturing (captureButton.getToggleState());
}

void MusicLabAudioProcessorEditor::runAnalysis()
{
    if (busy.load()) return;

    auto mono = proc.snapshotCapturedMono();
    if (mono.size() < (size_t) (0.5 * proc.getSampleRate2()))
    {
        statusLabel.setText ("Captura algo de audio primero.", dontSendNotification);
        return;
    }

    // Escribir WAV en memoria a partir del audio mono capturado.
    const double sr = proc.getSampleRate2();
    auto wav = std::make_shared<MemoryBlock>();
    {
        WavAudioFormat fmt;
        auto os = std::make_unique<MemoryOutputStream> (*wav, false);
        std::unique_ptr<AudioFormatWriter> writer (
            fmt.createWriterFor (os.get(), sr, 1, 16, {}, 0));
        if (writer != nullptr)
        {
            os.release(); // el writer toma posesión del stream
            AudioBuffer<float> buf (1, (int) mono.size());
            buf.copyFrom (0, 0, mono.data(), (int) mono.size());
            writer->writeFromAudioSampleBuffer (buf, 0, buf.getNumSamples());
        }
    }

    busy.store (true);
    analyzeButton.setEnabled (false);
    captureButton.setEnabled (false);
    statusLabel.setText ("Enviando al backend…", dontSendNotification);

    auto url = proc.backendUrl;
    Component::SafePointer<MusicLabAudioProcessorEditor> safe (this);

    pool->addJob ([this, safe, wav, url]
    {
        BackendClient client (url);
        client.onStage = [safe] (const String& s)
        {
            MessageManager::callAsync ([safe, s]
            {
                if (safe != nullptr) safe->statusLabel.setText ("Procesando: " + s + "…", dontSendNotification);
            });
        };

        auto result = client.analyze (*wav);

        MessageManager::callAsync ([safe, result]
        {
            if (safe != nullptr) safe->showResult (result);
        });
    });
}

void MusicLabAudioProcessorEditor::showResult (const BackendClient::Result& r)
{
    busy.store (false);
    analyzeButton.setEnabled (true);
    captureButton.setEnabled (true);
    statusLabel.setText (r.message, dontSendNotification);

    rows.clear();

    if (r.ok)
    {
        if (r.fullMidi.getSize() > 0)
        {
            auto f = tempDir.getChildFile ("track_completo.mid");
            f.replaceWithData (r.fullMidi.getData(), r.fullMidi.getSize());
            rows.add (new InstrumentRow ("Track completo (todas las pistas)", f));
        }
        for (auto& ins : r.instruments)
        {
            auto safeName = File::createLegalFileName (ins.name) + ".mid";
            auto f = tempDir.getChildFile (safeName);
            f.replaceWithData (ins.midi.getData(), ins.midi.getSize());
            rows.add (new InstrumentRow (ins.name + "  (" + String (ins.noteCount) + " notas)", f));
        }
    }

    for (auto* row : rows) resultsHolder.addAndMakeVisible (row);
    resized();
}
