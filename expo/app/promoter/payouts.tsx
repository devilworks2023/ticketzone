import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { DollarSign, Clock, CheckCircle, XCircle, Filter, ExternalLink, Wallet } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';

interface Payout {
  id: string;
  amount: number;
  status: 'completed' | 'pending' | 'processing' | 'failed';
  createdAt: string;
  completedAt?: string;
  stripeTransferId?: string;
}

export default function PayoutsScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
  
  const promotersQuery = trpc.promoters.list.useQuery();
  const currentPromoter = promotersQuery.data?.find(
    p => p.email.toLowerCase() === user?.email?.toLowerCase()
  );

  const payoutsQuery = trpc.payments.getPromoterPayouts.useQuery(
    { promoterId: currentPromoter?.id || '' },
    { enabled: !!currentPromoter?.id }
  );

  const connectStatusQuery = trpc.payments.checkConnectStatus.useQuery(
    { promoterId: currentPromoter?.id || '' },
    { enabled: !!currentPromoter?.id }
  );

  const dashboardLinkQuery = trpc.payments.getConnectDashboardLink.useQuery(
    { promoterId: currentPromoter?.id || '' },
    { enabled: !!currentPromoter?.id && connectStatusQuery.data?.status === 'active' }
  );

  const createPayoutMutation = trpc.payments.createPayout.useMutation({
    onSuccess: () => {
      Alert.alert('Éxito', 'Pago solicitado correctamente');
      payoutsQuery.refetch();
      promotersQuery.refetch();
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const payouts: Payout[] = payoutsQuery.data?.map(p => ({
    id: p.id,
    amount: p.amount,
    status: p.status as Payout['status'],
    createdAt: p.createdAt,
    completedAt: p.completedAt || undefined,
    stripeTransferId: p.stripeTransferId || undefined,
  })) || [];

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      payoutsQuery.refetch(),
      promotersQuery.refetch(),
      connectStatusQuery.refetch(),
    ]);
    setRefreshing(false);
  };

  const handleRequestPayout = () => {
    if (!currentPromoter) return;
    
    const pendingAmount = currentPromoter.pendingPayout || 0;
    if (pendingAmount <= 0) {
      Alert.alert('Info', 'No tienes saldo pendiente para retirar');
      return;
    }

    if (connectStatusQuery.data?.status !== 'active') {
      Alert.alert('Error', 'Necesitas conectar tu cuenta de Stripe primero');
      return;
    }

    Alert.alert(
      'Solicitar pago',
      `¿Deseas solicitar el pago de ${formatCurrency(pendingAmount)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Solicitar',
          onPress: () => {
            createPayoutMutation.mutate({
              promoterId: currentPromoter.id,
              amount: pendingAmount,
            });
          },
        },
      ]
    );
  };

  const handleOpenStripeDashboard = async () => {
    if (dashboardLinkQuery.data?.url) {
      if (Platform.OS === 'web') {
        window.open(dashboardLinkQuery.data.url, '_blank');
      } else {
        await Linking.openURL(dashboardLinkQuery.data.url);
      }
    }
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
  const availableForPayout = currentPromoter?.pendingPayout || 0;

  const loading = promotersQuery.isLoading || payoutsQuery.isLoading;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

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
            <View style={[styles.summaryIcon, { backgroundColor: Colors.dark.primary + '20' }]}>
              <Wallet color={Colors.dark.primary} size={20} />
            </View>
            <Text style={styles.summaryLabel}>Disponible</Text>
            <Text style={styles.summaryValue}>{formatCurrency(availableForPayout)}</Text>
          </View>
        </View>

        {availableForPayout > 0 && connectStatusQuery.data?.status === 'active' && (
          <TouchableOpacity
            style={styles.payoutButton}
            onPress={handleRequestPayout}
            disabled={createPayoutMutation.isPending}
          >
            <LinearGradient
              colors={Colors.dark.gradient.primary as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.payoutButtonGradient}
            >
              {createPayoutMutation.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <DollarSign color="#FFF" size={20} />
                  <Text style={styles.payoutButtonText}>Solicitar pago de {formatCurrency(availableForPayout)}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {connectStatusQuery.data?.status === 'active' && dashboardLinkQuery.data?.url && (
          <TouchableOpacity
            style={styles.stripeDashboardButton}
            onPress={handleOpenStripeDashboard}
          >
            <ExternalLink color={Colors.dark.primary} size={18} />
            <Text style={styles.stripeDashboardText}>Abrir panel de Stripe</Text>
          </TouchableOpacity>
        )}

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
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutButton: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  payoutButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  payoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  stripeDashboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: Colors.dark.primary + '15',
    borderRadius: 12,
  },
  stripeDashboardText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
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
