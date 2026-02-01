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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Ticket, 
  Search, 
  Calendar, 
  MapPin, 
  Clock, 
  ChevronRight,
  Briefcase,
  QrCode,
  ArrowLeft,
  UserPlus,
  Key,
  ScanLine,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function PublicEventsScreen() {
  const { buyerEmail, saveBuyerEmail, isAuthenticated } = useAuth();
  
  const eventsQuery = trpc.events.list.useQuery();
  const ticketsQuery = trpc.tickets.getByEmail.useQuery(
    { email: buyerEmail || '' },
    { enabled: !!buyerEmail }
  );
  const [email, setEmail] = useState(buyerEmail || '');
  const [showPurchases, setShowPurchases] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const events = eventsQuery.data || [];
  const activeEvents = events.filter(e => e.isActive);
  const filteredEvents = activeEvents.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.venue.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const myTickets = ticketsQuery.data || [];

  const handleViewPurchases = () => {
    if (!email.trim()) {
      Alert.alert('Email requerido', 'Ingresa el email con el que compraste tus entradas');
      return;
    }
    saveBuyerEmail(email.trim().toLowerCase());
    ticketsQuery.refetch();
    setShowPurchases(true);
  };

  const handleBuyTickets = (eventId: string) => {
    router.push(`/purchase/${eventId}`);
  };

  const handleSellerAccess = () => {
    if (isAuthenticated) {
      router.push('/(tabs)/dashboard');
    } else {
      router.push('/auth/login');
    }
  };

  

  if (showPurchases) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
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

            {ticketsQuery.isLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={Colors.dark.primary} />
                <Text style={styles.emptyTitle}>Buscando entradas...</Text>
              </View>
            ) : myTickets.length === 0 ? (
              <View style={styles.emptyState}>
                <Ticket color={Colors.dark.textMuted} size={64} />
                <Text style={styles.emptyTitle}>No tienes entradas</Text>
                <Text style={styles.emptySubtitle}>
                  Las entradas compradas con este email aparecerán aquí
                </Text>
              </View>
            ) : (
              <View style={styles.ticketsList}>
                {myTickets.map(ticket => (
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
                        {ticket.eventName || 'Evento'}
                      </Text>

                      <View style={styles.ticketDetails}>
                        <View style={styles.ticketDetailRow}>
                          <Calendar color={Colors.dark.textMuted} size={14} />
                          <Text style={styles.ticketDetailText}>
                            {ticket.eventDate} - {ticket.eventTime}
                          </Text>
                        </View>
                        <View style={styles.ticketDetailRow}>
                          <MapPin color={Colors.dark.textMuted} size={14} />
                          <Text style={styles.ticketDetailText}>
                            {ticket.venue}
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
                  ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[Colors.dark.primary + '15', 'transparent']}
          style={styles.headerGradient}
        >
          <View style={styles.brandHeader}>
            <View style={styles.logoContainer}>
              <Ticket color={Colors.dark.primary} size={28} />
            </View>
            <Text style={styles.brandTitle}>TicketZone</Text>
            <Text style={styles.brandSubtitle}>Tu plataforma de eventos</Text>
          </View>
        </LinearGradient>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.purchasesSection}>
            <Text style={styles.sectionTitle}>🎫 Consultar mis compras</Text>
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
            <Text style={styles.sectionTitle}>🎉 Eventos Disponibles</Text>
            
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

            {eventsQuery.isLoading ? (
              <View style={styles.noEvents}>
                <ActivityIndicator size="large" color={Colors.dark.primary} />
                <Text style={styles.noEventsText}>Cargando eventos...</Text>
              </View>
            ) : filteredEvents.length === 0 ? (
              <View style={styles.noEvents}>
                <Text style={styles.noEventsEmoji}>🎭</Text>
                <Text style={styles.noEventsText}>No hay eventos disponibles</Text>
                <Text style={styles.noEventsSubtext}>Próximamente nuevos eventos</Text>
              </View>
            ) : (
              filteredEvents.map(event => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventCard}
                  onPress={() => handleBuyTickets(event.id)}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: event.image }} style={styles.eventImage} />
                  <View style={styles.eventOverlay}>
                    <View style={styles.liveTag}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>EN VENTA</Text>
                    </View>
                  </View>
                  <View style={styles.eventContent}>
                    <Text style={styles.eventName}>{event.name}</Text>
                    <View style={styles.eventInfo}>
                      <Calendar color={Colors.dark.secondary} size={14} />
                      <Text style={styles.eventInfoText}>{event.date}</Text>
                    </View>
                    <View style={styles.eventInfo}>
                      <Clock color={Colors.dark.secondary} size={14} />
                      <Text style={styles.eventInfoText}>{event.time}</Text>
                    </View>
                    <View style={styles.eventInfo}>
                      <MapPin color={Colors.dark.secondary} size={14} />
                      <Text style={styles.eventInfoText}>{event.venue}</Text>
                    </View>
                    <View style={styles.eventPriceRow}>
                      <Text style={styles.eventPrice}>
                        Desde {Math.min(...event.ticketTiers.map(t => t.price)).toFixed(2)}€
                      </Text>
                      <View style={styles.buyButton}>
                        <Text style={styles.buyButtonText}>Comprar</Text>
                        <ChevronRight color="#000" size={18} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={styles.sellerSection}>
            <View style={styles.sellerDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>¿Eres organizador?</Text>
              <View style={styles.dividerLine} />
            </View>
            
            <TouchableOpacity
              style={styles.sellerButton}
              onPress={handleSellerAccess}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#1a1a2e', '#16213e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sellerButtonGradient}
              >
                <View style={styles.sellerButtonContent}>
                  <View style={styles.sellerIconContainer}>
                    <Briefcase color={Colors.dark.primary} size={24} />
                  </View>
                  <View style={styles.sellerTextContainer}>
                    <Text style={styles.sellerButtonTitle}>Acceder como Vendedor</Text>
                    <Text style={styles.sellerButtonSubtitle}>
                      Panel de gestión de eventos y ventas
                    </Text>
                  </View>
                  <ChevronRight color={Colors.dark.textMuted} size={24} />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.sellerFooterText}>
              Crea y gestiona eventos, controla vendedores, accede a taquilla y escaneo
            </Text>

            <View style={styles.registerSection}>
              <View style={styles.registerDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>¿Aún no tienes cuenta?</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.registerButtons}>
                <TouchableOpacity
                  style={styles.registerUserButton}
                  onPress={() => router.push('/auth/register')}
                  activeOpacity={0.8}
                >
                  <UserPlus color={Colors.dark.primary} size={20} />
                  <Text style={styles.registerUserButtonText}>Registrarse</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.registerProButton}
                  onPress={() => router.push('/auth/register-pro')}
                  activeOpacity={0.8}
                >
                  <Key color={Colors.dark.secondary} size={20} />
                  <Text style={styles.registerProButtonText}>Registro Profesional</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.registerHint}>
                El registro profesional requiere un código de invitación del administrador
              </Text>
            </View>

            <View style={styles.scannerAccessSection}>
              <View style={styles.registerDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>¿Eres personal de escaneo?</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.scannerAccessButton}
                onPress={() => router.push('/scanner/access')}
                activeOpacity={0.8}
              >
                <ScanLine color={Colors.dark.accent} size={20} />
                <Text style={styles.scannerAccessButtonText}>Acceso Escáner</Text>
              </TouchableOpacity>

              <Text style={styles.registerHint}>
                Accede con tu código de invitación para escanear entradas en eventos
              </Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  safeArea: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: 10,
  },
  brandHeader: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 2,
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
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
    padding: 50,
    alignItems: 'center',
  },
  noEventsEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  noEventsText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
  noEventsSubtext: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  eventCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  eventImage: {
    width: '100%',
    height: 160,
    backgroundColor: Colors.dark.border,
  },
  eventOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.success + '95',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  liveText: {
    fontSize: 10,
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
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  eventPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  buyButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  sellerSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  sellerDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  dividerText: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    paddingHorizontal: 16,
  },
  sellerButton: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  sellerButtonGradient: {
    padding: 16,
  },
  sellerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.dark.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sellerTextContainer: {
    flex: 1,
  },
  sellerButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  sellerButtonSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  sellerFooterText: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 12,
    lineHeight: 18,
  },
  registerSection: {
    marginTop: 24,
  },
  registerDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  registerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  registerUserButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.primary + '15',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.dark.primary + '40',
  },
  registerUserButtonText: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  registerProButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.secondary + '15',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.dark.secondary + '40',
  },
  registerProButtonText: {
    color: Colors.dark.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  registerHint: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 12,
  },
  scannerAccessSection: {
    marginTop: 24,
  },
  scannerAccessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.dark.accent + '15',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.dark.accent + '40',
  },
  scannerAccessButtonText: {
    color: Colors.dark.accent,
    fontSize: 14,
    fontWeight: '600',
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
    fontFamily: 'monospace',
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
