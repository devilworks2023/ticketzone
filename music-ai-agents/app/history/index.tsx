import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { AudioWaveform, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function HistoryScreen() {
  const analyses = trpc.tracks.history.useQuery();
  const recommendations = trpc.tracks.recommendationHistory.useQuery();

  if (analyses.isLoading || recommendations.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.dark.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Análisis recientes</Text>
      {(analyses.data ?? []).length === 0 && <Text style={styles.emptyText}>Aún no has analizado ningún track.</Text>}
      {(analyses.data ?? []).map((a) => (
        <TouchableOpacity key={a.id} style={styles.row} onPress={() => router.push(`/analyzer/${a.id}`)}>
          <AudioWaveform color={Colors.dark.primary} size={18} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{a.fileName ?? a.sourceUrl ?? a.id}</Text>
            <Text style={styles.rowMeta}>{a.bpm} BPM · {a.key.name}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>Recomendaciones recientes</Text>
      {(recommendations.data ?? []).length === 0 && <Text style={styles.emptyText}>Aún no has buscado recomendaciones.</Text>}
      {(recommendations.data ?? []).map((r) => (
        <TouchableOpacity key={r.id} style={styles.row} onPress={() => router.push(`/recommender/${r.id}`)}>
          <Sparkles color={Colors.dark.accent} size={18} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{r.seed.title}</Text>
            <Text style={styles.rowMeta}>{r.seed.artist} · {r.similarTracks.length} sugerencias</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, gap: 12, paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark.background },
  sectionTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptyText: { color: Colors.dark.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.dark.border },
  rowText: { flex: 1 },
  rowTitle: { color: Colors.dark.text, fontWeight: '600', fontSize: 13 },
  rowMeta: { color: Colors.dark.textMuted, fontSize: 11, marginTop: 2 },
});
