#include "PluginProcessor.h"
#include "PluginEditor.h"

using namespace juce;

MusicLabAudioProcessor::MusicLabAudioProcessor()
    : AudioProcessor (BusesProperties()
          .withInput ("Input", AudioChannelSet::stereo(), true)
          .withOutput ("Output", AudioChannelSet::stereo(), true))
{
    capturedMono.reserve (44100 * 60);
}

void MusicLabAudioProcessor::prepareToPlay (double sampleRate, int)
{
    currentSampleRate = sampleRate;
}

bool MusicLabAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto& out = layouts.getMainOutputChannelSet();
    if (out != AudioChannelSet::mono() && out != AudioChannelSet::stereo())
        return false;
    return layouts.getMainInputChannelSet() == out;
}

void MusicLabAudioProcessor::processBlock (AudioBuffer<float>& buffer, MidiBuffer&)
{
    const int numSamples = buffer.getNumSamples();
    const int numCh = buffer.getNumChannels();

    if (capturing.load() && numSamples > 0 && numCh > 0)
    {
        const ScopedLock sl (captureLock);
        const auto maxSamples = (size_t) (kMaxCaptureSeconds * currentSampleRate);
        if (capturedMono.size() < maxSamples)
        {
            for (int i = 0; i < numSamples; ++i)
            {
                float sum = 0.0f;
                for (int c = 0; c < numCh; ++c) sum += buffer.getReadPointer (c)[i];
                capturedMono.push_back (sum / (float) numCh);
            }
        }
        else
        {
            capturing.store (false); // tope alcanzado
        }
    }

    // Analizador: el audio pasa inalterado. No generamos MIDI en tiempo real.
    ignoreUnused (buffer);
}

void MusicLabAudioProcessor::setCapturing (bool shouldCapture) { capturing.store (shouldCapture); }

void MusicLabAudioProcessor::clearCapture()
{
    const ScopedLock sl (captureLock);
    capturedMono.clear();
}

double MusicLabAudioProcessor::getCapturedSeconds() const
{
    const ScopedLock sl (captureLock);
    return (double) capturedMono.size() / currentSampleRate;
}

std::vector<float> MusicLabAudioProcessor::snapshotCapturedMono() const
{
    const ScopedLock sl (captureLock);
    return capturedMono; // copia
}

void MusicLabAudioProcessor::getStateInformation (MemoryBlock& destData)
{
    MemoryOutputStream os (destData, false);
    os.writeString (backendUrl);
}

void MusicLabAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    MemoryInputStream is (data, (size_t) sizeInBytes, false);
    auto url = is.readString();
    if (url.isNotEmpty()) backendUrl = url;
}

AudioProcessorEditor* MusicLabAudioProcessor::createEditor()
{
    return new MusicLabAudioProcessorEditor (*this);
}

// Punto de entrada del plugin
AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new MusicLabAudioProcessor();
}
