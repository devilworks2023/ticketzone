import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, Mail, Phone, FileText, Percent, Save } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function CreatePromoterScreen() {
  const router = useRouter();
  const createPromoterMutation = trpc.promoters.create.useMutation();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    companyName: '',
    taxId: '',
    commissionPercentage: '5',
  });

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return false;
    }
    if (!formData.email.trim()) {
      Alert.alert('Error', 'El email es obligatorio');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      Alert.alert('Error', 'El email no es válido');
      return false;
    }
    const commission = parseFloat(formData.commissionPercentage);
    if (isNaN(commission) || commission < 0 || commission > 100) {
      Alert.alert('Error', 'La comisión debe estar entre 0 y 100');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      await createPromoterMutation.mutateAsync({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || undefined,
        companyName: formData.companyName.trim() || undefined,
        taxId: formData.taxId.trim() || undefined,
        commissionPercentage: parseFloat(formData.commissionPercentage),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '¡Promotor creado!',
        `${formData.name} ha sido añadido como promotor. Puede conectar su cuenta de Stripe para recibir pagos.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.log('Error creating promoter:', error);
      Alert.alert('Error', error.message || 'No se pudo crear el promotor');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen 
        options={{ 
          headerTitle: 'Nuevo Promotor',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }} 
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información personal</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Building2 color={Colors.dark.textMuted} size={16} />
              <Text style={styles.label}>Nombre completo *</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Nombre del promotor"
              placeholderTextColor={Colors.dark.textMuted}
              value={formData.name}
              onChangeText={(v) => updateField('name', v)}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Mail color={Colors.dark.textMuted} size={16} />
              <Text style={styles.label}>Email *</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="email@ejemplo.com"
              placeholderTextColor={Colors.dark.textMuted}
              value={formData.email}
              onChangeText={(v) => updateField('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Phone color={Colors.dark.textMuted} size={16} />
              <Text style={styles.label}>Teléfono</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="+34 612 345 678"
              placeholderTextColor={Colors.dark.textMuted}
              value={formData.phone}
              onChangeText={(v) => updateField('phone', v)}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de empresa</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Building2 color={Colors.dark.textMuted} size={16} />
              <Text style={styles.label}>Nombre de empresa</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Nombre comercial"
              placeholderTextColor={Colors.dark.textMuted}
              value={formData.companyName}
              onChangeText={(v) => updateField('companyName', v)}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <FileText color={Colors.dark.textMuted} size={16} />
              <Text style={styles.label}>CIF/NIF</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="B12345678"
              placeholderTextColor={Colors.dark.textMuted}
              value={formData.taxId}
              onChangeText={(v) => updateField('taxId', v.toUpperCase())}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Percent color={Colors.dark.textMuted} size={16} />
              <Text style={styles.label}>Comisión de plataforma (%)</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="5"
              placeholderTextColor={Colors.dark.textMuted}
              value={formData.commissionPercentage}
              onChangeText={(v) => updateField('commissionPercentage', v)}
              keyboardType="decimal-pad"
            />
            <Text style={styles.inputHint}>
              Porcentaje que la plataforma retiene de cada venta
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Sobre los pagos</Text>
          <Text style={styles.infoText}>
            Una vez creado, el promotor podrá conectar su cuenta de Stripe para recibir los pagos de sus eventos directamente.
            {'\n\n'}
            La comisión configurada se aplicará a todas las ventas de entradas de sus eventos.
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, createPromoterMutation.isPending && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={createPromoterMutation.isPending}
        >
          <LinearGradient
            colors={createPromoterMutation.isPending ? [Colors.dark.textMuted, Colors.dark.textMuted] : Colors.dark.gradient.primary as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGradient}
          >
            {createPromoterMutation.isPending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Save color="#FFF" size={20} />
            )}
            <Text style={styles.submitText}>
              {createPromoterMutation.isPending ? 'Guardando...' : 'Crear promotor'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
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
  inputHint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 8,
  },
  infoCard: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.dark.secondary,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.dark.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  submitButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  submitText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
});
