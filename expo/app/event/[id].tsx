import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Clock, Trash2, Share2, Ticket, Bus, Crown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/contexts/AppContext';
import Colors from '@/constants/colors';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { events, deleteEvent, getEventTickets } = useApp();
  const event = events.find(e => e.id === id);
  const eventTickets = getEventTickets(id || '');

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Evento no encontrado</Text>
      </View>
    );
  }

  const totalSold = event.ticketTiers.reduce((sum, t) => sum + t.sold, 0);
  const totalCapacity = event.ticketTiers.reduce((sum, t) => sum + t.quantity, 0);
  const totalRevenue = event.ticketTiers.reduce((sum, t) => sum + (t.sold * t.price), 0);
  const progress = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar Evento',
      '¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteEvent(event.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          },
        },
      ]
    );
  };

  const handleShare = () => {
    const shareUrl = `https://tickets.app/event/${event.id}`;
    Alert.alert('Compartir', `URL para redes sociales:\n${shareUrl}`);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Stack.Screen 
        options={{ 
          headerTitle: '',
          headerTransparent: true,
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
                <Share2 color={Colors.dark.text} size={20} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                <Trash2 color={Colors.dark.error} size={20} />
              </TouchableOpacity>
            </View>
          ),
        }} 
      />

      <Image source={{ uri: event.image }} style={styles.heroImage} />
      <LinearGradient
        colors={['transparent', Colors.dark.background]}
        style={styles.imageGradient}
      />

      <View style={styles.content}>
        <View style={styles.statusBadge}>
          {event.isActive ? (
            <>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>VENTA ACTIVA</Text>
            </>
          ) : (
            <Text style={[styles.statusText, { color: Colors.dark.textMuted }]}>FINALIZADO</Text>
          )}
        </View>

        <Text style={styles.eventName}>{event.name}</Text>

        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Clock color={Colors.dark.secondary} size={18} />
            <Text style={styles.metaText}>
              {new Date(event.date).toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })} • {event.time}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <MapPin color={Colors.dark.secondary} size={18} />
            <Text style={styles.metaText}>{event.venue}, {event.location}</Text>
          </View>
        </View>

        <Text style={styles.description}>{event.description}</Text>

        <View style={styles.statsCard}>
          <LinearGradient
            colors={Colors.dark.gradient.primary as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statsGradient}
          >
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalSold}</Text>
                <Text style={styles.statLabel}>Vendidas</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalCapacity}</Text>
                <Text style={styles.statLabel}>Capacidad</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatCurrency(totalRevenue)}</Text>
                <Text style={styles.statLabel}>Recaudado</Text>
              </View>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>{progress.toFixed(0)}% vendido</Text>
            </View>
          </LinearGradient>
        </View>

        <Text style={styles.sectionTitle}>Tipos de Entrada</Text>
        {event.ticketTiers.map((tier) => {
          const tierProgress = tier.quantity > 0 ? (tier.sold / tier.quantity) * 100 : 0;
          const available = tier.quantity - tier.sold;

          return (
            <View key={tier.id} style={styles.tierCard}>
              <View style={styles.tierHeader}>
                <View style={styles.tierTitleRow}>
                  {tier.isVip && <Crown color={Colors.dark.warning} size={16} />}
                  {tier.includesBus && <Bus color={Colors.dark.secondary} size={16} />}
                  <Text style={styles.tierName}>{tier.name}</Text>
                </View>
                <Text style={styles.tierPrice}>{formatCurrency(tier.price)}</Text>
              </View>
              <Text style={styles.tierDescription}>{tier.description}</Text>
              <View style={styles.tierStats}>
                <View style={styles.tierProgressBar}>
                  <View 
                    style={[
                      styles.tierProgressFill, 
                      { width: `${tierProgress}%` },
                      available === 0 && { backgroundColor: Colors.dark.error }
                    ]} 
                  />
                </View>
                <Text style={[styles.tierAvailable, available === 0 && { color: Colors.dark.error }]}>
                  {available === 0 ? 'AGOTADAS' : `${available} disponibles`}
                </Text>
              </View>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Últimas Ventas</Text>
        {eventTickets.slice(0, 5).map((ticket) => (
          <View key={ticket.id} style={styles.ticketItem}>
            <View style={styles.ticketIcon}>
              <Ticket color={Colors.dark.primary} size={18} />
            </View>
            <View style={styles.ticketInfo}>
              <Text style={styles.ticketName}>{ticket.buyerName}</Text>
              <Text style={styles.ticketDate}>
                {new Date(ticket.purchaseDate).toLocaleDateString('es-ES')}
              </Text>
            </View>
            <Text style={styles.ticketPrice}>{formatCurrency(ticket.price)}</Text>
          </View>
        ))}

        {eventTickets.length === 0 && (
          <View style={styles.emptyTickets}>
            <Text style={styles.emptyText}>Aún no hay ventas</Text>
          </View>
        )}

        <TouchableOpacity 
          style={styles.purchaseButton}
          onPress={() => router.push(`/purchase/${event.id}`)}
        >
          <LinearGradient
            colors={Colors.dark.gradient.primary as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.purchaseGradient}
          >
            <Text style={styles.purchaseButtonText}>Comprar Entradas</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  errorText: {
    color: Colors.dark.error,
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface + 'CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    height: 280,
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 200,
    height: 100,
  },
  content: {
    padding: 20,
    marginTop: -20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.success,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.success,
    letterSpacing: 1,
  },
  eventName: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  metaContainer: {
    gap: 10,
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  description: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  statsCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 28,
  },
  statsGradient: {
    padding: 20,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 14,
  },
  tierCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  tierPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.dark.primary,
  },
  tierDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  tierStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tierProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tierProgressFill: {
    height: '100%',
    backgroundColor: Colors.dark.success,
    borderRadius: 2,
  },
  tierAvailable: {
    fontSize: 12,
    color: Colors.dark.success,
    fontWeight: '600',
  },
  ticketItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  ticketIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ticketInfo: {
    flex: 1,
  },
  ticketName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  ticketDate: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  ticketPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.success,
  },
  emptyTickets: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  purchaseButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 20,
  },
  purchaseGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  purchaseButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
});
