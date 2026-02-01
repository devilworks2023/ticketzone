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
  ActivityIndicator,
  KeyboardAvoidingView,
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
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  LogOut,
} from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

type AuthMode = 'login' | 'register';

export default function BuyerScreen() {
  const { events, tickets } = useApp();
  const { 
    buyerUser, 
    buyerEmail, 
    isBuyerAuthenticated, 
    loginBuyer, 
    registerBuyer, 
    logoutBuyer 
  } = useAuth();
  
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPurchases, setShowPurchases] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeEvents = events.filter(e => e.isActive);
  const filteredEvents = activeEvents.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.venue.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const myTickets = tickets.filter(t => 
    buyerEmail && t.buyerEmail.toLowerCase() === buyerEmail.toLowerCase()
  );

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu contraseña');
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginBuyer(email.trim(), password);
      if (!result.success) {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.log('Login error:', error);
      Alert.alert('Error', 'Ocurrió un error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu nombre');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu email');
      return;
    }
    if (!password.trim() || password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsLoading(true);
    try {
      const result = await registerBuyer(email.trim(), password, name.trim());
      if (!result.success) {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.log('Register error:', error);
      Alert.alert('Error', 'Ocurrió un error al registrar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cerrar Sesión', 
          style: 'destructive',
          onPress: () => {
            logoutBuyer();
            setShowPurchases(false);
          }
        },
      ]
    );
  };

  const handleBuyTickets = (eventId: string) => {
    router.push(`/purchase/${eventId}`);
  };

  const getEventForTicket = (eventId: string) => {
    return events.find(e => e.id === eventId);
  };

  if (!isBuyerAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <ArrowLeft color={Colors.dark.text} size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Área de Comprador</Text>
            <View style={styles.backButton} />
          </View>

          <ScrollView 
            style={styles.scrollView} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.authContent}
          >
            <View style={styles.authContainer}>
              <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                  <Ticket color={Colors.dark.primary} size={40} />
                </View>
                <Text style={styles.authTitle}>
                  {authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                </Text>
                <Text style={styles.authSubtitle}>
                  {authMode === 'login' 
                    ? 'Accede para ver tus entradas y comprar nuevas'
                    : 'Regístrate para comprar entradas y llevar un registro'
                  }
                </Text>
              </View>

              {authMode === 'register' && (
                <View style={styles.inputContainer}>
                  <User color={Colors.dark.textMuted} size={20} />
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre completo"
                    placeholderTextColor={Colors.dark.textMuted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
                <Mail color={Colors.dark.textMuted} size={20} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Lock color={Colors.dark.textMuted} size={20} />
                <TextInput
                  style={styles.input}
                  placeholder="Contraseña"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <EyeOff color={Colors.dark.textMuted} size={20} />
                  ) : (
                    <Eye color={Colors.dark.textMuted} size={20} />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.authButton, isLoading && styles.authButtonDisabled]}
                onPress={authMode === 'login' ? handleLogin : handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.authButtonText}>
                    {authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchModeButton}
                onPress={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setPassword('');
                }}
              >
                <Text style={styles.switchModeText}>
                  {authMode === 'login' 
                    ? '¿No tienes cuenta? Regístrate'
                    : '¿Ya tienes cuenta? Inicia sesión'
                  }
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>¿Por qué crear una cuenta?</Text>
              <Text style={styles.infoText}>
                • Ver todas tus entradas en un solo lugar{'\n'}
                • Acceso seguro a tus compras{'\n'}
                • Historial de todos tus eventos
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

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
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleLogout}
          >
            <LogOut color={Colors.dark.error} size={22} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.userBadge}>
            <View style={styles.userAvatar}>
              <User color={Colors.dark.primary} size={20} />
            </View>
            <View>
              <Text style={styles.userName}>{buyerUser?.name}</Text>
              <Text style={styles.userEmail}>{buyerEmail}</Text>
            </View>
          </View>

          {myTickets.length === 0 ? (
            <View style={styles.emptyState}>
              <Ticket color={Colors.dark.textMuted} size={64} />
              <Text style={styles.emptyTitle}>No tienes entradas</Text>
              <Text style={styles.emptySubtitle}>
                Las entradas compradas con esta cuenta aparecerán aquí
              </Text>
              <TouchableOpacity 
                style={styles.browseButton}
                onPress={() => setShowPurchases(false)}
              >
                <Text style={styles.browseButtonText}>Ver Eventos</Text>
              </TouchableOpacity>
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
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleLogout}
        >
          <LogOut color={Colors.dark.error} size={22} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <TouchableOpacity 
          style={styles.purchasesSection}
          onPress={() => setShowPurchases(true)}
        >
          <View style={styles.userRow}>
            <View style={styles.userAvatar}>
              <User color={Colors.dark.primary} size={20} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.welcomeText}>Hola, {buyerUser?.name}</Text>
              <Text style={styles.ticketCountText}>
                {myTickets.length} {myTickets.length === 1 ? 'entrada' : 'entradas'}
              </Text>
            </View>
            <ChevronRight color={Colors.dark.primary} size={24} />
          </View>
        </TouchableOpacity>

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
  keyboardView: {
    flex: 1,
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
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  scrollView: {
    flex: 1,
  },
  authContent: {
    padding: 16,
  },
  authContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  input: {
    flex: 1,
    height: 52,
    color: Colors.dark.text,
    fontSize: 15,
    marginLeft: 12,
  },
  authButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  authButtonDisabled: {
    opacity: 0.7,
  },
  authButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  switchModeButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchModeText: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  infoBox: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    lineHeight: 22,
  },
  purchasesSection: {
    padding: 16,
    backgroundColor: Colors.dark.surface,
    margin: 16,
    borderRadius: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  ticketCountText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 12,
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
    fontWeight: '700' as const,
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
    fontWeight: '700' as const,
    color: Colors.dark.primary,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    borderRadius: 12,
    gap: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  userEmail: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  browseButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600' as const,
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
    fontWeight: '600' as const,
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
    fontWeight: '700' as const,
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
    fontWeight: '700' as const,
    color: Colors.dark.primary,
  },
});
