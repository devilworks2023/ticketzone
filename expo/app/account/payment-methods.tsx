import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CreditCard,
  Building2,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Shield,
  Banknote,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [isLoading] = useState(false);
  const [promoterProfile, setPromoterProfile] = useState<any>(null);
  
  const promotersQuery = trpc.promoters.list.useQuery();
  const checkStatusQuery = trpc.payments.checkConnectAccountStatus.useQuery(
    { 
      accountId: promoterProfile?.stripeAccountId || '', 
      promoterId: promoterProfile?.id || '' 
    },
    { enabled: !!promoterProfile?.stripeAccountId }
  );

  useEffect(() => {
    if (promotersQuery.data && user?.email) {
      const found = promotersQuery.data.find(p => p.email.toLowerCase() === user.email.toLowerCase());
      if (found) {
        setPromoterProfile(found);
      }
    }
  }, [promotersQuery.data, user?.email]);

  const handleConnectStripe = () => {
    if (!promoterProfile) {
      Alert.alert('Error', 'Primero debes crear un perfil de promotor');
      return;
    }

    router.push({
      pathname: '/promoter/connect-stripe',
      params: {
        promoterId: promoterProfile.id,
        email: promoterProfile.email,
        name: promoterProfile.name,
      },
    });
  };

  const handleOpenStripeDashboard = async () => {
    const url = 'https://dashboard.stripe.com/';
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    }
  };

  const handleManagePayoutMethods = async () => {
    const url = 'https://dashboard.stripe.com/settings/payouts';
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    }
  };

  const getStripeStatus = () => {
    if (!promoterProfile) return 'not_connected';
    if (promoterProfile.stripeAccountStatus === 'active') return 'active';
    if (promoterProfile.stripeAccountStatus === 'pending') return 'pending';
    return 'not_connected';
  };

  const stripeStatus = getStripeStatus();

  if (isLoading || promotersQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Métodos de Pago',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['#635BFF', '#A259FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroIcon}
          >
            <CreditCard color="#FFF" size={32} />
          </LinearGradient>
          <Text style={styles.heroTitle}>Gestiona tus Pagos</Text>
          <Text style={styles.heroSubtitle}>
            Configura cómo quieres recibir el dinero de tus ventas
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado de Stripe Connect</Text>
          
          <View style={styles.statusCard}>
            {stripeStatus === 'active' ? (
              <>
                <View style={styles.statusHeader}>
                  <View style={[styles.statusIcon, styles.statusIconActive]}>
                    <CheckCircle color={Colors.dark.success} size={24} />
                  </View>
                  <View style={styles.statusInfo}>
                    <Text style={styles.statusTitle}>Cuenta Conectada</Text>
                    <Text style={styles.statusDescription}>
                      Estás listo para recibir pagos
                    </Text>
                  </View>
                </View>
                
                {checkStatusQuery.data && (
                  <View style={styles.statusDetails}>
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Cargos habilitados</Text>
                      <View style={[
                        styles.statusBadge,
                        checkStatusQuery.data.chargesEnabled ? styles.badgeSuccess : styles.badgeWarning
                      ]}>
                        <Text style={[
                          styles.statusBadgeText,
                          { color: checkStatusQuery.data.chargesEnabled ? Colors.dark.success : Colors.dark.warning }
                        ]}>
                          {checkStatusQuery.data.chargesEnabled ? 'Sí' : 'No'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Pagos habilitados</Text>
                      <View style={[
                        styles.statusBadge,
                        checkStatusQuery.data.payoutsEnabled ? styles.badgeSuccess : styles.badgeWarning
                      ]}>
                        <Text style={[
                          styles.statusBadgeText,
                          { color: checkStatusQuery.data.payoutsEnabled ? Colors.dark.success : Colors.dark.warning }
                        ]}>
                          {checkStatusQuery.data.payoutsEnabled ? 'Sí' : 'No'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={handleOpenStripeDashboard}
                  >
                    <ExternalLink color={Colors.dark.primary} size={18} />
                    <Text style={styles.actionButtonText}>Dashboard de Stripe</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={handleManagePayoutMethods}
                  >
                    <Banknote color={Colors.dark.primary} size={18} />
                    <Text style={styles.actionButtonText}>Cuentas Bancarias</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : stripeStatus === 'pending' ? (
              <>
                <View style={styles.statusHeader}>
                  <View style={[styles.statusIcon, styles.statusIconPending]}>
                    <Clock color={Colors.dark.warning} size={24} />
                  </View>
                  <View style={styles.statusInfo}>
                    <Text style={styles.statusTitle}>Verificación Pendiente</Text>
                    <Text style={styles.statusDescription}>
                      Completa la verificación de tu cuenta
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.connectButton} 
                  onPress={handleConnectStripe}
                >
                  <LinearGradient
                    colors={['#635BFF', '#A259FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.connectGradient}
                  >
                    <Text style={styles.connectText}>Completar Verificación</Text>
                    <ExternalLink color="#FFF" size={18} />
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.statusHeader}>
                  <View style={[styles.statusIcon, styles.statusIconDisabled]}>
                    <AlertCircle color={Colors.dark.textMuted} size={24} />
                  </View>
                  <View style={styles.statusInfo}>
                    <Text style={styles.statusTitle}>No Conectado</Text>
                    <Text style={styles.statusDescription}>
                      Conecta tu cuenta para recibir pagos
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.connectButton} 
                  onPress={handleConnectStripe}
                >
                  <LinearGradient
                    colors={['#635BFF', '#A259FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.connectGradient}
                  >
                    <CreditCard color="#FFF" size={18} />
                    <Text style={styles.connectText}>Conectar Stripe</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Shield color={Colors.dark.success} size={20} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Pagos Seguros</Text>
                <Text style={styles.infoDescription}>
                  Todos los pagos están protegidos por Stripe, el procesador de pagos más seguro del mundo.
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Banknote color={Colors.dark.primary} size={20} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Transferencias Automáticas</Text>
                <Text style={styles.infoDescription}>
                  El dinero de tus ventas se transfiere automáticamente a tu cuenta bancaria según tu configuración.
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Building2 color={Colors.dark.secondary} size={20} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Comisión de Plataforma</Text>
                <Text style={styles.infoDescription}>
                  La plataforma retiene un 5% de cada venta. El resto se envía directamente a tu cuenta.
                </Text>
              </View>
            </View>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 8,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 18,
    gap: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconActive: {
    backgroundColor: Colors.dark.success + '20',
  },
  statusIconPending: {
    backgroundColor: Colors.dark.warning + '20',
  },
  statusIconDisabled: {
    backgroundColor: Colors.dark.surface,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  statusDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  statusDetails: {
    gap: 10,
    paddingTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeSuccess: {
    backgroundColor: Colors.dark.success + '20',
  },
  badgeWarning: {
    backgroundColor: Colors.dark.warning + '20',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.primary + '15',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  connectButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  connectGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  connectText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  infoCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 14,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
});
