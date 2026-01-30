import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { Plus, MapPin, Clock, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import Colors from '@/constants/colors';

export default function EventsScreen() {
  const router = useRouter();
  const { events } = useApp();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const renderEvent = ({ item }: { item: typeof events[0] }) => {
    const totalSold = item.ticketTiers.reduce((sum, t) => sum + t.sold, 0);
    const totalCapacity = item.ticketTiers.reduce((sum, t) => sum + t.quantity, 0);
    const totalRevenue = item.ticketTiers.reduce((sum, t) => sum + (t.sold * t.price), 0);
    const progress = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0;

    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => router.push(`/event/${item.id}`)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: item.image }} style={styles.eventImage} />
        <View style={styles.eventOverlay}>
          {item.isActive ? (
            <View style={styles.activeTag}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>ACTIVO</Text>
            </View>
          ) : (
            <View style={[styles.activeTag, { backgroundColor: Colors.dark.textMuted + '90' }]}>
              <Text style={styles.activeText}>FINALIZADO</Text>
            </View>
          )}
        </View>
        
        <View style={styles.eventContent}>
          <Text style={styles.eventName}>{item.name}</Text>
          
          <View style={styles.eventMeta}>
            <View style={styles.metaItem}>
              <Clock color={Colors.dark.secondary} size={14} />
              <Text style={styles.metaText}>
                {new Date(item.date).toLocaleDateString('es-ES', { 
                  day: 'numeric', 
                  month: 'short' 
                })} • {item.time}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <MapPin color={Colors.dark.secondary} size={14} />
              <Text style={styles.metaText} numberOfLines={1}>{item.venue}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Users color={Colors.dark.textMuted} size={16} />
              <Text style={styles.statText}>{totalSold}/{totalCapacity}</Text>
            </View>
            <Text style={styles.revenueText}>{formatCurrency(totalRevenue)}</Text>
          </View>

          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${progress}%` },
                progress > 80 && { backgroundColor: Colors.dark.success },
                progress > 95 && { backgroundColor: Colors.dark.warning }
              ]} 
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        renderItem={renderEvent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Mis Eventos</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => router.push('/event/create')}
            >
              <Plus color="#FFF" size={20} />
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyTitle}>Sin eventos</Text>
            <Text style={styles.emptyText}>Crea tu primer evento para empezar a vender entradas</Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => router.push('/event/create')}
            >
              <Text style={styles.emptyButtonText}>Crear Evento</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  listContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  eventImage: {
    width: '100%',
    height: 140,
  },
  eventOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.success + '90',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  activeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  eventContent: {
    padding: 16,
  },
  eventName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 10,
  },
  eventMeta: {
    gap: 6,
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  revenueText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.success,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.dark.primary,
    borderRadius: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
