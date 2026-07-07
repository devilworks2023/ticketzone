import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Download, Music2, Gauge, KeyRound } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';
import { shareMidiBase64 } from '@/lib/share';

export default function AnalyzerResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: analysis, isLoading, error } = trpc.tracks.getAnalysisById.useQuery({ id: id! }, { enabled: !!id });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.dark.primary} size="large" />
      </View>
    );
  }

  if (error || !analysis) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No se encontró el análisis solicitado.</Text>
      </View>
    );
  }

  const handleDownload = async () => {
    try {
      await shareMidiBase64(analysis.midiBase64, `patron_${analysis.id}.mid`);
    } catch {
      Alert.alert('Error', 'No se pudo exportar el archivo MIDI.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Gauge color={Colors.dark.accent} size={20} />
          <Text style={styles.statValue}>{analysis.bpm} BPM</Text>
          <Text style={styles.statLabel}>confianza {Math.round(analysis.bpmConfidence * 100)}%</Text>
        </View>
        <View style={styles.statCard}>
          <KeyRound color={Colors.dark.primary} size={20} />
          <Text style={styles.statValue}>{analysis.key.name}</Text>
          <Text style={styles.statLabel}>Camelot {analysis.key.camelot}</Text>
        </View>
        <View style={styles.statCard}>
          <Music2 color={Colors.dark.success} size={20} />
          <Text style={styles.statValue}>{analysis.noteEvents.length}</Text>
          <Text style={styles.statLabel}>notas detectadas</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Instrumentación estimada</Text>
      <View style={styles.instrumentList}>
        {analysis.instruments.map((inst) => (
          <View key={inst.tag} style={styles.instrumentRow}>
            <Text style={styles.instrumentLabel}>{inst.label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.round(inst.presence * 100)}%` }]} />
            </View>
            <Text style={styles.instrumentPct}>{Math.round(inst.presence * 100)}%</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.downloadButton} onPress={handleDownload} testID="download-midi-btn">
        <Download color="#fff" size={18} />
        <Text style={styles.downloadButtonText}>Exportar / compartir patrón MIDI</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Cómo construir un track con este patrón</Text>
      <View style={styles.tutorialBox}>
        <Text style={styles.tutorialText}>{analysis.tutorial}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, gap: 20, paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark.background, padding: 20 },
  errorText: { color: Colors.dark.error, fontSize: 15 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 14, gap: 6, borderWidth: 1, borderColor: Colors.dark.border },
  statValue: { color: Colors.dark.text, fontWeight: '700', fontSize: 15 },
  statLabel: { color: Colors.dark.textMuted, fontSize: 11 },
  sectionTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: '700' },
  instrumentList: { gap: 10 },
  instrumentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  instrumentLabel: { color: Colors.dark.textMuted, fontSize: 12, width: 130 },
  barTrack: { flex: 1, height: 8, backgroundColor: Colors.dark.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: Colors.dark.primary, borderRadius: 4 },
  instrumentPct: { color: Colors.dark.text, fontSize: 12, width: 36, textAlign: 'right' },
  downloadButton: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark.primary, borderRadius: 12, paddingVertical: 14 },
  downloadButtonText: { color: '#fff', fontWeight: '700' },
  tutorialBox: { backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.dark.border },
  tutorialText: { color: Colors.dark.text, fontSize: 13, lineHeight: 20 },
});
