import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ExternalLink } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function RecommenderResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = trpc.tracks.getRecommendationById.useQuery({ id: id! }, { enabled: !!id });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.dark.primary} size="large" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No se encontraron recomendaciones.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.seedCard}>
        <Text style={styles.seedTitle}>{data.seed.title}</Text>
        <Text style={styles.seedArtist}>{data.seed.artist}</Text>
        {data.seed.genre && <Text style={styles.seedMeta}>Género: {data.seed.genre}</Text>}
        <Text style={styles.seedMeta}>Plataforma detectada: {data.seed.platform}</Text>
        {data.seed.confidence === 'low' && (
          <Text style={styles.lowConfidenceNote}>
            No se pudo confirmar toda la metadata del enlace; los datos mostrados son aproximados.
          </Text>
        )}
      </View>

      {data.similarArtists.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Artistas similares</Text>
          <View style={styles.chipsWrap}>
            {data.similarArtists.map((a) => (
              <View key={a.name} style={styles.chip}>
                <Text style={styles.chipText}>{a.name}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>Tracks similares</Text>
      {data.similarTracks.length === 0 && (
        <Text style={styles.emptyText}>No se encontraron coincidencias suficientes para este enlace.</Text>
      )}
      <View style={styles.trackList}>
        {data.similarTracks.map((t, idx) => (
          <View key={`${t.title}-${idx}`} style={styles.trackCard}>
            <View style={styles.trackInfo}>
              <Text style={styles.trackTitle}>{t.title}</Text>
              <Text style={styles.trackArtist}>{t.artist}</Text>
              <Text style={styles.trackReason}>{t.matchReason}</Text>
            </View>
            <View style={styles.linksRow}>
              <LinkButton label="Beatport" url={t.searchLinks.beatport} />
              <LinkButton label="Bandcamp" url={t.searchLinks.bandcamp} />
              <LinkButton label="Juno" url={t.searchLinks.juno} />
              <LinkButton label="Spotify" url={t.searchLinks.spotify} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function LinkButton({ label, url }: { label: string; url: string }) {
  return (
    <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL(url)} testID={`link-${label}`}>
      <ExternalLink color={Colors.dark.accent} size={12} />
      <Text style={styles.linkButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, gap: 20, paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark.background, padding: 20 },
  errorText: { color: Colors.dark.error, fontSize: 15 },
  seedCard: { backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 16, gap: 4, borderWidth: 1, borderColor: Colors.dark.border },
  seedTitle: { color: Colors.dark.text, fontSize: 17, fontWeight: '700' },
  seedArtist: { color: Colors.dark.textMuted, fontSize: 14 },
  seedMeta: { color: Colors.dark.textMuted, fontSize: 12 },
  lowConfidenceNote: { color: Colors.dark.warning, fontSize: 11, marginTop: 6 },
  sectionTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: '700' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: Colors.dark.surfaceAlt, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: Colors.dark.text, fontSize: 12 },
  emptyText: { color: Colors.dark.textMuted, fontSize: 13 },
  trackList: { gap: 12 },
  trackCard: { backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: Colors.dark.border },
  trackInfo: { gap: 2 },
  trackTitle: { color: Colors.dark.text, fontWeight: '700', fontSize: 14 },
  trackArtist: { color: Colors.dark.textMuted, fontSize: 12 },
  trackReason: { color: Colors.dark.success, fontSize: 11, marginTop: 4 },
  linksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkButton: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: Colors.dark.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  linkButtonText: { color: Colors.dark.text, fontSize: 11, fontWeight: '600' },
});
