import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Stack } from 'expo-router';
import { DollarSign, Clock, CheckCircle, XCircle, Filter } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

interface Payout {
  id: string;
  amount: number;
  status: 'completed' | 'pending' | 'processing' | 'failed';
  createdAt: string;
  completedAt?: string;
  stripeTransferId?: string;
}

export default function PayoutsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
  
  const [payouts] = useState<Payout[]>([
    {
      id: '1',
      amount: 1250.00,
      status: 'processing',
      createdAt: '2026-01-30T10:00:00',
    },
    {
      id: '2',
      amount: 890.50,
      status: 'completed',
      createdAt: '2026-01-25T14:30:00',
      completedAt: '2026-01-26T09:15:00',
      stripeTransferId: 'tr_1234567890',
    },
    {
      id: '3',
      amount: 1540.00,
      status: 'completed',
      createdAt: '2026-01-18T11:20:00',
      completedAt: '2026-01-19T10:00:00',
      stripeTransferId: 'tr_0987654321',
    },
    {
      id: '4',
      amount: 675.25,
      status: 'completed',
      createdAt: '2026-01-10T16:45:00',
      completedAt: '2026-01-11T08:30:00',
      stripeTransferId: 'tr_1122334455',
    },
    {
      id: '5',
      amount: 320.00,
      status: 'failed',
      createdAt: '2026-01-05T09:00:00',
    },
  ]);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusConfig = (status: Payout['status']) => {
    switch (status) {
      case 'completed':
        return { icon: <CheckCircle color={Colors.dark.success} size={18} />, color: Colors.dark.success, label: 'Completado' };
      case 'pending':
        return { icon: <Clock color={Colors.dark.warning} size={18} />, color: Colors.dark.warning, label: 'Pendiente' };
      case 'processing':
        return { icon: <Clock color={Colors.dark.secondary} size={18} />, color: Colors.dark.secondary, label: 'Procesando' };
      case 'failed':
        return { icon: <XCircle color={Colors.dark.error} size={18} />, color: Colors.dark.error, label: 'Fallido' };
    }
  };

  const filteredPayouts = payouts.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'completed') return p.status === 'completed';
    if (filter === 'pending') return p.status === 'pending' || p.status === 'processing';
    return true;
  });

  const totalCompleted = payouts.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payouts.filter(p => p.status === 'pending' || p.status === 'processing').reduce((sum, p) => sum + p.amount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: 'Mis Pagos',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }} 
      />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.primary}
          />
        }
      >
        <View style={styles.summarySection}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: Colors.dark.success + '20' }]}>
              <CheckCircle color={Colors.dark.success} size={20} />
            </View>
            <Text style={styles.summaryLabel}>Recibido</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalCompleted)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: Colors.dark.secondary + '20' }]}>
              <Clock color={Colors.dark.secondary} size={20} />
            </View>
            <Text style={styles.summaryLabel}>Pendiente</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalPending)}</Text>
          </View>
        </View>

        <View style={styles.filterSection}>
          <Filter color={Colors.dark.textMuted} size={16} />
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>Completados</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
            onPress={() => setFilter('pending')}
          >
            <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>Pendientes</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.payoutsList}>
          {filteredPayouts.map((payout) => {
            const statusConfig = getStatusConfig(payout.status);
            return (
              <View key={payout.id} style={styles.payoutCard}>
                <View style={styles.payoutHeader}>
                  <View style={styles.payoutAmount}>
                    <DollarSign color={Colors.dark.primary} size={20} />
                    <Text style={styles.payoutAmountText}>{formatCurrency(payout.amount)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                    {statusConfig.icon}
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>
                <View style={styles.payoutDetails}>
                  <Text style={styles.payoutDate}>Creado: {formatDate(payout.createdAt)}</Text>
                  {payout.completedAt && (
                    <Text style={styles.payoutDate}>Completado: {formatDate(payout.completedAt)}</Text>
                  )}
                  {payout.stripeTransferId && (
                    <Text style={styles.payoutRef}>Ref: {payout.stripeTransferId}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {filteredPayouts.length === 0 && (
          <View style={styles.emptyState}>
            <DollarSign color={Colors.dark.textMuted} size={48} />
            <Text style={styles.emptyText}>No hay pagos que mostrar</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  summarySection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
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
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  filterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
  },
  filterButtonActive: {
    backgroundColor: Colors.dark.primary + '20',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  filterTextActive: {
    color: Colors.dark.primary,
  },
  payoutsList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  payoutCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  payoutAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payoutAmountText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  payoutDetails: {
    gap: 4,
  },
  payoutDate: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  payoutRef: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontFamily: 'monospace',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.dark.textMuted,
  },
});
