import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Plus, Trash2, Crown, Bus, Image as ImageIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/contexts/AppContext';
import Colors from '@/constants/colors';
import { TicketTier } from '@/types';

const defaultImages = [
  'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800',
  'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800',
];

export default function CreateEventScreen() {
  const router = useRouter();
  const { addEvent } = useApp();
  
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState(defaultImages[0]);
  const [ticketTiers, setTicketTiers] = useState<Omit<TicketTier, 'id' | 'sold'>[]>([
    { name: 'General', price: 20, quantity: 100, description: 'Entrada general', isVip: false, includesBus: false },
  ]);

  const addTier = () => {
    setTicketTiers([
      ...ticketTiers,
      { name: '', price: 0, quantity: 50, description: '', isVip: false, includesBus: false },
    ]);
  };

  const updateTier = (index: number, updates: Partial<typeof ticketTiers[0]>) => {
    const updated = [...ticketTiers];
    updated[index] = { ...updated[index], ...updates };
    setTicketTiers(updated);
  };

  const removeTier = (index: number) => {
    if (ticketTiers.length === 1) {
      Alert.alert('Error', 'Debe haber al menos un tipo de entrada');
      return;
    }
    setTicketTiers(ticketTiers.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor introduce el nombre del evento');
      return;
    }
    if (!date.trim()) {
      Alert.alert('Error', 'Por favor introduce la fecha del evento (YYYY-MM-DD)');
      return;
    }
    if (!time.trim()) {
      Alert.alert('Error', 'Por favor introduce la hora del evento');
      return;
    }
    if (!venue.trim()) {
      Alert.alert('Error', 'Por favor introduce el lugar del evento');
      return;
    }

    const invalidTier = ticketTiers.find(t => !t.name.trim() || t.price <= 0 || t.quantity <= 0);
    if (invalidTier) {
      Alert.alert('Error', 'Por favor completa correctamente todos los tipos de entrada');
      return;
    }

    try {
      await addEvent({
        name: name.trim(),
        date: date.trim(),
        time: time.trim(),
        venue: venue.trim(),
        location: location.trim() || venue.trim(),
        description: description.trim(),
        image: selectedImage,
        ticketTiers: ticketTiers.map((t, i) => ({
          ...t,
          id: `tier-${i}`,
          sold: 0,
        })),
        isActive: true,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.log('Error creating event:', error);
      Alert.alert('Error', 'No se pudo crear el evento');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen 
        options={{ 
          headerRight: () => (
            <TouchableOpacity onPress={handleCreate}>
              <Text style={styles.saveButton}>Crear</Text>
            </TouchableOpacity>
          ),
        }} 
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Imagen del Evento</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {defaultImages.map((img, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.imageOption, selectedImage === img && styles.imageSelected]}
              onPress={() => setSelectedImage(img)}
            >
              <View style={styles.imagePreview}>
                <ImageIcon color={Colors.dark.textMuted} size={24} />
                <Text style={styles.imageNumber}>{index + 1}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Información del Evento</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre del evento *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: NEON NIGHTS"
            placeholderTextColor={Colors.dark.textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Fecha *</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-02-14"
              placeholderTextColor={Colors.dark.textMuted}
              value={date}
              onChangeText={setDate}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Hora *</Text>
            <TextInput
              style={styles.input}
              placeholder="23:00"
              placeholderTextColor={Colors.dark.textMuted}
              value={time}
              onChangeText={setTime}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Lugar *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Warehouse Club"
            placeholderTextColor={Colors.dark.textMuted}
            value={venue}
            onChangeText={setVenue}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ciudad</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Barcelona, España"
            placeholderTextColor={Colors.dark.textMuted}
            value={location}
            onChangeText={setLocation}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe tu evento..."
            placeholderTextColor={Colors.dark.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tipos de Entrada</Text>
          <TouchableOpacity style={styles.addTierButton} onPress={addTier}>
            <Plus color={Colors.dark.primary} size={18} />
            <Text style={styles.addTierText}>Añadir</Text>
          </TouchableOpacity>
        </View>

        {ticketTiers.map((tier, index) => (
          <View key={index} style={styles.tierCard}>
            <View style={styles.tierHeader}>
              <Text style={styles.tierIndex}>Tipo {index + 1}</Text>
              <TouchableOpacity onPress={() => removeTier(index)}>
                <Trash2 color={Colors.dark.error} size={18} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Nombre (Ej: VIP, General)"
              placeholderTextColor={Colors.dark.textMuted}
              value={tier.name}
              onChangeText={(text) => updateTier(index, { name: text })}
            />

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginTop: 0 }]}>
                <Text style={styles.miniLabel}>Precio (€)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="25"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={tier.price.toString()}
                  onChangeText={(text) => updateTier(index, { price: parseFloat(text) || 0 })}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginTop: 0 }]}>
                <Text style={styles.miniLabel}>Cantidad</Text>
                <TextInput
                  style={styles.input}
                  placeholder="100"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={tier.quantity.toString()}
                  onChangeText={(text) => updateTier(index, { quantity: parseInt(text) || 0 })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Descripción del tipo de entrada"
              placeholderTextColor={Colors.dark.textMuted}
              value={tier.description}
              onChangeText={(text) => updateTier(index, { description: text })}
            />

            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[styles.optionButton, tier.isVip && styles.optionActive]}
                onPress={() => updateTier(index, { isVip: !tier.isVip })}
              >
                <Crown color={tier.isVip ? Colors.dark.warning : Colors.dark.textMuted} size={16} />
                <Text style={[styles.optionText, tier.isVip && styles.optionTextActive]}>VIP</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionButton, tier.includesBus && styles.optionActive]}
                onPress={() => updateTier(index, { includesBus: !tier.includesBus })}
              >
                <Bus color={tier.includesBus ? Colors.dark.secondary : Colors.dark.textMuted} size={16} />
                <Text style={[styles.optionText, tier.includesBus && styles.optionTextActive]}>+ Bus</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    padding: 20,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 14,
    marginTop: 8,
  },
  imageScroll: {
    marginBottom: 24,
  },
  imageOption: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  imageSelected: {
    borderColor: Colors.dark.primary,
  },
  imagePreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageNumber: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  miniLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  addTierButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addTierText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  tierCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierIndex: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  optionActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + '15',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  optionTextActive: {
    color: Colors.dark.text,
  },
});
