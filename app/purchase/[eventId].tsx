import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Minus, Plus, CreditCard, Smartphone, Crown, Bus, Check, Tag, Gift, Calendar, MapPin, User, ChevronDown, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { trpc } from '@/lib/trpc';
import Colors from '@/constants/colors';

type PaymentMethod = 'card' | 'googlepay' | 'applepay';

export default function PurchaseScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const eventsQuery = trpc.events.list.useQuery();
  const events = eventsQuery.data || [];
  const event = events.find(e => e.id === eventId);

  const [quantities, setQuantities] = useState<{ [tierId: string]: number }>({});
  const [selectedExtras, setSelectedExtras] = useState<{ [tierId: string]: { [extraId: string]: boolean } }>({});
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [sellerCode, setSellerCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');

  
  // Datos demográficos
  const [buyerBirthdate, setBuyerBirthdate] = useState('');
  const [buyerGender, setBuyerGender] = useState<'male' | 'female' | 'other' | 'prefer_not_say' | ''>('');
  const [buyerCity, setBuyerCity] = useState('');
  const [buyerCountry, setBuyerCountry] = useState('España');
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  
  const genderOptions = [
    { value: 'male', label: 'Hombre' },
    { value: 'female', label: 'Mujer' },
    { value: 'other', label: 'Otro' },
    { value: 'prefer_not_say', label: 'Prefiero no decirlo' },
  ];
  
  const countryOptions = [
    'España', 'Portugal', 'Francia', 'Italia', 'Alemania', 'Reino Unido', 
    'Países Bajos', 'Bélgica', 'Suiza', 'Austria', 'Polonia', 'Irlanda',
    'Argentina', 'México', 'Colombia', 'Chile', 'Perú', 'Venezuela',
    'Estados Unidos', 'Canadá', 'Brasil', 'Otro'
  ];

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

  const toggleExtra = (tierId: string, extraId: string) => {
    setSelectedExtras(prev => ({
      ...prev,
      [tierId]: {
        ...(prev[tierId] || {}),
        [extraId]: !(prev[tierId]?.[extraId] || false),
      },
    }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getExtrasTotal = (tierId: string): number => {
    const tier = event.ticketTiers.find(t => t.id === tierId) as any;
    if (!tier || !tier.extras) return 0;
    
    const qty = quantities[tierId] || 0;
    if (qty === 0) return 0;
    
    return tier.extras.reduce((sum: number, extra: { id: string; price: number }) => {
      if (selectedExtras[tierId]?.[extra.id]) {
        return sum + (extra.price * qty);
      }
      return sum;
    }, 0);
  };

  const totalAmount = event.ticketTiers.reduce((sum, tier) => {
    const qty = quantities[tier.id] || 0;
    const tierTotal = qty * tier.price;
    const extrasTotal = getExtrasTotal(tier.id);
    return sum + tierTotal + extrasTotal;
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

    // Encontrar el primer tier con cantidad > 0 para el checkout
    const selectedTier = event.ticketTiers.find(tier => (quantities[tier.id] || 0) > 0);
    if (!selectedTier) {
      Alert.alert('Error', 'Selecciona al menos una entrada');
      return;
    }

    const qty = quantities[selectedTier.id] || 0;
    const tierTotal = qty * selectedTier.price;
    const extrasTotal = getExtrasTotal(selectedTier.id);
    const total = tierTotal + extrasTotal;

    // Redirigir al checkout con los datos del pago
    router.push({
      pathname: '/checkout/[eventId]',
      params: {
        eventId: event.id,
        eventName: event.name,
        tierId: selectedTier.id,
        tierName: selectedTier.name,
        quantity: String(qty),
        unitPrice: String(selectedTier.price),
        totalAmount: String(total),
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        buyerPhone: buyerPhone.trim() || '',
        sellerCode: sellerCode || '',
      },
    });
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
                {qty > 0 && getExtrasTotal(tier.id) > 0 && (
                  <Text style={styles.tierExtrasPrice}>+ {formatCurrency(getExtrasTotal(tier.id))}</Text>
                )}
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

              {qty > 0 && (tier as any).extras && (tier as any).extras.length > 0 && (
                <View style={styles.extrasContainer}>
                  <Text style={styles.extrasTitle}>Extras opcionales (se añaden al precio base):</Text>
                  {(tier as any).extras.map((extra: { id: string; name: string; price: number; description?: string }) => {
                    const isSelected = selectedExtras[tier.id]?.[extra.id] || false;
                    return (
                      <TouchableOpacity
                        key={extra.id}
                        style={[styles.extraOption, isSelected && styles.extraOptionActive]}
                        onPress={() => toggleExtra(tier.id, extra.id)}
                      >
                        <View style={styles.extraInfo}>
                          <View style={styles.extraHeader}>
                            <Gift color={isSelected ? Colors.dark.secondary : Colors.dark.textMuted} size={16} />
                            <Text style={[styles.extraName, isSelected && styles.extraNameActive]}>
                              {extra.name}
                            </Text>
                          </View>
                          {extra.description && (
                            <Text style={styles.extraDescription}>{extra.description}</Text>
                          )}
                        </View>
                        <View style={styles.extraRight}>
                          <Text style={[styles.extraPrice, isSelected && styles.extraPriceActive]}>
                            +{formatCurrency(extra.price)}
                          </Text>
                          {isSelected && (
                            <View style={styles.extraCheck}>
                              <Check color={Colors.dark.secondary} size={14} />
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  <Text style={styles.extrasNote}>
                    Total extras × {qty} entrada(s): {formatCurrency(getExtrasTotal(tier.id))}
                  </Text>
                </View>
              )}
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

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Información adicional (opcional)</Text>
        <Text style={styles.sectionSubtitle}>Estos datos nos ayudan a mejorar nuestros eventos</Text>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Calendar color={Colors.dark.secondary} size={16} />
            <Text style={styles.label}>Fecha de nacimiento</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={Colors.dark.textMuted}
            value={buyerBirthdate}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9]/g, '');
              let formatted = cleaned;
              if (cleaned.length >= 2) formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
              if (cleaned.length >= 4) formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4) + '/' + cleaned.slice(4, 8);
              setBuyerBirthdate(formatted);
            }}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <User color={Colors.dark.secondary} size={16} />
            <Text style={styles.label}>Género</Text>
          </View>
          <TouchableOpacity 
            style={styles.selectInput}
            onPress={() => setShowGenderModal(true)}
          >
            <Text style={buyerGender ? styles.selectInputText : styles.selectInputPlaceholder}>
              {buyerGender ? genderOptions.find(g => g.value === buyerGender)?.label : 'Seleccionar'}
            </Text>
            <ChevronDown color={Colors.dark.textMuted} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.rowInputs}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <View style={styles.labelRow}>
              <MapPin color={Colors.dark.secondary} size={16} />
              <Text style={styles.label}>Ciudad</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Tu ciudad"
              placeholderTextColor={Colors.dark.textMuted}
              value={buyerCity}
              onChangeText={setBuyerCity}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>País</Text>
            <TouchableOpacity 
              style={styles.selectInput}
              onPress={() => setShowCountryModal(true)}
            >
              <Text style={styles.selectInputText} numberOfLines={1}>
                {buyerCountry || 'Seleccionar'}
              </Text>
              <ChevronDown color={Colors.dark.textMuted} size={20} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

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

      <Modal visible={showGenderModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar género</Text>
              <TouchableOpacity onPress={() => setShowGenderModal(false)}>
                <X color={Colors.dark.text} size={24} />
              </TouchableOpacity>
            </View>
            {genderOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.modalOption, buyerGender === option.value && styles.modalOptionActive]}
                onPress={() => {
                  setBuyerGender(option.value as typeof buyerGender);
                  setShowGenderModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, buyerGender === option.value && styles.modalOptionTextActive]}>
                  {option.label}
                </Text>
                {buyerGender === option.value && <Check color={Colors.dark.primary} size={20} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={showCountryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar país</Text>
              <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                <X color={Colors.dark.text} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {countryOptions.map((country) => (
                <TouchableOpacity
                  key={country}
                  style={[styles.modalOption, buyerCountry === country && styles.modalOptionActive]}
                  onPress={() => {
                    setBuyerCountry(country);
                    setShowCountryModal(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, buyerCountry === country && styles.modalOptionTextActive]}>
                    {country}
                  </Text>
                  {buyerCountry === country && <Check color={Colors.dark.primary} size={20} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>{totalTickets} entrada(s)</Text>
          <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.purchaseButton, totalTickets === 0 && styles.purchaseButtonDisabled]}
          onPress={handlePurchase}
          disabled={totalTickets === 0}
        >
          <LinearGradient
            colors={totalTickets > 0 ? Colors.dark.gradient.primary as [string, string] : [Colors.dark.textMuted, Colors.dark.textMuted]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.purchaseGradient}
          >
            <Text style={styles.purchaseText}>
              Continuar al pago
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
  extrasContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  extrasTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 10,
  },
  extraOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  extraOptionActive: {
    borderColor: Colors.dark.secondary,
    backgroundColor: Colors.dark.secondary + '10',
  },
  extraInfo: {
    flex: 1,
    marginRight: 12,
  },
  extraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  extraName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  extraNameActive: {
    color: Colors.dark.text,
  },
  extraDescription: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginLeft: 24,
  },
  extraRight: {
    alignItems: 'flex-end',
  },
  extraPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.textMuted,
  },
  extraPriceActive: {
    color: Colors.dark.secondary,
  },
  extraCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.dark.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  extrasNote: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.primary,
    textAlign: 'right',
    marginTop: 4,
  },
  tierExtrasPrice: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.secondary,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: -8,
  },
  rowInputs: {
    flexDirection: 'row' as const,
    gap: 12,
    paddingHorizontal: 20,
    marginHorizontal: -20,
  },
  selectInput: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  selectInputText: {
    fontSize: 16,
    color: Colors.dark.text,
    flex: 1,
  },
  selectInputPlaceholder: {
    fontSize: 16,
    color: Colors.dark.textMuted,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end' as const,
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  modalOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  modalOptionActive: {
    backgroundColor: Colors.dark.primary + '15',
  },
  modalOptionText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  modalOptionTextActive: {
    color: Colors.dark.text,
    fontWeight: '600' as const,
  },
});
