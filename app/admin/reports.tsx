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
  BarChart3,
  TrendingUp,
  Ticket,
  Calendar,
  Users,
  DollarSign,
  Building2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function AdminReportsScreen() {
  const statsQuery = trpc.stats.getDashboardStats.useQuery();
  const subscriptionStatsQuery = trpc.subscriptions.getSubscriptionStats.useQuery();
  const promotersQuery = trpc.promoters.list.useQuery();
  const sellersQuery = trpc.sellers.list.useQuery();

  const stats = statsQuery.data;
  const subscriptionStats = subscriptionStatsQuery.data;
  const promoters = promotersQuery.data || [];
  const sellers = sellersQuery.data || [];

  const isLoading = statsQuery.isLoading || subscriptionStatsQuery.isLoading;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const totalPromoterRevenue = promoters.reduce((sum, p) => sum + (p.totalEarnings || 0), 0);
  const totalSellerSales = sellers.reduce((sum, s) => sum + (s.totalSales || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Reportes Financieros',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <BarChart3 color={Colors.dark.primary} size={24} />
              <Text style={styles.headerTitle}>Resumen General</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ventas de Entradas</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: Colors.dark.primary + '20' }]}>
                    <Ticket color={Colors.dark.primary} size={22} />
                  </View>
                  <Text style={styles.statValue}>{stats?.totalTicketsSold || 0}</Text>
                  <Text style={styles.statLabel}>Entradas vendidas</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: Colors.dark.success + '20' }]}>
                    <TrendingUp color={Colors.dark.success} size={22} />
                  </View>
                  <Text style={[styles.statValue, { color: Colors.dark.success }]}>
                    {formatCurrency(stats?.totalRevenue || 0)}
                  </Text>
                  <Text style={styles.statLabel}>Ingresos totales</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Suscripciones</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: Colors.dark.secondary + '20' }]}>
                    <Users color={Colors.dark.secondary} size={22} />
                  </View>
                  <Text style={styles.statValue}>{subscriptionStats?.activeSubscriptions || 0}</Text>
                  <Text style={styles.statLabel}>Suscriptores activos</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: Colors.dark.warning + '20' }]}>
                    <DollarSign color={Colors.dark.warning} size={22} />
                  </View>
                  <Text style={[styles.statValue, { color: Colors.dark.warning }]}>
                    {formatCurrency(subscriptionStats?.monthlyRevenue || 0)}
                  </Text>
                  <Text style={styles.statLabel}>Ingresos mensuales</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Eventos</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: '#e74c3c20' }]}>
                    <Calendar color="#e74c3c" size={22} />
                  </View>
                  <Text style={styles.statValue}>{stats?.activeEvents || 0}</Text>
                  <Text style={styles.statLabel}>Eventos activos</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: '#9b59b620' }]}>
                    <Calendar color="#9b59b6" size={22} />
                  </View>
                  <Text style={styles.statValue}>{stats?.totalEvents || 0}</Text>
                  <Text style={styles.statLabel}>Total eventos</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Red de Usuarios</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: Colors.dark.secondary + '20' }]}>
                    <Building2 color={Colors.dark.secondary} size={22} />
                  </View>
                  <Text style={styles.statValue}>{promoters.length}</Text>
                  <Text style={styles.statLabel}>Promotores</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: '#9b59b620' }]}>
                    <Users color="#9b59b6" size={22} />
                  </View>
                  <Text style={styles.statValue}>{sellers.length}</Text>
                  <Text style={styles.statLabel}>Vendedores</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rendimiento</Text>
              <View style={styles.performanceCard}>
                <View style={styles.performanceRow}>
                  <Text style={styles.performanceLabel}>Ingresos por promotores</Text>
                  <Text style={styles.performanceValue}>{formatCurrency(totalPromoterRevenue)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.performanceRow}>
                  <Text style={styles.performanceLabel}>Ventas por vendedores</Text>
                  <Text style={styles.performanceValue}>{totalSellerSales} entradas</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.performanceRow}>
                  <Text style={styles.performanceLabel}>Ticket promedio</Text>
                  <Text style={styles.performanceValue}>
                    {stats?.totalTicketsSold 
                      ? formatCurrency((stats?.totalRevenue || 0) / stats.totalTicketsSold)
                      : '€0,00'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.bottomPadding} />
          </>
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
  loading: {
    padding: 60,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  performanceCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  performanceLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  performanceValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  bottomPadding: {
    height: 40,
  },
});
