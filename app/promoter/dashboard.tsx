import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, Calendar, Ticket, DollarSign, ChevronRight, CreditCard, Building2, Crown, Users, ScanLine } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';

interface PromoterStats {
  totalEarnings: number;
  pendingPayout: number;
  totalEvents: number;
  totalTicketsSold: number;
}

interface PromoterEvent {
  id: string;
  name: string;
  date: string;
  venue: string;
  ticketsSold: number;
  revenue: number;
  isActive: boolean;
}

export default function PromoterDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  
  const promotersQuery = trpc.promoters.list.useQuery();
  
  const currentPromoter = promotersQuery.data?.find(
    p => p.email.toLowerCase() === user?.email?.toLowerCase()
  );
  
  const [stats, setStats] = useState<PromoterStats>({
    totalEarnings: 0,
    pendingPayout: 0,
    totalEvents: 0,
    totalTicketsSold: 0,
  });
  
  const [events] = useState<PromoterEvent[]>([]);

  useEffect(() => {
    if (currentPromoter) {
      setStats({
        totalEarnings: currentPromoter.totalEarnings || 0,
        pendingPayout: currentPromoter.pendingPayout || 0,
        totalEvents: currentPromoter.eventCount || 0,
        totalTicketsSold: 0,
      });
    }
  }, [currentPromoter]);

  const loading = promotersQuery.isLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    await promotersQuery.refetch();
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
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
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
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Panel de Promotor</Text>
            <Text style={styles.subtitle}>Gestiona tus eventos y ganancias</Text>
          </View>
          <View style={styles.avatarContainer}>
            <Building2 color={Colors.dark.primary} size={24} />
          </View>
        </View>

        {stats.pendingPayout > 0 && (
          <View style={styles.balanceAlert}>
            <DollarSign color={Colors.dark.success} size={20} />
            <Text style={styles.balanceAlertText}>
              Tienes {formatCurrency(stats.pendingPayout)} pendiente de cobro
            </Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <LinearGradient
              colors={Colors.dark.gradient.primary as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statIconContainer}
            >
              <TrendingUp color="#FFF" size={20} />
            </LinearGradient>
            <Text style={styles.statValue}>{formatCurrency(stats.totalEarnings)}</Text>
            <Text style={styles.statLabel}>Ganancias totales</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: Colors.dark.success + '20' }]}>
              <DollarSign color={Colors.dark.success} size={20} />
            </View>
            <Text style={styles.statValue}>{formatCurrency(stats.pendingPayout)}</Text>
            <Text style={styles.statLabel}>Pendiente de pago</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: Colors.dark.secondary + '20' }]}>
              <Calendar color={Colors.dark.secondary} size={20} />
            </View>
            <Text style={styles.statValue}>{stats.totalEvents}</Text>
            <Text style={styles.statLabel}>Eventos</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: Colors.dark.accent + '20' }]}>
              <Ticket color={Colors.dark.accent} size={20} />
            </View>
            <Text style={styles.statValue}>{stats.totalTicketsSold}</Text>
            <Text style={styles.statLabel}>Entradas vendidas</Text>
          </View>
        </View>

        

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mis Eventos</Text>
            <TouchableOpacity onPress={() => router.push('/promoter/events' as any)}>
              <Text style={styles.seeAll}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          {events.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              onPress={() => router.push(`/promoter/event/${event.id}` as any)}
            >
              <View style={styles.eventInfo}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventName}>{event.name}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: event.isActive ? Colors.dark.success + '20' : Colors.dark.textMuted + '20' }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: event.isActive ? Colors.dark.success : Colors.dark.textMuted }
                    ]}>
                      {event.isActive ? 'Activo' : 'Finalizado'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.eventDate}>{formatDate(event.date)} • {event.venue}</Text>
                <View style={styles.eventStats}>
                  <View style={styles.eventStat}>
                    <Ticket color={Colors.dark.textMuted} size={14} />
                    <Text style={styles.eventStatText}>{event.ticketsSold} vendidas</Text>
                  </View>
                  <View style={styles.eventStat}>
                    <DollarSign color={Colors.dark.success} size={14} />
                    <Text style={[styles.eventStatText, { color: Colors.dark.success }]}>
                      {formatCurrency(event.revenue)}
                    </Text>
                  </View>
                </View>
              </View>
              <ChevronRight color={Colors.dark.textMuted} size={20} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acciones rápidas</Text>
          
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/promoter/payouts')}
            >
              <CreditCard color={Colors.dark.primary} size={24} />
              <Text style={styles.actionText}>Mis pagos</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/promoter/subscription' as any)}
            >
              <Crown color={Colors.dark.warning} size={24} />
              <Text style={styles.actionText}>Mi Suscripción</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.actionsGrid, { marginTop: 12 }]}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/promoter/scanners' as any)}
            >
              <Users color={Colors.dark.secondary} size={24} />
              <Text style={styles.actionText}>Personal Escaneo</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/scanner' as any)}
            >
              <ScanLine color={Colors.dark.accent} size={24} />
              <Text style={styles.actionText}>Escanear Entradas</Text>
            </TouchableOpacity>
          </View>
        </View>

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14,
    backgroundColor: Colors.dark.success + '15',
    borderRadius: 12,
  },
  balanceAlertText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.success,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  payoutCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  payoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  payoutInfo: {},
  payoutLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  payoutAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 4,
  },
  payoutAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  payoutActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  eventDate: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 10,
  },
  eventStats: {
    flexDirection: 'row',
    gap: 16,
  },
  eventStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventStatText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },
  actionsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
});
