import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Minus, Plus, CreditCard, Banknote, Crown, Bus, Printer, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/contexts/AppContext';
import Colors from '@/constants/colors';
import { Event } from '@/types';

type PaymentMethod = 'card' | 'cash';

export default function BoxOfficeScreen() {
  const router = useRouter();
  const { events, addTicket } = useApp();
  const activeEvents = events.filter(e => e.isActive);
  
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(activeEvents[0] || null);
  const [quantities, setQuantities] = useState<{ [tierId: string]: number }>({});
  const [buyerName, setBuyerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<{ tickets: number; total: number } | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const updateQuantity = (tierId: string, delta: number) => {
    if (!selectedEvent) return;
    const tier = selectedEvent.ticketTiers.find(t => t.id === tierId);
    if (!tier) return;

    const current = quantities[tierId] || 0;
    const available = tier.quantity - tier.sold;
    const newQty = Math.max(0, Math.min(available, current + delta));
    
    setQuantities({ ...quantities, [tierId]: newQty });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const totalAmount = selectedEvent?.ticketTiers.reduce((sum, tier) => {
    const qty = quantities[tier.id] || 0;
    return sum + (qty * tier.price);
  }, 0) || 0;

  const totalTickets = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);

  const handleQuickSale = async () => {
    if (!selectedEvent || totalTickets === 0) {
      Alert.alert('Error', 'Selecciona al menos una entrada');
      return;
    }

    setIsProcessing(true);

    try {
      for (const tier of selectedEvent.ticketTiers) {
        const qty = quantities[tier.id] || 0;
        for (let i = 0; i < qty; i++) {
          await addTicket({
            eventId: selectedEvent.id,
            tierId: tier.id,
            buyerName: buyerName.trim() || 'Venta Taquilla',
            buyerEmail: 'taquilla@local',
            buyerPhone: '',
            paymentMethod: paymentMethod === 'cash' ? 'cash' : 'card',
            price: tier.price,
          });
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLastSale({ tickets: totalTickets, total: totalAmount });
      setQuantities({});
      setBuyerName('');

      setTimeout(() => setLastSale(null), 3000);
    } catch (error) {
      console.log('Sale error:', error);
      Alert.alert('Error', 'No se pudo procesar la venta');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetSale = () => {
    setQuantities({});
    setBuyerName('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.dark.primary + '30', Colors.dark.background]}
        style={StyleSheet.absoluteFill}
      />
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>🎫 TAQUILLA</Text>
            <Text style={styles.headerSubtitle}>Modo venta rápida</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <X color={Colors.dark.text} size={24} />
          </TouchableOpacity>
        </View>

        {activeEvents.length > 1 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.eventSelector}
            contentContainerStyle={styles.eventSelectorContent}
          >
            {activeEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={[
                  styles.eventChip,
                  selectedEvent?.id === event.id && styles.eventChipActive,
                ]}
                onPress={() => {
                  setSelectedEvent(event);
                  setQuantities({});
                }}
              >
                <Text 
                  style={[
                    styles.eventChipText,
                    selectedEvent?.id === event.id && styles.eventChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {event.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {selectedEvent ? (
            <>
              <View style={styles.eventInfo}>
                <Text style={styles.eventName}>{selectedEvent.name}</Text>
                <Text style={styles.eventDate}>
                  {new Date(selectedEvent.date).toLocaleDateString('es-ES', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })} • {selectedEvent.time}
                </Text>
              </View>

              <View style={styles.tiersGrid}>
                {selectedEvent.ticketTiers.map((tier) => {
                  const available = tier.quantity - tier.sold;
                  const qty = quantities[tier.id] || 0;
                  const isDisabled = available === 0;

                  return (
                    <View 
                      key={tier.id} 
                      style={[styles.tierCard, isDisabled && styles.tierDisabled]}
                    >
                      <View style={styles.tierHeader}>
                        <View style={styles.tierTitleRow}>
                          {tier.isVip && <Crown color={Colors.dark.warning} size={14} />}
                          {tier.includesBus && <Bus color={Colors.dark.secondary} size={14} />}
                          <Text style={styles.tierName}>{tier.name}</Text>
                        </View>
                        <Text style={styles.tierPrice}>{formatCurrency(tier.price)}</Text>
                      </View>
                      
                      <Text style={styles.tierAvailable}>
                        {isDisabled ? 'AGOTADAS' : `${available} disp.`}
                      </Text>

                      <View style={styles.quantityRow}>
                        <TouchableOpacity
                          style={[styles.qtyButtonLarge, qty === 0 && styles.qtyButtonDisabled]}
                          onPress={() => updateQuantity(tier.id, -1)}
                          disabled={qty === 0 || isDisabled}
                        >
                          <Minus color={qty === 0 ? Colors.dark.textMuted : Colors.dark.text} size={24} />
                        </TouchableOpacity>
                        <Text style={styles.qtyTextLarge}>{qty}</Text>
                        <TouchableOpacity
                          style={[styles.qtyButtonLarge, styles.qtyButtonPlus, (qty >= available || isDisabled) && styles.qtyButtonDisabled]}
                          onPress={() => updateQuantity(tier.id, 1)}
                          disabled={qty >= available || isDisabled}
                        >
                          <Plus color="#FFF" size={24} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.buyerSection}>
                <TextInput
                  style={styles.buyerInput}
                  placeholder="Nombre del comprador (opcional)"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={buyerName}
                  onChangeText={setBuyerName}
                />
              </View>

              <View style={styles.paymentSection}>
                <TouchableOpacity
                  style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentActive]}
                  onPress={() => setPaymentMethod('card')}
                >
                  <CreditCard color={paymentMethod === 'card' ? Colors.dark.primary : Colors.dark.textMuted} size={24} />
                  <Text style={[styles.paymentText, paymentMethod === 'card' && styles.paymentTextActive]}>
                    Tarjeta
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.paymentOption, paymentMethod === 'cash' && styles.paymentActive]}
                  onPress={() => setPaymentMethod('cash')}
                >
                  <Banknote color={paymentMethod === 'cash' ? Colors.dark.success : Colors.dark.textMuted} size={24} />
                  <Text style={[styles.paymentText, paymentMethod === 'cash' && styles.paymentTextActive]}>
                    Efectivo
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.noEvents}>
              <Text style={styles.noEventsText}>No hay eventos activos</Text>
            </View>
          )}
        </ScrollView>

        {lastSale && (
          <View style={styles.saleConfirmation}>
            <Check color={Colors.dark.success} size={24} />
            <Text style={styles.saleConfirmationText}>
              ¡Venta completada! {lastSale.tickets} entrada(s) - {formatCurrency(lastSale.total)}
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <View style={styles.totalSection}>
            <Text style={styles.totalLabel}>{totalTickets} entradas</Text>
            <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
          </View>

          <View style={styles.footerActions}>
            <TouchableOpacity style={styles.resetButton} onPress={resetSale}>
              <X color={Colors.dark.textMuted} size={20} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.saleButton, (totalTickets === 0 || isProcessing) && styles.saleButtonDisabled]}
              onPress={handleQuickSale}
              disabled={totalTickets === 0 || isProcessing}
            >
              <LinearGradient
                colors={totalTickets > 0 && !isProcessing ? Colors.dark.gradient.primary as [string, string] : [Colors.dark.textMuted, Colors.dark.textMuted]}
                style={styles.saleGradient}
              >
                <Printer color="#FFF" size={20} />
                <Text style={styles.saleText}>
                  {isProcessing ? 'Procesando...' : 'VENDER'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {},
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventSelector: {
    maxHeight: 50,
    marginBottom: 16,
  },
  eventSelectorContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  eventChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  eventChipActive: {
    backgroundColor: Colors.dark.primary + '20',
    borderColor: Colors.dark.primary,
  },
  eventChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  eventChipTextActive: {
    color: Colors.dark.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  eventInfo: {
    marginBottom: 20,
  },
  eventName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  eventDate: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  tiersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  tierCard: {
    width: '48%',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 14,
  },
  tierDisabled: {
    opacity: 0.4,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  tierTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  tierName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  tierPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.dark.primary,
  },
  tierAvailable: {
    fontSize: 11,
    color: Colors.dark.success,
    marginBottom: 10,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyButtonLarge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  qtyButtonPlus: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  qtyButtonDisabled: {
    opacity: 0.4,
  },
  qtyTextLarge: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  buyerSection: {
    marginBottom: 16,
  },
  buyerInput: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  paymentSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  paymentActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + '10',
  },
  paymentText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  paymentTextActive: {
    color: Colors.dark.text,
  },
  noEvents: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  noEventsText: {
    fontSize: 16,
    color: Colors.dark.textMuted,
  },
  saleConfirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.dark.success + '20',
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  saleConfirmationText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.success,
  },
  footer: {
    backgroundColor: Colors.dark.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  totalLabel: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  resetButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  saleButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saleButtonDisabled: {
    opacity: 0.5,
  },
  saleGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  saleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
});
