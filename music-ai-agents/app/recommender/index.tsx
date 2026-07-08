import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { Link2, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function RecommenderScreen() {
  const [link, setLink] = useState('');

  const recommend = trpc.tracks.recommend.useMutation({
    onSuccess: (result) => router.push(`/recommender/${result.id}`),
    onError: (err) => Alert.alert('Error al buscar recomendaciones', err.message),
  });

  const submit = () => {
    if (!link.trim()) {
      Alert.alert('Falta un enlace', 'Pega el enlace de un track de Beatport, Bandcamp, Juno, Spotify o SoundCloud.');
      return;
    }
    recommend.mutate({ url: link.trim() });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Pega el enlace de un track y el agente buscará artistas y canciones afines usando su
        género y artista como semilla (vía iTunes Search y MusicBrainz), con enlaces de búsqueda
        directos en las principales tiendas y plataformas.
      </Text>
      <View style={styles.inputWrap}>
        <Link2 color={Colors.dark.textMuted} size={18} />
        <TextInput
          style={styles.input}
          placeholder="https://bandcamp.com/track/..."
          placeholderTextColor={Colors.dark.textMuted}
          value={link}
          onChangeText={setLink}
          autoCapitalize="none"
          autoCorrect={false}
          testID="recommender-link-input"
        />
      </View>
      <TouchableOpacity
        style={[styles.submitButton, recommend.isPending && styles.submitButtonDisabled]}
        onPress={submit}
        disabled={recommend.isPending}
        testID="recommender-submit-btn"
      >
        {recommend.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Sparkles color="#fff" size={18} />
            <Text style={styles.submitButtonText}>Buscar similares</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background, padding: 20, gap: 16 },
  hint: { color: Colors.dark.textMuted, fontSize: 13, lineHeight: 18 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.dark.surface,
    borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.dark.border,
  },
  input: { flex: 1, color: Colors.dark.text, paddingVertical: 14, fontSize: 14 },
  submitButton: {
    flexDirection: 'row', gap: 8, backgroundColor: Colors.dark.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
