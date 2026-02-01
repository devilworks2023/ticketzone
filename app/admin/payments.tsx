import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
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
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function AdminPaymentsScreen() {
  const payoutsQuery = trpc.payments.listPayouts.useQuery();
  const payouts = payoutsQuery.data || [];

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

  const totalPaid = payouts
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = payouts
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Pagos y Transferencias',
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
              <Clock color={Colors.dark.warning} size={22} />
            </View>
            <Text style={[styles.summaryValue, { color: Colors.dark.warning }]}>
              {formatCurrency(totalPending)}
            </Text>
            <Text style={styles.summaryLabel}>Pendiente</Text>
          </View>
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
                      <Text style={styles.promoterName}>{payout.promoterName}</Text>
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
                  {payout.stripeTransferId && (
                    <Text style={styles.transferId}>
                      {payout.stripeTransferId.slice(0, 20)}...
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
        <View style={styles.bottomPadding} />
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
    fontWeight: '800',
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
    fontWeight: '700',
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
    fontWeight: '700',
    color: Colors.dark.text,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
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
  promoterName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  payoutDate: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  payoutAmount: {
    fontSize: 17,
    fontWeight: '700',
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
    fontWeight: '600',
  },
  transferId: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontFamily: 'monospace',
  },
  bottomPadding: {
    height: 40,
  },
});
