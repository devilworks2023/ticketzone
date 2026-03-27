import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Calendar,
  MapPin,
  Clock,
  Ticket,
  Eye,
  Trash2,
  Users,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function AdminEventsManageScreen() {
  const eventsQuery = trpc.events.list.useQuery();
  const deleteEventMutation = trpc.events.delete.useMutation();
  const toggleEventMutation = (trpc.events as any).toggleActive.useMutation();

  const events = eventsQuery.data || [];

  const handleToggleActive = async (eventId: string, currentStatus: boolean) => {
    try {
      await toggleEventMutation.mutateAsync({ id: eventId, isActive: !currentStatus });
      eventsQuery.refetch();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar el evento');
    }
  };

  const handleDelete = (event: any) => {
    Alert.alert(
      'Eliminar Evento',
      `¿Estás seguro de eliminar "${event.name}"? Esta acción eliminará también todas las entradas asociadas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEventMutation.mutateAsync({ id: event.id });
              Alert.alert('Éxito', 'Evento eliminado');
              eventsQuery.refetch();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const getTotalTickets = (tiers: any[]) => {
    return tiers?.reduce((sum, tier) => sum + (tier.quantity || 0), 0) || 0;
  };

  const getSoldTickets = (tiers: any[]) => {
    return tiers?.reduce((sum, tier) => sum + (tier.sold || 0), 0) || 0;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Gestión de Eventos',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Todos los Eventos</Text>
          <Text style={styles.headerSubtitle}>{events.length} eventos en total</Text>
        </View>

        {eventsQuery.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : events.length === 0 ? (
          <View style={styles.emptyState}>
            <Calendar color={Colors.dark.textMuted} size={48} />
            <Text style={styles.emptyTitle}>No hay eventos</Text>
            <Text style={styles.emptyText}>Los eventos creados aparecerán aquí</Text>
          </View>
        ) : (
          events.map((event) => (
            <View key={event.id} style={[styles.eventCard, !event.isActive && styles.eventCardInactive]}>
              <View style={styles.eventImageContainer}>
                {event.image ? (
                  <Image source={{ uri: event.image }} style={styles.eventImage} />
                ) : (
                  <View style={styles.eventImagePlaceholder}>
                    <Calendar color={Colors.dark.textMuted} size={32} />
                  </View>
                )}
                {!event.isActive && (
                  <View style={styles.inactiveOverlay}>
                    <Text style={styles.inactiveText}>INACTIVO</Text>
                  </View>
                )}
              </View>

              <View style={styles.eventContent}>
                <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
                
                <View style={styles.eventDetails}>
                  <View style={styles.eventDetailRow}>
                    <Calendar color={Colors.dark.textMuted} size={14} />
                    <Text style={styles.eventDetailText}>{formatDate(event.date)}</Text>
                  </View>
                  <View style={styles.eventDetailRow}>
                    <Clock color={Colors.dark.textMuted} size={14} />
                    <Text style={styles.eventDetailText}>{event.time}</Text>
                  </View>
                  <View style={styles.eventDetailRow}>
                    <MapPin color={Colors.dark.textMuted} size={14} />
                    <Text style={styles.eventDetailText} numberOfLines={1}>{event.venue}</Text>
                  </View>
                </View>

                <View style={styles.eventStats}>
                  <View style={styles.statItem}>
                    <Ticket color={Colors.dark.primary} size={14} />
                    <Text style={styles.statText}>
                      {getSoldTickets(event.ticketTiers)}/{getTotalTickets(event.ticketTiers)} vendidas
                    </Text>
                  </View>
                  {event.promoterName && (
                    <View style={styles.statItem}>
                      <Users color={Colors.dark.secondary} size={14} />
                      <Text style={styles.statText}>{event.promoterName}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.eventActions}>
                  <View style={styles.toggleContainer}>
                    <Text style={styles.toggleLabel}>Activo</Text>
                    <Switch
                      value={event.isActive}
                      onValueChange={() => handleToggleActive(event.id, event.isActive)}
                      trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
                      thumbColor="#FFF"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => router.push(`/event/${event.id}`)}
                  >
                    <Eye color={Colors.dark.primary} size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDelete(event)}
                  >
                    <Trash2 color={Colors.dark.error} size={18} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
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
  header: {
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginTop: 4,
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
  },
  eventCard: {
    backgroundColor: Colors.dark.card,
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    overflow: 'hidden',
  },
  eventCardInactive: {
    opacity: 0.7,
  },
  eventImageContainer: {
    height: 120,
    position: 'relative',
  },
  eventImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  eventImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 2,
  },
  eventContent: {
    padding: 14,
  },
  eventName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 10,
  },
  eventDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventDetailText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    maxWidth: 120,
  },
  eventStats: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  eventActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  actionButton: {
    padding: 10,
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
  },
  deleteButton: {
    backgroundColor: Colors.dark.error + '15',
  },
  bottomPadding: {
    height: 40,
  },
});
