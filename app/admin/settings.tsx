import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Settings,
  Save,
  CreditCard,
  Globe,
  Percent,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function AdminSettingsScreen() {
  const [platformName, setPlatformName] = useState('TicketZone');
  const [currency, setCurrency] = useState('EUR');
  const [stripeEnabled, setStripeEnabled] = useState(true);
  const [platformCommission, setPlatformCommission] = useState('5');
  const [earlyWithdrawalFee, setEarlyWithdrawalFee] = useState('2');
  const [isSaving, setIsSaving] = useState(false);

  const settingsQuery = trpc.settings.getAll.useQuery();
  const updateSettingsMutation = trpc.settings.setMultiple.useMutation();
  const debugQuery = trpc.settings.debug.useQuery(undefined, { enabled: false });

  useEffect(() => {
    if (settingsQuery.data) {
      console.log('[SETTINGS] Datos recibidos:', settingsQuery.data);
      setPlatformName(settingsQuery.data.platform_name || 'TicketZone');
      setCurrency(settingsQuery.data.currency || 'EUR');
      setStripeEnabled(settingsQuery.data.stripe_enabled !== 'false');
      setPlatformCommission(settingsQuery.data.platform_commission || '5');
      setEarlyWithdrawalFee(settingsQuery.data.early_withdrawal_fee || '2');
    }
    if (settingsQuery.error) {
      console.error('[SETTINGS] Error cargando configuración:', settingsQuery.error);
    }
  }, [settingsQuery.data, settingsQuery.error]);

  const handleSave = async () => {
    if (parseFloat(platformCommission) < 0 || parseFloat(platformCommission) > 100) {
      Alert.alert('Error', 'La comisión debe estar entre 0 y 100');
      return;
    }
    if (parseFloat(earlyWithdrawalFee) < 0 || parseFloat(earlyWithdrawalFee) > 100) {
      Alert.alert('Error', 'La comisión de retiro adelantado debe estar entre 0 y 100');
      return;
    }
    
    setIsSaving(true);
    
    const settingsToSave = {
      platform_name: platformName,
      currency: currency,
      stripe_enabled: stripeEnabled ? 'true' : 'false',
      platform_commission: platformCommission,
      early_withdrawal_fee: earlyWithdrawalFee,
    };
    
    console.log('[SETTINGS] Guardando configuración:', settingsToSave);
    
    try {
      const result = await updateSettingsMutation.mutateAsync(settingsToSave);
      console.log('[SETTINGS] Respuesta del servidor:', JSON.stringify(result));
      
      // Esperar un momento y recargar
      await new Promise(resolve => setTimeout(resolve, 500));
      const refreshed = await settingsQuery.refetch();
      console.log('[SETTINGS] Configuración recargada:', JSON.stringify(refreshed.data));
      
      Alert.alert(
        'Éxito', 
        `Configuración guardada correctamente.\n\nValores guardados:\n- Comisión: ${result.savedValues?.platform_commission || platformCommission}%\n- Retiro adelantado: ${result.savedValues?.early_withdrawal_fee || earlyWithdrawalFee}%`
      );
    } catch (error: any) {
      console.error('[SETTINGS] Error guardando configuración:', error);
      Alert.alert('Error', `No se pudo guardar: ${error.message || 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDebug = async () => {
    try {
      const result = await debugQuery.refetch();
      console.log('[DEBUG] Estado de la base de datos:', JSON.stringify(result.data, null, 2));
      Alert.alert(
        'Debug - Base de Datos',
        `Ruta DB: ${result.data?.dbPath || 'N/A'}\n\nSettings guardados:\n${JSON.stringify(result.data?.settings, null, 2)}\n\nTimestamp: ${result.data?.timestamp}`
      );
    } catch (error: any) {
      Alert.alert('Error Debug', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Configuración General',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {settingsQuery.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Globe color={Colors.dark.primary} size={20} />
                <Text style={styles.sectionTitle}>Información de la Plataforma</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre de la plataforma</Text>
                <TextInput
                  style={styles.input}
                  value={platformName}
                  onChangeText={setPlatformName}
                  placeholder="TicketZone"
                  placeholderTextColor={Colors.dark.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Moneda</Text>
                <View style={styles.currencySelector}>
                  <TouchableOpacity
                    style={[styles.currencyOption, currency === 'EUR' && styles.currencyOptionSelected]}
                    onPress={() => setCurrency('EUR')}
                  >
                    <Text style={[styles.currencyText, currency === 'EUR' && styles.currencyTextSelected]}>
                      EUR (€)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.currencyOption, currency === 'USD' && styles.currencyOptionSelected]}
                    onPress={() => setCurrency('USD')}
                  >
                    <Text style={[styles.currencyText, currency === 'USD' && styles.currencyTextSelected]}>
                      USD ($)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.currencyOption, currency === 'GBP' && styles.currencyOptionSelected]}
                    onPress={() => setCurrency('GBP')}
                  >
                    <Text style={[styles.currencyText, currency === 'GBP' && styles.currencyTextSelected]}>
                      GBP (£)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <CreditCard color={Colors.dark.secondary} size={20} />
                <Text style={styles.sectionTitle}>Pagos</Text>
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>Stripe habilitado</Text>
                  <Text style={styles.toggleDescription}>
                    Permite pagos con tarjeta a través de Stripe
                  </Text>
                </View>
                <Switch
                  value={stripeEnabled}
                  onValueChange={setStripeEnabled}
                  trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
                  thumbColor="#FFF"
                />
              </View>

              </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Percent color={Colors.dark.secondary} size={20} />
                <Text style={styles.sectionTitle}>Comisiones</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Comisión de la plataforma (%)</Text>
                <TextInput
                  style={styles.input}
                  value={platformCommission}
                  onChangeText={setPlatformCommission}
                  placeholder="5"
                  placeholderTextColor={Colors.dark.textMuted}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.inputHint}>
                  Porcentaje que cobra la plataforma por cada venta de entrada
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Comisión de retiro adelantado (%)</Text>
                <TextInput
                  style={styles.input}
                  value={earlyWithdrawalFee}
                  onChangeText={setEarlyWithdrawalFee}
                  placeholder="2"
                  placeholderTextColor={Colors.dark.textMuted}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.inputHint}>
                  Porcentaje que se cobra a los promotores por retirar dinero antes de que finalice el evento
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Settings color={Colors.dark.textMuted} size={20} />
                <Text style={styles.sectionTitle}>Información del Sistema</Text>
              </View>

              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Versión</Text>
                  <Text style={styles.infoValue}>1.0.0</Text>
                </View>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Base de datos</Text>
                  <Text style={styles.infoValue}>SQLite</Text>
                </View>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Servidor</Text>
                  <Text style={styles.infoValue}>Hono + tRPC</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.debugButton}
                onPress={handleDebug}
              >
                <Text style={styles.debugButtonText}>Verificar Estado DB</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Save color="#FFF" size={20} />
                  <Text style={styles.saveButtonText}>Guardar Configuración</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.bottomPadding} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollView: {
    flex: 1,
  },
  loading: {
    padding: 60,
    alignItems: 'center',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.dark.text,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },
  currencySelector: {
    flexDirection: 'row',
    gap: 10,
  },
  currencyOption: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: 14,
  },
  currencyOptionSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + '15',
  },
  currencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  currencyTextSelected: {
    color: Colors.dark.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  infoBox: {
    backgroundColor: Colors.dark.primary + '15',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.primary,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.primary,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  bottomPadding: {
    height: 40,
  },
  debugButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  debugButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
});
