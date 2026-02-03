import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TrendingUp,
  Calendar,
  Clock,
  DollarSign,
  ChevronRight,
  LogOut,
  Ticket,
  Award,
  BarChart3,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

const { width } = Dimensions.get('window');

interface SellerSession {
  id: string;
  name: string;
  code: string;
  email: string;
}

export default function SellerDashboardScreen() {
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

  const dashboardQuery = trpc.sellers.getDashboard.useQuery(
    { sellerId: seller?.id || '' },
    { enabled: !!seller?.id, refetchInterval: 30000 }
  );

  const handleLogout = async () => {
    await AsyncStorage.removeItem('seller_session');
    router.replace('/seller/login');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

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

  const data = dashboardQuery.data;
  const isLoading = dashboardQuery.isLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={dashboardQuery.isRefetching}
            onRefresh={() => dashboardQuery.refetch()}
            tintColor={Colors.dark.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>¡Hola, {seller.name}!</Text>
            <Text style={styles.code}>Código: {seller.code}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut color={Colors.dark.textMuted} size={20} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
            <Text style={styles.loadingText}>Cargando estadísticas...</Text>
          </View>
        ) : data ? (
          <>
            <View style={styles.commissionBadge}>
              <Award color={Colors.dark.primary} size={24} />
              <View style={styles.commissionInfo}>
                <Text style={styles.commissionLabel}>Comisión Actual</Text>
                <Text style={styles.commissionValue}>{data.currentCommissionPercent}%</Text>
              </View>
              {data.nextTier && (
                <View style={styles.nextTierInfo}>
                  <Text style={styles.nextTierLabel}>
                    {data.nextTier.salesNeeded} ventas para {data.nextTier.percentage}%
                  </Text>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, ((data.seller.totalSales % (data.nextTier.minSales || 1)) / (data.nextTier.minSales || 1)) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, styles.statCardPrimary]}>
                <View style={styles.statIcon}>
                  <Calendar color="#FFF" size={20} />
                </View>
                <Text style={styles.statLabel}>Hoy</Text>
                <Text style={styles.statValue}>{data.stats.today.sales}</Text>
                <Text style={styles.statCommission}>
                  {formatCurrency(data.stats.today.commission)}
                </Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: Colors.dark.secondary + '20' }]}>
                  <Clock color={Colors.dark.secondary} size={20} />
                </View>
                <Text style={styles.statLabel}>Esta Semana</Text>
                <Text style={styles.statValue}>{data.stats.week.sales}</Text>
                <Text style={styles.statCommission}>
                  {formatCurrency(data.stats.week.commission)}
                </Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: Colors.dark.accent + '20' }]}>
                  <BarChart3 color={Colors.dark.accent} size={20} />
                </View>
                <Text style={styles.statLabel}>Este Mes</Text>
                <Text style={styles.statValue}>{data.stats.month.sales}</Text>
                <Text style={styles.statCommission}>
                  {formatCurrency(data.stats.month.commission)}
                </Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: Colors.dark.success + '20' }]}>
                  <TrendingUp color={Colors.dark.success} size={20} />
                </View>
                <Text style={styles.statLabel}>Total</Text>
                <Text style={styles.statValue}>{data.stats.total.sales}</Text>
                <Text style={styles.statCommission}>
                  {formatCurrency(data.stats.total.commission)}
                </Text>
              </View>
            </View>

            <View style={styles.earningsCard}>
              <View style={styles.earningsHeader}>
                <DollarSign color={Colors.dark.success} size={28} />
                <View>
                  <Text style={styles.earningsLabel}>Comisiones Totales Ganadas</Text>
                  <Text style={styles.earningsValue}>
                    {formatCurrency(data.stats.total.commission)}
                  </Text>
                </View>
              </View>
              <View style={styles.earningsRow}>
                <View style={styles.earningsItem}>
                  <Text style={styles.earningsItemLabel}>Ingresos Generados</Text>
                  <Text style={styles.earningsItemValue}>
                    {formatCurrency(data.stats.total.revenue)}
                  </Text>
                </View>
                <View style={styles.earningsDivider} />
                <View style={styles.earningsItem}>
                  <Text style={styles.earningsItemLabel}>Ventas Totales</Text>
                  <Text style={styles.earningsItemValue}>{data.stats.total.sales}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Ventas por Evento</Text>
                <TouchableOpacity onPress={() => router.push('/seller/history')}>
                  <Text style={styles.seeAllButton}>Ver historial</Text>
                </TouchableOpacity>
              </View>

              {data.salesByEvent.length === 0 ? (
                <View style={styles.emptyEvents}>
                  <Ticket color={Colors.dark.textMuted} size={40} />
                  <Text style={styles.emptyText}>No hay ventas registradas</Text>
                  <Text style={styles.emptySubtext}>
                    Comparte tu enlace de vendedor para empezar a generar ventas
                  </Text>
                </View>
              ) : (
                data.salesByEvent.slice(0, 5).map((event: { id: string; eventName: string; eventDate: string; venue: string; ticketsSold: number; commission: number }) => (
                  <View key={event.id} style={styles.eventCard}>
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventName}>{event.eventName}</Text>
                      <Text style={styles.eventDetails}>
                        {new Date(event.eventDate).toLocaleDateString('es-ES')} • {event.venue}
                      </Text>
                    </View>
                    <View style={styles.eventStats}>
                      <Text style={styles.eventSales}>{event.ticketsSold} entradas</Text>
                      <Text style={styles.eventCommission}>
                        {formatCurrency(event.commission)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tramos de Comisión</Text>
              <View style={styles.tiersContainer}>
                {data.commissionTiers.map((tier: { minSales: number; maxSales: number | null; percentage: number }, index: number) => {
                  const isCurrentTier =
                    data.seller.totalSales >= tier.minSales &&
                    (tier.maxSales === null || data.seller.totalSales < tier.maxSales);

                  return (
                    <View
                      key={index}
                      style={[styles.tierCard, isCurrentTier && styles.tierCardActive]}
                    >
                      <View style={styles.tierInfo}>
                        <Text style={[styles.tierRange, isCurrentTier && styles.tierTextActive]}>
                          {tier.minSales} - {tier.maxSales ?? '∞'} ventas
                        </Text>
                        {isCurrentTier && (
                          <View style={styles.currentBadge}>
                            <Text style={styles.currentBadgeText}>ACTUAL</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.tierPercent, isCurrentTier && styles.tierTextActive]}>
                        {tier.percentage}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => router.push('/seller/history')}
            >
              <View style={styles.historyButtonContent}>
                <Ticket color={Colors.dark.primary} size={24} />
                <View style={styles.historyButtonText}>
                  <Text style={styles.historyButtonTitle}>Historial de Ventas</Text>
                  <Text style={styles.historyButtonSubtitle}>
                    Ver todas tus ventas detalladas
                  </Text>
                </View>
              </View>
              <ChevronRight color={Colors.dark.textMuted} size={20} />
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </>
        ) : (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>Error al cargar datos</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => dashboardQuery.refetch()}
            >
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  code: {
    fontSize: 14,
    color: Colors.dark.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  commissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.primary + '15',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.primary + '30',
  },
  commissionInfo: {
    flex: 1,
    marginLeft: 14,
  },
  commissionLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  commissionValue: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark.primary,
  },
  nextTierInfo: {
    alignItems: 'flex-end',
  },
  nextTierLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: 6,
  },
  progressBar: {
    width: 80,
    height: 6,
    backgroundColor: Colors.dark.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.dark.primary,
    borderRadius: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: (width - 52) / 2,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
  },
  statCardPrimary: {
    backgroundColor: Colors.dark.primary,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  statCommission: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.success,
    marginTop: 4,
  },
  earningsCard: {
    backgroundColor: Colors.dark.card,
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  earningsLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  earningsValue: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.dark.success,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningsItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningsDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.dark.border,
  },
  earningsItemLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: 4,
  },
  earningsItemValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  seeAllButton: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  emptyEvents: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  eventCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  eventDetails: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  eventStats: {
    alignItems: 'flex-end',
  },
  eventSales: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  eventCommission: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.success,
    marginTop: 2,
  },
  tiersContainer: {
    gap: 10,
    marginTop: 10,
  },
  tierCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tierCardActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + '10',
  },
  tierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tierRange: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  tierPercent: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  tierTextActive: {
    color: Colors.dark.primary,
  },
  currentBadge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.card,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
  },
  historyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  historyButtonText: {
    flex: 1,
  },
  historyButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  historyButtonSubtitle: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  errorState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: Colors.dark.error,
  },
  retryButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});
