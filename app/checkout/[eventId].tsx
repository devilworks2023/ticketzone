import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, CheckCircle, AlertCircle, ChevronLeft, CreditCard } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';
import { useStripe } from '@/lib/stripe-native';

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
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  
  const [step, setStep] = useState<'loading' | 'ready' | 'processing' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [purchasedTickets, setPurchasedTickets] = useState<any[]>([]);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

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

  const createPaymentIntent = trpc.payments.createPaymentIntent.useMutation();
  const confirmPayment = trpc.payments.confirmPayment.useMutation();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  useEffect(() => {
    initializePayment();
  }, []);

  const initializePayment = async () => {
    try {
      console.log('Initializing payment with data:', paymentData);
      
      const result = await createPaymentIntent.mutateAsync({
        eventId: paymentData.eventId,
        tierId: paymentData.tierId,
        quantity: paymentData.quantity,
        buyerName: paymentData.buyerName,
        buyerEmail: paymentData.buyerEmail,
        buyerPhone: paymentData.buyerPhone,
        sellerCode: paymentData.sellerCode,
      });

      console.log('Payment intent created:', result.paymentIntentId);
      setPaymentIntentId(result.paymentIntentId);

      if (Platform.OS !== 'web') {
        if (!result.clientSecret) {
          console.error('No client secret received');
          setErrorMessage('Error al preparar el pago');
          setStep('error');
          return;
        }

        const { error } = await initPaymentSheet({
          paymentIntentClientSecret: result.clientSecret,
          merchantDisplayName: 'TicketZone',
          applePay: {
            merchantCountryCode: 'ES',
          },
          googlePay: {
            merchantCountryCode: 'ES',
            testEnv: false,
          },
          allowsDelayedPaymentMethods: false,
          defaultBillingDetails: {
            name: paymentData.buyerName,
            email: paymentData.buyerEmail,
          },
        });

        if (error) {
          console.error('Error initializing payment sheet:', error);
          setErrorMessage(error.message);
          setStep('error');
          return;
        }
      }

      setStep('ready');
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      setErrorMessage(error.message || 'Error al preparar el pago');
      setStep('error');
    }
  };

  const handlePayment = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Info', 'Para realizar pagos con tarjeta, por favor usa la app móvil.');
      return;
    }

    setStep('processing');

    try {
      const { error } = await presentPaymentSheet();

      if (error) {
        console.error('Payment sheet error:', error);
        if (error.code === 'Canceled') {
          setStep('ready');
          return;
        }
        setErrorMessage(error.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setStep('error');
        return;
      }

      console.log('Payment successful, confirming...');

      const result = await confirmPayment.mutateAsync({
        paymentIntentId: paymentIntentId!,
        eventId: paymentData.eventId,
        tierId: paymentData.tierId,
        quantity: paymentData.quantity,
        buyerName: paymentData.buyerName,
        buyerEmail: paymentData.buyerEmail,
        buyerPhone: paymentData.buyerPhone,
        sellerCode: paymentData.sellerCode,
      });

      console.log('Tickets created:', result.tickets);
      setPurchasedTickets(result.tickets);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
    } catch (error: any) {
      console.error('Payment confirmation error:', error);
      setErrorMessage(error.message || 'Error al procesar el pago');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStep('error');
    }
  };

  if (step === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
          <Text style={styles.processingTitle}>Preparando pago...</Text>
          <Text style={styles.processingText}>Conectando con Stripe</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.secureText}>Pago seguro con Stripe</Text>
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
            {purchasedTickets.length > 0 && (
              <View style={styles.successDetailRow}>
                <Text style={styles.successDetailLabel}>Códigos QR</Text>
                <Text style={styles.successDetailValue}>{purchasedTickets.length} generados</Text>
              </View>
            )}
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
          <Text style={styles.errorTitle}>Error en el pago</Text>
          <Text style={styles.errorText}>
            {errorMessage || 'No se pudo procesar el pago. Por favor, inténtalo de nuevo.'}
          </Text>
          
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setStep('loading');
              setErrorMessage('');
              initializePayment();
            }}
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

        <View style={styles.buyerInfo}>
          <Text style={styles.sectionTitle}>Datos del comprador</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nombre</Text>
              <Text style={styles.infoValue}>{paymentData.buyerName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{paymentData.buyerEmail}</Text>
            </View>
            {paymentData.buyerPhone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Teléfono</Text>
                <Text style={styles.infoValue}>{paymentData.buyerPhone}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.paymentMethod}>
          <Text style={styles.sectionTitle}>Método de pago</Text>
          <View style={styles.methodCard}>
            <CreditCard color={Colors.dark.primary} size={24} />
            <View style={styles.methodInfo}>
              <Text style={styles.methodTitle}>Tarjeta de crédito/débito</Text>
              <Text style={styles.methodDesc}>Pago seguro con Stripe</Text>
            </View>
          </View>
        </View>

        <View style={styles.securityInfo}>
          <Lock color={Colors.dark.success} size={16} />
          <Text style={styles.securityText}>
            Tu pago está protegido con la seguridad de Stripe
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.payButton}
          onPress={handlePayment}
          disabled={createPaymentIntent.isPending || confirmPayment.isPending}
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
  buyerInfo: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
  paymentMethod: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  methodDesc: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
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
