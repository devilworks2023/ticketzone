import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Ticket,
  Search,
  Calendar,
  User,
  Mail,
  CheckCircle,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

interface TicketData {
  id: string;
  eventId: string;
  eventName: string;
  tierId: string;
  tierName: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  qrCode: string;
  purchaseDate: string;
  sellerId: string | null;
  sellerName: string | null;
  sellerCode: string | null;
  isUsed: boolean;
  usedAt: string | null;
  paymentMethod: string;
  price: number;
  platformFee: number;
  promoterAmount: number;
}

export default function AdminTicketsManageScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUsed, setFilterUsed] = useState<'all' | 'used' | 'unused'>('all');

  const ticketsQuery = (trpc.tickets as any).listAll.useQuery();
  const deleteTicketMutation = (trpc.tickets as any).delete.useMutation();
  const tickets: TicketData[] = ticketsQuery.data || [];

  const handleDeleteTicket = (ticket: TicketData) => {
    Alert.alert(
      'Eliminar Entrada',
      `¿Estás seguro de eliminar la entrada de ${ticket.buyerName}?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTicketMutation.mutateAsync({ id: ticket.id });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              ticketsQuery.refetch();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar la entrada');
            }
          },
        },
      ]
    );
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch = 
      ticket.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.buyerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.eventName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.qrCode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = 
      filterUsed === 'all' ||
      (filterUsed === 'used' && ticket.isUsed) ||
      (filterUsed === 'unused' && !ticket.isUsed);

    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const usedCount = tickets.filter((t: TicketData) => t.isUsed).length;
  const unusedCount = tickets.filter((t: TicketData) => !t.isUsed).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Entradas Vendidas',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search color={Colors.dark.textMuted} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre, email, evento..."
            placeholderTextColor={Colors.dark.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filterUsed === 'all' && styles.filterButtonActive]}
          onPress={() => setFilterUsed('all')}
        >
          <Text style={[styles.filterText, filterUsed === 'all' && styles.filterTextActive]}>
            Todas ({tickets.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterUsed === 'unused' && styles.filterButtonActive]}
          onPress={() => setFilterUsed('unused')}
        >
          <Text style={[styles.filterText, filterUsed === 'unused' && styles.filterTextActive]}>
            Sin usar ({unusedCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterUsed === 'used' && styles.filterButtonActive]}
          onPress={() => setFilterUsed('used')}
        >
          <Text style={[styles.filterText, filterUsed === 'used' && styles.filterTextActive]}>
            Usadas ({usedCount})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {ticketsQuery.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : filteredTickets.length === 0 ? (
          <View style={styles.emptyState}>
            <Ticket color={Colors.dark.textMuted} size={48} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'Sin resultados' : 'No hay entradas'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery 
                ? 'Intenta con otros términos de búsqueda'
                : 'Las entradas vendidas aparecerán aquí'}
            </Text>
          </View>
        ) : (
          filteredTickets.map((ticket: TicketData) => (
            <View key={ticket.id} style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <View style={[
                  styles.statusBadge,
                  ticket.isUsed ? styles.statusUsed : styles.statusUnused
                ]}>
                  {ticket.isUsed ? (
                    <CheckCircle color={Colors.dark.textMuted} size={14} />
                  ) : (
                    <Ticket color={Colors.dark.success} size={14} />
                  )}
                  <Text style={[
                    styles.statusText,
                    ticket.isUsed ? styles.statusTextUsed : styles.statusTextUnused
                  ]}>
                    {ticket.isUsed ? 'Usada' : 'Válida'}
                  </Text>
                </View>
                <Text style={styles.ticketPrice}>{formatCurrency(ticket.price)}</Text>
              </View>

              <Text style={styles.eventName} numberOfLines={1}>{ticket.eventName}</Text>
              <Text style={styles.tierName}>{ticket.tierName}</Text>

              <View style={styles.buyerInfo}>
                <View style={styles.infoRow}>
                  <User color={Colors.dark.textMuted} size={14} />
                  <Text style={styles.infoText}>{ticket.buyerName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Mail color={Colors.dark.textMuted} size={14} />
                  <Text style={styles.infoText}>{ticket.buyerEmail}</Text>
                </View>
              </View>

              <View style={styles.ticketFooter}>
                <View style={styles.infoRow}>
                  <Calendar color={Colors.dark.textMuted} size={14} />
                  <Text style={styles.dateText}>{formatDate(ticket.purchaseDate)}</Text>
                </View>
                <Text style={styles.qrCode}>#{ticket.qrCode.slice(-8)}</Text>
              </View>

              {ticket.sellerCode && (
                <View style={styles.sellerInfo}>
                  <Text style={styles.sellerLabel}>Vendedor:</Text>
                  <Text style={styles.sellerCode}>{ticket.sellerCode}</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteTicket(ticket)}
              >
                <Trash2 color={Colors.dark.error} size={16} />
                <Text style={styles.deleteButtonText}>Eliminar</Text>
              </TouchableOpacity>
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
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.dark.text,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.dark.surface,
  },
  filterButtonActive: {
    backgroundColor: Colors.dark.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  filterTextActive: {
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
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
    textAlign: 'center',
  },
  ticketCard: {
    backgroundColor: Colors.dark.card,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 14,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusUsed: {
    backgroundColor: Colors.dark.textMuted + '20',
  },
  statusUnused: {
    backgroundColor: Colors.dark.success + '20',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextUsed: {
    color: Colors.dark.textMuted,
  },
  statusTextUnused: {
    color: Colors.dark.success,
  },
  ticketPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  tierName: {
    fontSize: 13,
    color: Colors.dark.secondary,
    marginBottom: 12,
  },
  buyerInfo: {
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  dateText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  qrCode: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.primary,
    fontFamily: 'monospace',
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  sellerLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  sellerCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9b59b6',
  },
  bottomPadding: {
    height: 40,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: Colors.dark.error + '15',
    borderRadius: 8,
  },
  deleteButtonText: {
    color: Colors.dark.error,
    fontSize: 13,
    fontWeight: '600',
  },
});
