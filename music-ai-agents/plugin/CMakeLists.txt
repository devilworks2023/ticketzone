cmake_minimum_required(VERSION 3.22)
project(MusicLabAI VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)
FetchContent_Declare(
    JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG        8.0.4
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(JUCE)

# Formats: VST3 (Live + Bitwig en Mac/Win/Linux), AU (solo Mac, para Live),
# y Standalone (útil para probar sin DAW). AU se ignora fuera de macOS.
set(MUSICLAB_FORMATS VST3 Standalone)
if(APPLE)
    list(APPEND MUSICLAB_FORMATS AU)
endif()

juce_add_plugin(MusicLabAI
    COMPANY_NAME "MusicLab"
    PLUGIN_MANUFACTURER_CODE Mlab
    PLUGIN_CODE Mla1
    FORMATS ${MUSICLAB_FORMATS}
    PRODUCT_NAME "MusicLab AI"
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT TRUE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD FALSE
    VST3_CATEGORIES "Analyzer" "Tools"
)

target_sources(MusicLabAI PRIVATE
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp
    Source/BackendClient.cpp
)

target_compile_definitions(MusicLabAI PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=1          # HTTP hacia el backend en Linux/macOS
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_DISPLAY_SPLASH_SCREEN=0
)

target_link_libraries(MusicLabAI PRIVATE
    juce::juce_audio_utils
    juce::juce_audio_processors
    juce::juce_dsp
    PUBLIC
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)
