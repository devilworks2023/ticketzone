import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { 
  Ticket, 
  Search, 
  Calendar, 
  MapPin, 
  Clock, 
  ChevronRight,
  ArrowLeft,
  QrCode,
} from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

export default function BuyerScreen() {
  const { events, tickets } = useApp();
  const { buyerEmail, saveBuyerEmail } = useAuth();
  const [email, setEmail] = useState(buyerEmail || '');
  const [showPurchases, setShowPurchases] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeEvents = events.filter(e => e.isActive);
  const filteredEvents = activeEvents.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.venue.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const myTickets = tickets.filter(t => 
    t.buyerEmail.toLowerCase() === email.toLowerCase()
  );

  const handleViewPurchases = () => {
    if (!email.trim()) {
      Alert.alert('Email requerido', 'Ingresa el email con el que compraste tus entradas');
      return;
    }
    saveBuyerEmail(email.trim());
    setShowPurchases(true);
  };

  const handleBuyTickets = (eventId: string) => {
    router.push(`/purchase/${eventId}`);
  };

  const getEventForTicket = (eventId: string) => {
    return events.find(e => e.id === eventId);
  };

  if (showPurchases) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setShowPurchases(false)}
          >
            <ArrowLeft color={Colors.dark.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mis Entradas</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.emailBadge}>
            <Text style={styles.emailBadgeText}>{email}</Text>
          </View>

          {myTickets.length === 0 ? (
            <View style={styles.emptyState}>
              <Ticket color={Colors.dark.textMuted} size={64} />
              <Text style={styles.emptyTitle}>No tienes entradas</Text>
              <Text style={styles.emptySubtitle}>
                Las entradas compradas con este email aparecerán aquí
              </Text>
            </View>
          ) : (
            <View style={styles.ticketsList}>
              {myTickets.map(ticket => {
                const event = getEventForTicket(ticket.eventId);
                return (
                  <View key={ticket.id} style={styles.ticketCard}>
                    <View style={styles.ticketHeader}>
                      <View style={[
                        styles.ticketStatus,
                        ticket.isUsed && styles.ticketStatusUsed
                      ]}>
                        <Text style={[
                          styles.ticketStatusText,
                          ticket.isUsed && styles.ticketStatusTextUsed
                        ]}>
                          {ticket.isUsed ? 'Usada' : 'Válida'}
                        </Text>
                      </View>
                      <Text style={styles.ticketDate}>
                        {new Date(ticket.purchaseDate).toLocaleDateString()}
                      </Text>
                    </View>

                    <Text style={styles.ticketEventName}>
                      {event?.name || 'Evento'}
                    </Text>

                    <View style={styles.ticketDetails}>
                      <View style={styles.ticketDetailRow}>
                        <Calendar color={Colors.dark.textMuted} size={14} />
                        <Text style={styles.ticketDetailText}>
                          {event?.date} - {event?.time}
                        </Text>
                      </View>
                      <View style={styles.ticketDetailRow}>
                        <MapPin color={Colors.dark.textMuted} size={14} />
                        <Text style={styles.ticketDetailText}>
                          {event?.venue}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.qrContainer}>
                      <QrCode color={Colors.dark.primary} size={80} />
                      <Text style={styles.qrCode}>{ticket.qrCode}</Text>
                    </View>

                    <View style={styles.ticketFooter}>
                      <Text style={styles.ticketPrice}>{ticket.price.toFixed(2)}€</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color={Colors.dark.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comprar Entradas</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.purchasesSection}>
          <Text style={styles.sectionTitle}>Consultar mis compras</Text>
          <View style={styles.emailInputContainer}>
            <TextInput
              style={styles.emailInput}
              placeholder="Tu email de compra"
              placeholderTextColor={Colors.dark.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity 
              style={styles.viewPurchasesButton}
              onPress={handleViewPurchases}
            >
              <Text style={styles.viewPurchasesText}>Ver</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.eventsSection}>
          <Text style={styles.sectionTitle}>Eventos Disponibles</Text>
          
          <View style={styles.searchContainer}>
            <Search color={Colors.dark.textMuted} size={20} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar eventos..."
              placeholderTextColor={Colors.dark.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {filteredEvents.length === 0 ? (
            <View style={styles.noEvents}>
              <Text style={styles.noEventsText}>No hay eventos disponibles</Text>
            </View>
          ) : (
            filteredEvents.map(event => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() => handleBuyTickets(event.id)}
              >
                <Image source={{ uri: event.image }} style={styles.eventImage} />
                <View style={styles.eventContent}>
                  <Text style={styles.eventName}>{event.name}</Text>
                  <View style={styles.eventInfo}>
                    <Calendar color={Colors.dark.textMuted} size={14} />
                    <Text style={styles.eventInfoText}>{event.date}</Text>
                  </View>
                  <View style={styles.eventInfo}>
                    <Clock color={Colors.dark.textMuted} size={14} />
                    <Text style={styles.eventInfoText}>{event.time}</Text>
                  </View>
                  <View style={styles.eventInfo}>
                    <MapPin color={Colors.dark.textMuted} size={14} />
                    <Text style={styles.eventInfoText}>{event.venue}</Text>
                  </View>
                  <View style={styles.eventPriceRow}>
                    <Text style={styles.eventPrice}>
                      Desde {Math.min(...event.ticketTiers.map(t => t.price)).toFixed(2)}€
                    </Text>
                    <ChevronRight color={Colors.dark.primary} size={20} />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  scrollView: {
    flex: 1,
  },
  purchasesSection: {
    padding: 16,
    backgroundColor: Colors.dark.surface,
    margin: 16,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  emailInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  emailInput: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: Colors.dark.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  viewPurchasesButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewPurchasesText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  eventsSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: Colors.dark.text,
    fontSize: 14,
    marginLeft: 12,
  },
  noEvents: {
    padding: 40,
    alignItems: 'center',
  },
  noEventsText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
  },
  eventCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  eventImage: {
    width: '100%',
    height: 140,
    backgroundColor: Colors.dark.border,
  },
  eventContent: {
    padding: 16,
  },
  eventName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  eventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  eventInfoText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  eventPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  eventPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  emailBadge: {
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  emailBadgeText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  ticketsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  ticketCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketStatus: {
    backgroundColor: Colors.dark.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ticketStatusUsed: {
    backgroundColor: Colors.dark.textMuted + '20',
  },
  ticketStatusText: {
    color: Colors.dark.success,
    fontSize: 12,
    fontWeight: '600',
  },
  ticketStatusTextUsed: {
    color: Colors.dark.textMuted,
  },
  ticketDate: {
    color: Colors.dark.textMuted,
    fontSize: 12,
  },
  ticketEventName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  ticketDetails: {
    gap: 6,
    marginBottom: 16,
  },
  ticketDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ticketDetailText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  qrContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    marginBottom: 12,
  },
  qrCode: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    marginTop: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  ticketFooter: {
    alignItems: 'flex-end',
  },
  ticketPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
});
