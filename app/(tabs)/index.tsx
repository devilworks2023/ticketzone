import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, Ticket, Euro, Clock, ChevronRight, Zap } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import Colors from '@/constants/colors';

export default function DashboardScreen() {
  const router = useRouter();
  const { events, getStats } = useApp();
  const stats = getStats();
  const activeEvents = events.filter(e => e.isActive);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={[Colors.dark.primary + '20', Colors.dark.background]}
        style={styles.headerGradient}
      >
        <Text style={styles.greeting}>Panel de Control</Text>
        <Text style={styles.subtitle}>Resumen de ventas y eventos</Text>
      </LinearGradient>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statCardLarge]}>
          <LinearGradient
            colors={Colors.dark.gradient.primary as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statGradient}
          >
            <View style={styles.statHeader}>
              <Euro color="#FFF" size={24} />
              <Text style={styles.statLabel}>Recaudación Total</Text>
            </View>
            <Text style={styles.statValueLarge}>{formatCurrency(stats.totalRevenue)}</Text>
            <View style={styles.statFooter}>
              <TrendingUp color="#FFF" size={16} />
              <Text style={styles.statChange}>+12% esta semana</Text>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.statRow}>
          <View style={[styles.statCard, styles.statCardSmall]}>
            <View style={styles.statIconContainer}>
              <Ticket color={Colors.dark.secondary} size={20} />
            </View>
            <Text style={styles.statValueSmall}>{stats.totalTicketsSold}</Text>
            <Text style={styles.statLabelSmall}>Entradas vendidas</Text>
          </View>

          <View style={[styles.statCard, styles.statCardSmall]}>
            <View style={[styles.statIconContainer, { backgroundColor: Colors.dark.success + '20' }]}>
              <Zap color={Colors.dark.success} size={20} />
            </View>
            <Text style={styles.statValueSmall}>{formatCurrency(stats.pendingWithdrawal)}</Text>
            <Text style={styles.statLabelSmall}>Disponible retiro</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={[styles.statCard, styles.statCardSmall]}>
            <View style={[styles.statIconContainer, { backgroundColor: Colors.dark.warning + '20' }]}>
              <Clock color={Colors.dark.warning} size={20} />
            </View>
            <Text style={styles.statValueSmall}>{stats.todayTickets}</Text>
            <Text style={styles.statLabelSmall}>Ventas hoy</Text>
          </View>

          <View style={[styles.statCard, styles.statCardSmall]}>
            <View style={[styles.statIconContainer, { backgroundColor: Colors.dark.accent + '20' }]}>
              <Euro color={Colors.dark.accent} size={20} />
            </View>
            <Text style={styles.statValueSmall}>{formatCurrency(stats.todayRevenue)}</Text>
            <Text style={styles.statLabelSmall}>Ingresos hoy</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Eventos Activos</Text>
          <TouchableOpacity onPress={() => router.push('/events')}>
            <Text style={styles.seeAll}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {activeEvents.slice(0, 3).map((event) => {
          const totalSold = event.ticketTiers.reduce((sum, t) => sum + t.sold, 0);
          const totalCapacity = event.ticketTiers.reduce((sum, t) => sum + t.quantity, 0);
          const progress = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0;

          return (
            <TouchableOpacity 
              key={event.id} 
              style={styles.eventCard}
              onPress={() => router.push(`/event/${event.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.eventInfo}>
                <Text style={styles.eventName}>{event.name}</Text>
                <Text style={styles.eventDate}>
                  {new Date(event.date).toLocaleDateString('es-ES', { 
                    weekday: 'short', 
                    day: 'numeric', 
                    month: 'short' 
                  })} • {event.time}
                </Text>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${progress}%` },
                        progress > 80 && { backgroundColor: Colors.dark.success }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>{totalSold}/{totalCapacity}</Text>
                </View>
              </View>
              <ChevronRight color={Colors.dark.textMuted} size={20} />
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/event/create')}
          >
            <LinearGradient
              colors={Colors.dark.gradient.primary as [string, string]}
              style={styles.actionGradient}
            >
              <Text style={styles.actionText}>+ Crear Evento</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/boxoffice')}
          >
            <LinearGradient
              colors={Colors.dark.gradient.secondary as [string, string]}
              style={styles.actionGradient}
            >
              <Text style={styles.actionText}>🎫 Taquilla</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  statsGrid: {
    paddingHorizontal: 16,
    marginTop: -10,
  },
  statCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statCardLarge: {
    marginBottom: 12,
  },
  statGradient: {
    padding: 20,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  statValueLarge: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  statFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statChange: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCardSmall: {
    flex: 1,
    padding: 16,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.dark.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValueSmall: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  statLabelSmall: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  seeAll: {
    fontSize: 14,
    color: Colors.dark.primary,
    fontWeight: '600',
  },
  eventCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.dark.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.dark.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'right',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
