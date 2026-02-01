import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function CreateSellerScreen() {
  const router = useRouter();
  const createSellerMutation = trpc.sellers.create.useMutation();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  const generateCode = () => {
    const generated = name.trim().toUpperCase().replace(/\s+/g, '').substring(0, 6) + 
      Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setCode(generated);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor introduce el nombre del vendedor');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Por favor introduce el email del vendedor');
      return;
    }
    if (!code.trim()) {
      Alert.alert('Error', 'Por favor introduce o genera un código para el vendedor');
      return;
    }

    try {
      await createSellerMutation.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        code: code.trim().toUpperCase(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error: any) {
      console.log('Error creating seller:', error);
      Alert.alert('Error', error.message || 'No se pudo crear el vendedor');
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
            <TouchableOpacity onPress={handleCreate} disabled={createSellerMutation.isPending}>
              {createSellerMutation.isPending ? (
                <ActivityIndicator color={Colors.dark.primary} size="small" />
              ) : (
                <Text style={styles.saveButton}>Crear</Text>
              )}
            </TouchableOpacity>
          ),
        }} 
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Información del Vendedor</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre completo *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Carlos Martínez"
            placeholderTextColor={Colors.dark.textMuted}
            value={name}
            onChangeText={setName}
            onBlur={() => !code && name && generateCode()}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            placeholder="email@ejemplo.com"
            placeholderTextColor={Colors.dark.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={styles.input}
            placeholder="+34 612 345 678"
            placeholderTextColor={Colors.dark.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.codeHeader}>
            <Text style={styles.label}>Código de vendedor *</Text>
            <TouchableOpacity onPress={generateCode}>
              <Text style={styles.generateButton}>Generar</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="CODIGO123"
            placeholderTextColor={Colors.dark.textMuted}
            value={code}
            onChangeText={(text) => setCode(text.toUpperCase())}
            autoCapitalize="characters"
          />
          <Text style={styles.codeHint}>
            Este código se usará para rastrear las ventas del vendedor
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Comisiones por defecto</Text>
          <Text style={styles.infoText}>
            Se aplicarán los tramos de comisión predeterminados. Podrás personalizarlos después desde el perfil del vendedor.
          </Text>
          <View style={styles.defaultTiers}>
            <View style={styles.tierPreview}>
              <Text style={styles.tierRange}>0-10 ventas</Text>
              <Text style={styles.tierPercent}>5%</Text>
            </View>
            <View style={styles.tierPreview}>
              <Text style={styles.tierRange}>11-50 ventas</Text>
              <Text style={styles.tierPercent}>8%</Text>
            </View>
            <View style={styles.tierPreview}>
              <Text style={styles.tierRange}>51-100 ventas</Text>
              <Text style={styles.tierPercent}>10%</Text>
            </View>
            <View style={styles.tierPreview}>
              <Text style={styles.tierRange}>100+ ventas</Text>
              <Text style={styles.tierPercent}>12%</Text>
            </View>
          </View>
        </View>

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
    marginBottom: 20,
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 8,
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
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  generateButton: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  codeInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 18,
    letterSpacing: 2,
    textAlign: 'center',
  },
  codeHint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  defaultTiers: {
    gap: 8,
  },
  tierPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 8,
    padding: 12,
  },
  tierRange: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  tierPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
});
