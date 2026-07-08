import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { UploadCloud, Link2, FileAudio } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';
import { readFileAsBase64 } from '@/lib/readFileBase64';

type Mode = 'upload' | 'link';

export default function AnalyzerScreen() {
  const [mode, setMode] = useState<Mode>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [link, setLink] = useState('');

  const analyzeUpload = trpc.tracks.analyzeUpload.useMutation({
    onSuccess: (result) => router.push(`/analyzer/${result.id}`),
    onError: (err) => Alert.alert('Error al analizar', err.message),
  });

  const analyzeLink = trpc.tracks.analyzeLink.useMutation({
    onSuccess: (result) => router.push(`/analyzer/${result.analysis.id}`),
    onError: (err) => Alert.alert('Error al analizar el enlace', err.message),
  });

  const isLoading = analyzeUpload.isPending || analyzeLink.isPending;

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav'] });
    if (result.canceled || !result.assets?.[0]) return;
    setFileName(result.assets[0].name);
    setFileUri(result.assets[0].uri);
  };

  const submitUpload = async () => {
    if (!fileUri || !fileName) {
      Alert.alert('Falta un archivo', 'Selecciona un archivo de audio WAV o MP3.');
      return;
    }
    const base64Audio = await readFileAsBase64(fileUri);
    analyzeUpload.mutate({ base64Audio, fileName });
  };

  const submitLink = () => {
    if (!link.trim()) {
      Alert.alert('Falta un enlace', 'Pega el enlace de un track de Beatport, Bandcamp, Juno, Spotify o SoundCloud.');
      return;
    }
    analyzeLink.mutate({ url: link.trim() });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, mode === 'upload' && styles.tabActive]}
          onPress={() => setMode('upload')}
          testID="tab-upload"
        >
          <Text style={[styles.tabText, mode === 'upload' && styles.tabTextActive]}>Subir audio</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'link' && styles.tabActive]}
          onPress={() => setMode('link')}
          testID="tab-link"
        >
          <Text style={[styles.tabText, mode === 'link' && styles.tabTextActive]}>Enlace a plataforma</Text>
        </TouchableOpacity>
      </View>

      {mode === 'upload' ? (
        <View style={styles.panel}>
          <Text style={styles.panelHint}>
            Analizamos el audio real (tempo, tonalidad, ideas melódicas) y lo separamos por
            instrumento con IA (Demucs) para darte un MIDI por instrumento. Formatos: WAV y MP3.
          </Text>
          <TouchableOpacity style={styles.pickButton} onPress={pickFile} testID="pick-file-btn">
            <UploadCloud color={Colors.dark.primary} size={22} />
            <Text style={styles.pickButtonText}>{fileName ?? 'Seleccionar archivo de audio'}</Text>
          </TouchableOpacity>
          {fileName && (
            <View style={styles.fileBadge}>
              <FileAudio color={Colors.dark.accent} size={16} />
              <Text style={styles.fileBadgeText}>{fileName}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={submitUpload}
            disabled={isLoading}
            testID="submit-upload-btn"
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Analizar audio</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.panelHint}>
            Como no existe forma de descargar el audio real desde estas tiendas/plataformas,
            generamos un patrón orientativo (bajo + acordes + batería base) a partir del tempo y
            la tonalidad publicados en la página del track.
          </Text>
          <View style={styles.inputWrap}>
            <Link2 color={Colors.dark.textMuted} size={18} />
            <TextInput
              style={styles.input}
              placeholder="https://www.beatport.com/track/..."
              placeholderTextColor={Colors.dark.textMuted}
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
              autoCorrect={false}
              testID="link-input"
            />
          </View>
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={submitLink}
            disabled={isLoading}
            testID="submit-link-btn"
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Analizar enlace</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, gap: 16 },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.dark.surface, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.dark.primaryMuted },
  tabText: { color: Colors.dark.textMuted, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: Colors.dark.text },
  panel: { gap: 14 },
  panelHint: { color: Colors.dark.textMuted, fontSize: 13, lineHeight: 18 },
  pickButton: {
    flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.dark.border, borderStyle: 'dashed',
    borderRadius: 14, paddingVertical: 22, backgroundColor: Colors.dark.surface,
  },
  pickButtonText: { color: Colors.dark.text, fontWeight: '600' },
  fileBadge: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'flex-start', backgroundColor: Colors.dark.surfaceAlt, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  fileBadgeText: { color: Colors.dark.text, fontSize: 13 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.dark.surface,
    borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.dark.border,
  },
  input: { flex: 1, color: Colors.dark.text, paddingVertical: 14, fontSize: 14 },
  submitButton: { backgroundColor: Colors.dark.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
