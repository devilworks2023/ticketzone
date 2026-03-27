import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CreditCard,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  Building2,
  X,
  Banknote,
  Wallet,
  DollarSign,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function AdminPaymentsScreen() {
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedPromoter, setSelectedPromoter] = useState<any>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'bank_transfer' | 'cash' | 'other'>('bank_transfer');

  const payoutsQuery = trpc.payments.listPayouts.useQuery();
  // @ts-ignore - endpoint exists in backend
  const balancesQuery = trpc.payments.listPromoterBalances.useQuery();
  const createPayoutMutation = trpc.payments.createPayout.useMutation();

  const payouts = payoutsQuery.data || [];
  const promoterBalances = balancesQuery.data || [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color={Colors.dark.success} size={18} />;
      case 'pending':
        return <Clock color={Colors.dark.warning} size={18} />;
      case 'failed':
        return <XCircle color={Colors.dark.error} size={18} />;
      default:
        return <Clock color={Colors.dark.textMuted} size={18} />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completado';
      case 'pending': return 'Pendiente';
      case 'failed': return 'Fallido';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return Colors.dark.success;
      case 'pending': return Colors.dark.warning;
      case 'failed': return Colors.dark.error;
      default: return Colors.dark.textMuted;
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'bank_transfer': return 'Transferencia';
      case 'cash': return 'Efectivo';
      case 'other': return 'Otro';
      default: return method;
    }
  };

  const totalPaid = payouts
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = promoterBalances.reduce((sum: number, p: any) => sum + p.availableBalance, 0);

  const handleCreatePayout = async () => {
    if (!selectedPromoter || !payoutAmount) {
      Alert.alert('Error', 'Selecciona un promotor y cantidad');
      return;
    }

    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Introduce una cantidad válida');
      return;
    }

    if (amount > selectedPromoter.availableBalance) {
      Alert.alert('Error', 'La cantidad supera el balance disponible');
      return;
    }

    try {
      await createPayoutMutation.mutateAsync({
        promoterId: selectedPromoter.id,
        amount,
        // @ts-ignore - method exists in backend
        method: payoutMethod,
      });

      Alert.alert('Éxito', 'Pago registrado correctamente');
      setShowPayoutModal(false);
      setSelectedPromoter(null);
      setPayoutAmount('');
      payoutsQuery.refetch();
      balancesQuery.refetch();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo registrar el pago');
    }
  };

  const openPayoutModal = (promoter: { id: string; name: string; email: string; availableBalance: number }) => {
    setSelectedPromoter(promoter);
    setPayoutAmount(promoter.availableBalance.toFixed(2));
    setShowPayoutModal(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Pagos a Promotores',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: Colors.dark.success + '20' }]}>
              <CheckCircle color={Colors.dark.success} size={22} />
            </View>
            <Text style={[styles.summaryValue, { color: Colors.dark.success }]}>
              {formatCurrency(totalPaid)}
            </Text>
            <Text style={styles.summaryLabel}>Total pagado</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: Colors.dark.warning + '20' }]}>
              <Wallet color={Colors.dark.warning} size={22} />
            </View>
            <Text style={[styles.summaryValue, { color: Colors.dark.warning }]}>
              {formatCurrency(totalPending)}
            </Text>
            <Text style={styles.summaryLabel}>Por pagar</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Balances de Promotores</Text>
          
          {balancesQuery.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={Colors.dark.primary} />
            </View>
          ) : promoterBalances.length === 0 ? (
            <View style={styles.emptyState}>
              <Building2 color={Colors.dark.textMuted} size={48} />
              <Text style={styles.emptyTitle}>Sin promotores</Text>
              <Text style={styles.emptyText}>
                Los promotores aparecerán aquí
              </Text>
            </View>
          ) : (
            promoterBalances.map((promoter: any) => (
              <View key={promoter.id} style={styles.promoterCard}>
                <View style={styles.promoterHeader}>
                  <View style={styles.promoterIcon}>
                    <Building2 color={Colors.dark.primary} size={20} />
                  </View>
                  <View style={styles.promoterInfo}>
                    <Text style={styles.promoterName}>{promoter.name}</Text>
                    <Text style={styles.promoterEmail}>{promoter.email}</Text>
                  </View>
                </View>
                <View style={styles.balanceGrid}>
                  <View style={styles.balanceItem}>
                    <Text style={styles.balanceLabel}>Ganancias</Text>
                    <Text style={styles.balanceValue}>{formatCurrency(promoter.totalEarnings)}</Text>
                  </View>
                  <View style={styles.balanceItem}>
                    <Text style={styles.balanceLabel}>Pagado</Text>
                    <Text style={[styles.balanceValue, { color: Colors.dark.success }]}>
                      {formatCurrency(promoter.totalPaid)}
                    </Text>
                  </View>
                  <View style={styles.balanceItem}>
                    <Text style={styles.balanceLabel}>Disponible</Text>
                    <Text style={[styles.balanceValue, { color: Colors.dark.warning }]}>
                      {formatCurrency(promoter.availableBalance)}
                    </Text>
                  </View>
                </View>
                {promoter.availableBalance > 0 && (
                  <TouchableOpacity
                    style={styles.payButton}
                    onPress={() => openPayoutModal(promoter)}
                  >
                    <DollarSign color={Colors.dark.primary} size={16} />
                    <Text style={styles.payButtonText}>Registrar pago</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historial de Pagos</Text>

          {payoutsQuery.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={Colors.dark.primary} />
            </View>
          ) : payouts.length === 0 ? (
            <View style={styles.emptyState}>
              <CreditCard color={Colors.dark.textMuted} size={48} />
              <Text style={styles.emptyTitle}>Sin pagos</Text>
              <Text style={styles.emptyText}>
                Los pagos a promotores aparecerán aquí
              </Text>
            </View>
          ) : (
            payouts.map((payout) => (
              <View key={payout.id} style={styles.payoutCard}>
                <View style={styles.payoutHeader}>
                  <View style={styles.payoutIcon}>
                    <ArrowUpRight color={Colors.dark.primary} size={20} />
                  </View>
                  <View style={styles.payoutInfo}>
                    <View style={styles.payoutRow}>
                      <Building2 color={Colors.dark.textMuted} size={14} />
                      <Text style={styles.payoutPromoterName}>{payout.promoterName}</Text>
                    </View>
                    <Text style={styles.payoutDate}>{formatDate(payout.createdAt)}</Text>
                  </View>
                  <Text style={styles.payoutAmount}>{formatCurrency(payout.amount)}</Text>
                </View>
                <View style={styles.payoutFooter}>
                  <View style={styles.statusContainer}>
                    {getStatusIcon(payout.status)}
                    <Text style={[styles.statusText, { color: getStatusColor(payout.status) }]}>
                      {getStatusLabel(payout.status)}
                    </Text>
                  </View>
                  {(payout as any).method && (
                    <View style={styles.methodBadge}>
                      <Banknote color={Colors.dark.textMuted} size={12} />
                      <Text style={styles.methodText}>
                        {getMethodLabel((payout as any).method)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
        <View style={styles.bottomPadding} />
      </ScrollView>

      <Modal
        visible={showPayoutModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPayoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Pago</Text>
              <TouchableOpacity onPress={() => setShowPayoutModal(false)}>
                <X color={Colors.dark.text} size={24} />
              </TouchableOpacity>
            </View>

            {selectedPromoter && (
              <>
                <View style={styles.modalPromoterInfo}>
                  <Building2 color={Colors.dark.primary} size={20} />
                  <View>
                    <Text style={styles.modalPromoterName}>{selectedPromoter.name}</Text>
                    <Text style={styles.modalPromoterBalance}>
                      Balance disponible: {formatCurrency(selectedPromoter.availableBalance)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.inputLabel}>Cantidad a pagar</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>€</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={payoutAmount}
                    onChangeText={setPayoutAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.dark.textMuted}
                  />
                </View>

                <Text style={styles.inputLabel}>Método de pago</Text>
                <View style={styles.methodOptions}>
                  {(['bank_transfer', 'cash', 'other'] as const).map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.methodOption,
                        payoutMethod === method && styles.methodOptionActive,
                      ]}
                      onPress={() => setPayoutMethod(method)}
                    >
                      <Text
                        style={[
                          styles.methodOptionText,
                          payoutMethod === method && styles.methodOptionTextActive,
                        ]}
                      >
                        {getMethodLabel(method)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleCreatePayout}
                  disabled={createPayoutMutation.isPending}
                >
                  <LinearGradient
                    colors={Colors.dark.gradient.primary as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.confirmButtonGradient}
                  >
                    {createPayoutMutation.isPending ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <CheckCircle color="#FFF" size={20} />
                        <Text style={styles.confirmButtonText}>Confirmar pago</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 14,
  },
  loading: {
    padding: 40,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  promoterCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  promoterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  promoterIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoterInfo: {
    flex: 1,
    marginLeft: 12,
  },
  promoterName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  promoterEmail: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  balanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.primary + '15',
    borderRadius: 10,
    paddingVertical: 12,
  },
  payButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.primary,
  },
  payoutCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  payoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutInfo: {
    flex: 1,
    marginLeft: 12,
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payoutPromoterName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  payoutDate: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  payoutAmount: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  payoutFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  methodText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  bottomPadding: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.dark.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  modalPromoterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  modalPromoterName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  modalPromoterBalance: {
    fontSize: 13,
    color: Colors.dark.success,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    paddingVertical: 16,
  },
  methodOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  methodOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
  },
  methodOptionActive: {
    backgroundColor: Colors.dark.primary,
  },
  methodOptionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
  },
  methodOptionTextActive: {
    color: '#FFF',
  },
  confirmButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFF',
  },
});
