import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ticket, Calendar, MapPin, User, Check, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

interface SellerSession {
  id: string;
  name: string;
  code: string;
  email: string;
}

interface SaleItem {
  id: string;
  eventName: string;
  eventDate: string;
  venue: string;
  tierName: string;
  buyerName: string;
  buyerEmail: string;
  price: number;
  sellerCommission: number;
  purchaseDate: string;
  isUsed: boolean;
}

export default function SellerHistoryScreen() {
  const router = useRouter();
  const [seller, setSeller] = useState<SellerSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    loadSellerSession();
  }, []);

  const loadSellerSession = async () => {
    try {
      const session = await AsyncStorage.getItem('seller_session');
      if (session) {
        setSeller(JSON.parse(session));
      } else {
        router.replace('/seller/login');
      }
    } catch (error) {
      console.log('Error loading seller session:', error);
      router.replace('/seller/login');
    } finally {
      setIsLoadingSession(false);
    }
  };

  const historyQuery = trpc.sellers.getSalesHistory.useQuery(
    { sellerId: seller?.id || '', limit: 100 },
    { enabled: !!seller?.id }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderSaleItem = ({ item }: { item: SaleItem }) => (
    <View style={styles.saleCard}>
      <View style={styles.saleHeader}>
        <View style={styles.eventBadge}>
          <Ticket color={Colors.dark.primary} size={16} />
          <Text style={styles.tierName}>{item.tierName}</Text>
        </View>
        <View style={[styles.statusBadge, item.isUsed ? styles.statusUsed : styles.statusPending]}>
          {item.isUsed ? (
            <Check color="#FFF" size={12} />
          ) : (
            <Clock color={Colors.dark.text} size={12} />
          )}
          <Text style={[styles.statusText, item.isUsed && styles.statusTextUsed]}>
            {item.isUsed ? 'Usada' : 'Pendiente'}
          </Text>
        </View>
      </View>

      <Text style={styles.eventName}>{item.eventName}</Text>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Calendar color={Colors.dark.textMuted} size={14} />
          <Text style={styles.detailText}>
            {new Date(item.eventDate).toLocaleDateString('es-ES')}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <MapPin color={Colors.dark.textMuted} size={14} />
          <Text style={styles.detailText} numberOfLines={1}>
            {item.venue}
          </Text>
        </View>
      </View>

      <View style={styles.buyerRow}>
        <User color={Colors.dark.textMuted} size={14} />
        <Text style={styles.buyerName}>{item.buyerName}</Text>
      </View>

      <View style={styles.priceRow}>
        <View>
          <Text style={styles.priceLabel}>Precio entrada</Text>
          <Text style={styles.priceValue}>{formatCurrency(item.price)}</Text>
        </View>
        <View style={styles.commissionBox}>
          <Text style={styles.commissionLabel}>Tu comisión</Text>
          <Text style={styles.commissionValue}>{formatCurrency(item.sellerCommission)}</Text>
        </View>
      </View>

      <Text style={styles.purchaseDate}>Vendida el {formatDate(item.purchaseDate)}</Text>
    </View>
  );

  if (isLoadingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  if (!seller) {
    return null;
  }

  const data = historyQuery.data;
  const isLoading = historyQuery.isLoading;

  const totalCommission = data?.tickets.reduce((sum: number, t: SaleItem) => sum + t.sellerCommission, 0) || 0;
  const totalSales = data?.tickets.length || 0;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Historial de Ventas',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
          <Text style={styles.loadingText}>Cargando historial...</Text>
        </View>
      ) : (
        <FlatList
          data={data?.tickets || []}
          renderItem={renderSaleItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={historyQuery.isRefetching}
              onRefresh={() => historyQuery.refetch()}
              tintColor={Colors.dark.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{totalSales}</Text>
                <Text style={styles.summaryLabel}>Ventas</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: Colors.dark.success }]}>
                  {formatCurrency(totalCommission)}
                </Text>
                <Text style={styles.summaryLabel}>Comisiones</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ticket color={Colors.dark.textMuted} size={48} />
              <Text style={styles.emptyTitle}>Sin ventas</Text>
              <Text style={styles.emptyText}>
                Aún no tienes ventas registradas. Comparte tu enlace de vendedor para empezar.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  listContent: {
    padding: 16,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.dark.border,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  saleCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tierName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusUsed: {
    backgroundColor: Colors.dark.success,
  },
  statusPending: {
    backgroundColor: Colors.dark.surface,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  statusTextUsed: {
    color: '#FFF',
  },
  eventName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  buyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    marginTop: 8,
  },
  buyerName: {
    fontSize: 14,
    color: Colors.dark.text,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  priceLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  commissionBox: {
    backgroundColor: Colors.dark.success + '15',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'flex-end',
  },
  commissionLabel: {
    fontSize: 11,
    color: Colors.dark.success,
    marginBottom: 2,
  },
  commissionValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.dark.success,
  },
  purchaseDate: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 12,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
