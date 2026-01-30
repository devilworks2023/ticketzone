import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Minus, Plus, CreditCard, Smartphone, Crown, Bus, Check, Tag } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/contexts/AppContext';
import Colors from '@/constants/colors';

type PaymentMethod = 'card' | 'googlepay' | 'applepay';

export default function PurchaseScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { events, addTicket, getSellerByCode } = useApp();
  const event = events.find(e => e.id === eventId);

  const [quantities, setQuantities] = useState<{ [tierId: string]: number }>({});
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [sellerCode, setSellerCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Evento no encontrado</Text>
      </View>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const updateQuantity = (tierId: string, delta: number) => {
    const tier = event.ticketTiers.find(t => t.id === tierId);
    if (!tier) return;

    const current = quantities[tierId] || 0;
    const available = tier.quantity - tier.sold;
    const newQty = Math.max(0, Math.min(available, current + delta));
    
    setQuantities({ ...quantities, [tierId]: newQty });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const totalAmount = event.ticketTiers.reduce((sum, tier) => {
    const qty = quantities[tier.id] || 0;
    return sum + (qty * tier.price);
  }, 0);

  const totalTickets = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);

  const handlePurchase = async () => {
    if (totalTickets === 0) {
      Alert.alert('Error', 'Selecciona al menos una entrada');
      return;
    }
    if (!buyerName.trim()) {
      Alert.alert('Error', 'Por favor introduce tu nombre');
      return;
    }
    if (!buyerEmail.trim()) {
      Alert.alert('Error', 'Por favor introduce tu email');
      return;
    }

    setIsProcessing(true);

    const seller = sellerCode ? getSellerByCode(sellerCode) : null;

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      for (const tier of event.ticketTiers) {
        const qty = quantities[tier.id] || 0;
        for (let i = 0; i < qty; i++) {
          await addTicket({
            eventId: event.id,
            tierId: tier.id,
            buyerName: buyerName.trim(),
            buyerEmail: buyerEmail.trim(),
            buyerPhone: buyerPhone.trim(),
            sellerId: seller?.id,
            sellerCode: seller?.code,
            paymentMethod,
            price: tier.price,
          });
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '¡Compra completada!',
        `Se han comprado ${totalTickets} entrada(s). Recibirás los QR por email.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.log('Purchase error:', error);
      Alert.alert('Error', 'No se pudo procesar el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  const paymentMethods: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { id: 'card', label: 'Tarjeta', icon: <CreditCard color={paymentMethod === 'card' ? Colors.dark.primary : Colors.dark.textMuted} size={20} /> },
    { id: 'googlepay', label: 'Google Pay', icon: <Smartphone color={paymentMethod === 'googlepay' ? Colors.dark.primary : Colors.dark.textMuted} size={20} /> },
    { id: 'applepay', label: 'Apple Pay', icon: <Smartphone color={paymentMethod === 'applepay' ? Colors.dark.primary : Colors.dark.textMuted} size={20} /> },
  ];

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerTitle: event.name }} />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Selecciona tus entradas</Text>

        {event.ticketTiers.map((tier) => {
          const available = tier.quantity - tier.sold;
          const qty = quantities[tier.id] || 0;
          const isDisabled = available === 0;

          return (
            <View 
              key={tier.id} 
              style={[styles.tierCard, isDisabled && styles.tierDisabled]}
            >
              <View style={styles.tierInfo}>
                <View style={styles.tierTitleRow}>
                  {tier.isVip && <Crown color={Colors.dark.warning} size={16} />}
                  {tier.includesBus && <Bus color={Colors.dark.secondary} size={16} />}
                  <Text style={styles.tierName}>{tier.name}</Text>
                </View>
                <Text style={styles.tierDescription}>{tier.description}</Text>
                <Text style={styles.tierAvailable}>
                  {isDisabled ? 'AGOTADAS' : `${available} disponibles`}
                </Text>
              </View>

              <View style={styles.tierRight}>
                <Text style={styles.tierPrice}>{formatCurrency(tier.price)}</Text>
                <View style={styles.quantityControl}>
                  <TouchableOpacity
                    style={[styles.qtyButton, qty === 0 && styles.qtyButtonDisabled]}
                    onPress={() => updateQuantity(tier.id, -1)}
                    disabled={qty === 0 || isDisabled}
                  >
                    <Minus color={qty === 0 ? Colors.dark.textMuted : Colors.dark.text} size={18} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{qty}</Text>
                  <TouchableOpacity
                    style={[styles.qtyButton, (qty >= available || isDisabled) && styles.qtyButtonDisabled]}
                    onPress={() => updateQuantity(tier.id, 1)}
                    disabled={qty >= available || isDisabled}
                  >
                    <Plus color={qty >= available ? Colors.dark.textMuted : Colors.dark.text} size={18} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Datos del comprador</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre completo *</Text>
          <TextInput
            style={styles.input}
            placeholder="Tu nombre"
            placeholderTextColor={Colors.dark.textMuted}
            value={buyerName}
            onChangeText={setBuyerName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            placeholder="email@ejemplo.com"
            placeholderTextColor={Colors.dark.textMuted}
            value={buyerEmail}
            onChangeText={setBuyerEmail}
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
            value={buyerPhone}
            onChangeText={setBuyerPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Tag color={Colors.dark.secondary} size={16} />
            <Text style={styles.label}>Código de vendedor (opcional)</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Ej: CARLOS2026"
            placeholderTextColor={Colors.dark.textMuted}
            value={sellerCode}
            onChangeText={(text) => setSellerCode(text.toUpperCase())}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Método de pago</Text>

        <View style={styles.paymentMethods}>
          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.paymentOption,
                paymentMethod === method.id && styles.paymentOptionActive,
              ]}
              onPress={() => setPaymentMethod(method.id)}
            >
              {method.icon}
              <Text 
                style={[
                  styles.paymentLabel,
                  paymentMethod === method.id && styles.paymentLabelActive,
                ]}
              >
                {method.label}
              </Text>
              {paymentMethod === method.id && (
                <View style={styles.checkIcon}>
                  <Check color={Colors.dark.primary} size={14} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>{totalTickets} entrada(s)</Text>
          <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.purchaseButton, (totalTickets === 0 || isProcessing) && styles.purchaseButtonDisabled]}
          onPress={handlePurchase}
          disabled={totalTickets === 0 || isProcessing}
        >
          <LinearGradient
            colors={totalTickets > 0 && !isProcessing ? Colors.dark.gradient.primary as [string, string] : [Colors.dark.textMuted, Colors.dark.textMuted]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.purchaseGradient}
          >
            <Text style={styles.purchaseText}>
              {isProcessing ? 'Procesando...' : 'Pagar ahora'}
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
  errorText: {
    color: Colors.dark.error,
    textAlign: 'center',
    marginTop: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 14,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  tierCard: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  tierDisabled: {
    opacity: 0.5,
  },
  tierInfo: {
    flex: 1,
  },
  tierTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  tierDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 6,
  },
  tierAvailable: {
    fontSize: 12,
    color: Colors.dark.success,
    fontWeight: '600',
  },
  tierRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  tierPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.dark.primary,
    marginBottom: 12,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  qtyButtonDisabled: {
    opacity: 0.4,
  },
  qtyText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    minWidth: 30,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 24,
    marginHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
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
  paymentMethods: {
    gap: 10,
    paddingHorizontal: 20,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  paymentOptionActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + '10',
  },
  paymentLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  paymentLabelActive: {
    color: Colors.dark.text,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  totalContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  purchaseButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  purchaseText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
