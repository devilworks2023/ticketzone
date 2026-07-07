import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { AudioWaveform, Sparkles, History, Music4 } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Music4 color={Colors.dark.primary} size={40} />
        <Text style={styles.title}>MusicLab AI</Text>
        <Text style={styles.subtitle}>
          Agentes de IA para analizar tracks, extraer patrones MIDI y descubrir música similar a
          partir de enlaces de Beatport, Bandcamp, Juno, Spotify o SoundCloud.
        </Text>
      </View>

      <TouchableOpacity style={styles.card} onPress={() => router.push('/analyzer')} testID="card-analyzer">
        <View style={[styles.iconWrap, { backgroundColor: Colors.dark.primaryMuted }]}>
          <AudioWaveform color={Colors.dark.primary} size={26} />
        </View>
        <View style={styles.cardTextWrap}>
          <Text style={styles.cardTitle}>Agente Analizador</Text>
          <Text style={styles.cardDescription}>
            Sube un audio (WAV/MP3) o pega el enlace de un track. Detecta tempo, tonalidad e
            instrumentación, y genera un patrón MIDI descargable con una guía para reconstruirlo.
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => router.push('/recommender')} testID="card-recommender">
        <View style={[styles.iconWrap, { backgroundColor: '#0E3A3F' }]}>
          <Sparkles color={Colors.dark.accent} size={26} />
        </View>
        <View style={styles.cardTextWrap}>
          <Text style={styles.cardTitle}>Agente de Recomendaciones</Text>
          <Text style={styles.cardDescription}>
            Pega el enlace de un track y descubre artistas y canciones similares, con enlaces de
            búsqueda directos en Beatport, Bandcamp, Juno y Spotify.
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.historyLink} onPress={() => router.push('/history')} testID="link-history">
        <History color={Colors.dark.textMuted} size={18} />
        <Text style={styles.historyText}>Ver historial</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingBottom: 60, gap: 16 },
  hero: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.dark.text },
  subtitle: { fontSize: 14, color: Colors.dark.textMuted, textAlign: 'center', lineHeight: 20 },
  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTextWrap: { flex: 1, gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.dark.text },
  cardDescription: { fontSize: 13, color: Colors.dark.textMuted, lineHeight: 18 },
  historyLink: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  historyText: { color: Colors.dark.textMuted, fontSize: 14, fontWeight: '600' },
});
