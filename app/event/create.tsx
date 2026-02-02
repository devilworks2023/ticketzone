import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Plus, Trash2, Crown, Bus, Image as ImageIcon, Gift, X, Upload } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/contexts/AppContext';
import Colors from '@/constants/colors';
import { TicketTier, TicketExtra } from '@/types';

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
  const [eventImages, setEventImages] = useState<string[]>([defaultImages[0]]);
  const [isUploading, setIsUploading] = useState(false);
  const [ticketTiers, setTicketTiers] = useState<Omit<TicketTier, 'id' | 'sold'>[]>([
    { name: 'General', price: 20, quantity: 100, description: 'Entrada general', isVip: false, includesBus: false, extras: [] },
  ]);

  const addTier = () => {
    setTicketTiers([
      ...ticketTiers,
      { name: '', price: 0, quantity: 50, description: '', isVip: false, includesBus: false, extras: [] },
    ]);
  };

  const addExtra = (tierIndex: number) => {
    const updated = [...ticketTiers];
    const extras = updated[tierIndex].extras || [];
    updated[tierIndex].extras = [
      ...extras,
      { id: `extra-${Date.now()}`, name: '', price: 0, description: '' },
    ];
    setTicketTiers(updated);
  };

  const updateExtra = (tierIndex: number, extraIndex: number, updates: Partial<TicketExtra>) => {
    const updated = [...ticketTiers];
    const extras = updated[tierIndex].extras || [];
    extras[extraIndex] = { ...extras[extraIndex], ...updates };
    updated[tierIndex].extras = extras;
    setTicketTiers(updated);
  };

  const removeExtra = (tierIndex: number, extraIndex: number) => {
    const updated = [...ticketTiers];
    const extras = updated[tierIndex].extras || [];
    updated[tierIndex].extras = extras.filter((_, i) => i !== extraIndex);
    setTicketTiers(updated);
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

  const pickImage = async () => {
    if (eventImages.length >= 4) {
      Alert.alert('Límite alcanzado', 'Solo puedes subir hasta 4 fotos');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setEventImages([...eventImages, result.assets[0].uri]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.log('Image picker error:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const removeImage = (index: number) => {
    if (eventImages.length === 1) {
      Alert.alert('Error', 'El evento debe tener al menos una imagen');
      return;
    }
    setEventImages(eventImages.filter((_, i) => i !== index));
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
        image: eventImages[0],
        images: eventImages,
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Imágenes del Evento</Text>
          <Text style={styles.imageCount}>{eventImages.length}/4</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {eventImages.map((img, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image source={{ uri: img }} style={styles.eventImage} />
              {eventImages.length > 1 && (
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeImage(index)}
                >
                  <X color="#FFF" size={16} />
                </TouchableOpacity>
              )}
              <View style={styles.imageIndexBadge}>
                <Text style={styles.imageIndexText}>{index + 1}</Text>
              </View>
            </View>
          ))}
          {eventImages.length < 4 && (
            <TouchableOpacity
              style={styles.addImageButton}
              onPress={pickImage}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color={Colors.dark.primary} />
              ) : (
                <>
                  <Upload color={Colors.dark.primary} size={28} />
                  <Text style={styles.addImageText}>Subir foto</Text>
                </>
              )}
            </TouchableOpacity>
          )}
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

            <View style={styles.extrasSection}>
              <View style={styles.extrasHeader}>
                <Text style={styles.extrasTitle}>Extras opcionales</Text>
                <TouchableOpacity style={styles.addExtraButton} onPress={() => addExtra(index)}>
                  <Plus color={Colors.dark.secondary} size={14} />
                  <Text style={styles.addExtraText}>Añadir</Text>
                </TouchableOpacity>
              </View>
              
              {(tier.extras || []).map((extra, extraIndex) => (
                <View key={extra.id || extraIndex} style={styles.extraCard}>
                  <View style={styles.extraHeader}>
                    <Gift color={Colors.dark.secondary} size={14} />
                    <Text style={styles.extraLabel}>Extra {extraIndex + 1}</Text>
                    <TouchableOpacity onPress={() => removeExtra(index, extraIndex)}>
                      <X color={Colors.dark.error} size={16} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.extraInputs}>
                    <TextInput
                      style={[styles.input, styles.extraInput]}
                      placeholder="Nombre (ej: Consumición)"
                      placeholderTextColor={Colors.dark.textMuted}
                      value={extra.name}
                      onChangeText={(text) => updateExtra(index, extraIndex, { name: text })}
                    />
                    <TextInput
                      style={[styles.input, styles.extraPriceInput]}
                      placeholder="€"
                      placeholderTextColor={Colors.dark.textMuted}
                      value={extra.price > 0 ? extra.price.toString() : ''}
                      onChangeText={(text) => updateExtra(index, extraIndex, { price: parseFloat(text) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              ))}
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
    paddingRight: 20,
  },
  imageContainer: {
    width: 140,
    height: 100,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  eventImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.dark.border,
  },
  removeImageButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.dark.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageIndexBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageIndexText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  addImageButton: {
    width: 140,
    height: 100,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addImageText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  imageCount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textMuted,
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
  extrasSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  extrasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  extrasTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  addExtraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addExtraText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.secondary,
  },
  extraCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  extraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  extraLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.secondary,
  },
  extraInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  extraInput: {
    flex: 1,
    padding: 10,
    fontSize: 14,
  },
  extraPriceInput: {
    width: 70,
    padding: 10,
    fontSize: 14,
    textAlign: 'center',
  },
});
