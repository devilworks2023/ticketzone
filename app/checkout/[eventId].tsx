import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CreditCard, Lock, CheckCircle, AlertCircle, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

interface PaymentData {
  eventId: string;
  eventName: string;
  tierId: string;
  tierName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  sellerCode?: string;
}

export default function CheckoutScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const [step, setStep] = useState<'card' | 'processing' | 'success' | 'error'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const paymentData: PaymentData = {
    eventId: params.eventId as string,
    eventName: params.eventName as string || 'Evento',
    tierId: params.tierId as string,
    tierName: params.tierName as string || 'Entrada',
    quantity: parseInt(params.quantity as string) || 1,
    unitPrice: parseFloat(params.unitPrice as string) || 0,
    totalAmount: parseFloat(params.totalAmount as string) || 0,
    buyerName: params.buyerName as string || '',
    buyerEmail: params.buyerEmail as string || '',
    buyerPhone: params.buyerPhone as string,
    sellerCode: params.sellerCode as string,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const chunks = cleaned.match(/.{1,4}/g);
    return chunks ? chunks.join(' ').substring(0, 19) : '';
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`;
    }
    return cleaned;
  };

  const validateCard = () => {
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    if (cleanCardNumber.length < 16) {
      Alert.alert('Error', 'Número de tarjeta inválido');
      return false;
    }
    if (expiry.length < 5) {
      Alert.alert('Error', 'Fecha de expiración inválida');
      return false;
    }
    if (cvc.length < 3) {
      Alert.alert('Error', 'CVC inválido');
      return false;
    }
    if (!cardName.trim()) {
      Alert.alert('Error', 'Nombre del titular requerido');
      return false;
    }
    return true;
  };

  const handlePayment = async () => {
    if (!validateCard()) return;

    setIsProcessing(true);
    setStep('processing');

    try {
      await new Promise(resolve => setTimeout(resolve, 2500));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
    } catch (error) {
      console.log('Payment error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === 'processing') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
          <Text style={styles.processingTitle}>Procesando pago...</Text>
          <Text style={styles.processingText}>No cierres esta pantalla</Text>
          <View style={styles.secureNote}>
            <Lock color={Colors.dark.success} size={16} />
            <Text style={styles.secureText}>Conexión segura con encriptación SSL</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.successContainer}>
          <View style={styles.successIconWrapper}>
            <LinearGradient
              colors={[Colors.dark.success, '#10B981']}
              style={styles.successIconBg}
            >
              <CheckCircle color="#FFF" size={60} />
            </LinearGradient>
          </View>
          <Text style={styles.successTitle}>¡Pago completado!</Text>
          <Text style={styles.successAmount}>{formatCurrency(paymentData.totalAmount)}</Text>
          <Text style={styles.successText}>
            Hemos enviado {paymentData.quantity} entrada(s) para {paymentData.eventName} al email {paymentData.buyerEmail}
          </Text>
          
          <View style={styles.successDetails}>
            <View style={styles.successDetailRow}>
              <Text style={styles.successDetailLabel}>Evento</Text>
              <Text style={styles.successDetailValue}>{paymentData.eventName}</Text>
            </View>
            <View style={styles.successDetailRow}>
              <Text style={styles.successDetailLabel}>Entradas</Text>
              <Text style={styles.successDetailValue}>{paymentData.quantity}x {paymentData.tierName}</Text>
            </View>
            <View style={styles.successDetailRow}>
              <Text style={styles.successDetailLabel}>Comprador</Text>
              <Text style={styles.successDetailValue}>{paymentData.buyerName}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.successButton}
            onPress={() => router.replace('/')}
          >
            <LinearGradient
              colors={Colors.dark.gradient.primary as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.successButtonGradient}
            >
              <Text style={styles.successButtonText}>Volver al inicio</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'error') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrapper}>
            <AlertCircle color={Colors.dark.error} size={60} />
          </View>
          <Text style={styles.errorTitle}>Pago fallido</Text>
          <Text style={styles.errorText}>
            No se pudo procesar el pago. Por favor, verifica los datos de tu tarjeta e inténtalo de nuevo.
          </Text>
          
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => setStep('card')}
          >
            <Text style={styles.retryButtonText}>Intentar de nuevo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft color={Colors.dark.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pago seguro</Text>
        <Lock color={Colors.dark.success} size={20} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.orderSummary}>
          <Text style={styles.summaryTitle}>Resumen del pedido</Text>
          <View style={styles.summaryCard}>
            <Text style={styles.eventName}>{paymentData.eventName}</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{paymentData.quantity}x {paymentData.tierName}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(paymentData.unitPrice)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(paymentData.totalAmount)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Datos de la tarjeta</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Número de tarjeta</Text>
            <View style={styles.cardInputWrapper}>
              <CreditCard color={Colors.dark.textMuted} size={20} />
              <TextInput
                style={styles.cardInput}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={Colors.dark.textMuted}
                value={cardNumber}
                onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                keyboardType="numeric"
                maxLength={19}
              />
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Expiración</Text>
              <TextInput
                style={styles.input}
                placeholder="MM/YY"
                placeholderTextColor={Colors.dark.textMuted}
                value={expiry}
                onChangeText={(text) => setExpiry(formatExpiry(text))}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>CVC</Text>
              <TextInput
                style={styles.input}
                placeholder="123"
                placeholderTextColor={Colors.dark.textMuted}
                value={cvc}
                onChangeText={setCvc}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre del titular</Text>
            <TextInput
              style={styles.input}
              placeholder="Como aparece en la tarjeta"
              placeholderTextColor={Colors.dark.textMuted}
              value={cardName}
              onChangeText={setCardName}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={styles.securityInfo}>
          <Lock color={Colors.dark.success} size={16} />
          <Text style={styles.securityText}>
            Tu pago está protegido con encriptación SSL de 256 bits
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.payButton}
          onPress={handlePayment}
          disabled={isProcessing}
        >
          <LinearGradient
            colors={Colors.dark.gradient.primary as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.payButtonGradient}
          >
            <Lock color="#FFF" size={18} />
            <Text style={styles.payButtonText}>
              Pagar {formatCurrency(paymentData.totalAmount)}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  orderSummary: {
    padding: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
  },
  eventName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.primary,
  },
  cardSection: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
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
  cardInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  cardInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.dark.text,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  securityText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
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
  payButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  payButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  processingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.dark.text,
    marginTop: 16,
  },
  processingText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
  },
  secureText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  successIconWrapper: {
    marginBottom: 24,
  },
  successIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  successAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.dark.success,
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  successDetails: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 32,
  },
  successDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  successDetailLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  successDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  successButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  successButtonGradient: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  successButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  errorIconWrapper: {
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryButton: {
    width: '100%',
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  retryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
});
