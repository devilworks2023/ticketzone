import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  Linking,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  User,
  Mail,
  Phone,
  Building2,
  CreditCard,
  Save,
  LogOut,
  Shield,
  Wallet,
  BanknoteIcon,
  Bell,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';

type PayoutSchedule = 'daily' | 'weekly' | 'monthly' | 'manual';

interface PromoterProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  taxId?: string;
  stripeAccountId?: string;
  stripeAccountStatus: 'pending' | 'active' | 'disabled';
  commissionPercentage: number;
}

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  
  const [isLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'profile' | 'payment' | 'notifications'>('profile');
  
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [promoterProfile, setPromoterProfile] = useState<PromoterProfile | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [payoutSchedule, setPayoutSchedule] = useState<PayoutSchedule>('weekly');
  const [instantPayouts, setInstantPayouts] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [saleNotifications, setSaleNotifications] = useState(true);
  const [payoutNotifications, setPayoutNotifications] = useState(true);

  const updateUserMutation = trpc.auth.updateUser.useMutation();
  const promotersQuery = trpc.promoters.list.useQuery();
  const updatePromoterMutation = trpc.promoters.update.useMutation();

  useEffect(() => {
    if (promotersQuery.data && user?.email) {
      const found = promotersQuery.data.find(p => p.email.toLowerCase() === user.email.toLowerCase());
      if (found) {
        setPromoterProfile(found as PromoterProfile);
        setCompanyName(found.companyName || '');
        setTaxId(found.taxId || '');
      }
    }
  }, [promotersQuery.data, user?.email]);

  const handleSaveProfile = async () => {
    if (!user) return;

    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsSaving(true);
    try {
      const updates: any = { id: user.id, name: name.trim() };
      
      if (newPassword) {
        updates.password = newPassword;
      }

      await updateUserMutation.mutateAsync(updates);
      await updateUser(user.id, { name: name.trim() });

      Alert.alert('Éxito', 'Perfil actualizado correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar el perfil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePaymentSettings = async () => {
    if (!promoterProfile) return;

    setIsSaving(true);
    try {
      await updatePromoterMutation.mutateAsync({
        id: promoterProfile.id,
        companyName: companyName.trim() || undefined,
        taxId: taxId.trim() || undefined,
      });

      Alert.alert('Éxito', 'Configuración de pagos actualizada');
      promotersQuery.refetch();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

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

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            console.log('Logging out from settings...');
            try {
              await logout();
              console.log('Logout successful, navigating...');
              router.replace('/');
            } catch (error) {
              console.log('Logout error:', error);
              router.replace('/');
            }
          },
        },
      ]
    );
  };

  const getStripeStatusBadge = () => {
    if (!promoterProfile) return null;

    const status = promoterProfile.stripeAccountStatus;
    
    if (status === 'active') {
      return (
        <View style={[styles.statusBadge, styles.statusActive]}>
          <CheckCircle color={Colors.dark.success} size={14} />
          <Text style={[styles.statusText, { color: Colors.dark.success }]}>Conectado</Text>
        </View>
      );
    } else if (status === 'pending') {
      return (
        <View style={[styles.statusBadge, styles.statusPending]}>
          <Clock color={Colors.dark.warning} size={14} />
          <Text style={[styles.statusText, { color: Colors.dark.warning }]}>Pendiente</Text>
        </View>
      );
    } else {
      return (
        <View style={[styles.statusBadge, styles.statusDisabled]}>
          <AlertCircle color={Colors.dark.error} size={14} />
          <Text style={[styles.statusText, { color: Colors.dark.error }]}>Desconectado</Text>
        </View>
      );
    }
  };

  const renderSectionTab = (section: 'profile' | 'payment' | 'notifications', icon: React.ReactNode, label: string) => (
    <TouchableOpacity
      style={[styles.sectionTab, activeSection === section && styles.sectionTabActive]}
      onPress={() => setActiveSection(section)}
    >
      {icon}
      <Text style={[styles.sectionTabText, activeSection === section && styles.sectionTabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderProfileSection = () => (
    <View style={styles.section}>
      <TouchableOpacity style={styles.logoutButtonTop} onPress={handleLogout}>
        <LogOut color={Colors.dark.error} size={20} />
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Información Personal</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Nombre completo</Text>
        <View style={styles.inputContainer}>
          <User color={Colors.dark.textMuted} size={20} />
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            placeholderTextColor={Colors.dark.textMuted}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email</Text>
        <View style={[styles.inputContainer, styles.inputDisabled]}>
          <Mail color={Colors.dark.textMuted} size={20} />
          <TextInput
            style={[styles.input, styles.inputTextDisabled]}
            value={email}
            editable={false}
            placeholder="tu@email.com"
            placeholderTextColor={Colors.dark.textMuted}
          />
        </View>
        <Text style={styles.inputHint}>El email no se puede cambiar</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Teléfono</Text>
        <View style={styles.inputContainer}>
          <Phone color={Colors.dark.textMuted} size={20} />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+34 600 000 000"
            placeholderTextColor={Colors.dark.textMuted}
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Cambiar Contraseña</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Contraseña actual</Text>
        <View style={styles.inputContainer}>
          <Shield color={Colors.dark.textMuted} size={20} />
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="••••••••"
            placeholderTextColor={Colors.dark.textMuted}
            secureTextEntry
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Nueva contraseña</Text>
        <View style={styles.inputContainer}>
          <Shield color={Colors.dark.textMuted} size={20} />
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            placeholderTextColor={Colors.dark.textMuted}
            secureTextEntry
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Confirmar contraseña</Text>
        <View style={styles.inputContainer}>
          <Shield color={Colors.dark.textMuted} size={20} />
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            placeholderTextColor={Colors.dark.textMuted}
            secureTextEntry
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSaveProfile}
        disabled={isSaving}
      >
        <LinearGradient
          colors={Colors.dark.gradient.primary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.saveButtonGradient}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Save color="#FFF" size={20} />
              <Text style={styles.saveButtonText}>Guardar Cambios</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderPaymentSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Cuenta de Stripe</Text>
      
      <View style={styles.stripeCard}>
        <View style={styles.stripeHeader}>
          <LinearGradient
            colors={['#635BFF', '#A259FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.stripeIconContainer}
          >
            <CreditCard color="#FFF" size={24} />
          </LinearGradient>
          <View style={styles.stripeInfo}>
            <Text style={styles.stripeName}>Stripe Connect</Text>
            {getStripeStatusBadge()}
          </View>
        </View>

        {promoterProfile?.stripeAccountStatus === 'active' ? (
          <>
            <Text style={styles.stripeDescription}>
              Tu cuenta está conectada y lista para recibir pagos.
            </Text>
            <TouchableOpacity style={styles.stripeActionButton} onPress={handleOpenStripeDashboard}>
              <Text style={styles.stripeActionText}>Abrir Dashboard de Stripe</Text>
              <ExternalLink color={Colors.dark.primary} size={18} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.stripeDescription}>
              Conecta tu cuenta de Stripe para recibir los pagos de las ventas de entradas directamente.
            </Text>
            <TouchableOpacity style={styles.connectStripeButton} onPress={handleConnectStripe}>
              <LinearGradient
                colors={['#635BFF', '#A259FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.connectStripeGradient}
              >
                <CreditCard color="#FFF" size={18} />
                <Text style={styles.connectStripeText}>Conectar Stripe</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Datos de Facturación</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Nombre de empresa</Text>
        <View style={styles.inputContainer}>
          <Building2 color={Colors.dark.textMuted} size={20} />
          <TextInput
            style={styles.input}
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="Mi Empresa S.L."
            placeholderTextColor={Colors.dark.textMuted}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>NIF/CIF</Text>
        <View style={styles.inputContainer}>
          <BanknoteIcon color={Colors.dark.textMuted} size={20} />
          <TextInput
            style={styles.input}
            value={taxId}
            onChangeText={setTaxId}
            placeholder="B12345678"
            placeholderTextColor={Colors.dark.textMuted}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Preferencias de Pago</Text>

      <View style={styles.optionCard}>
        <View style={styles.optionHeader}>
          <Wallet color={Colors.dark.primary} size={22} />
          <Text style={styles.optionTitle}>Programación de Pagos</Text>
        </View>
        <Text style={styles.optionDescription}>
          Elige cuándo quieres recibir tus pagos automáticamente
        </Text>
        <View style={styles.scheduleOptions}>
          {(['daily', 'weekly', 'monthly', 'manual'] as PayoutSchedule[]).map((schedule) => (
            <TouchableOpacity
              key={schedule}
              style={[
                styles.scheduleOption,
                payoutSchedule === schedule && styles.scheduleOptionActive,
              ]}
              onPress={() => setPayoutSchedule(schedule)}
            >
              <Text
                style={[
                  styles.scheduleOptionText,
                  payoutSchedule === schedule && styles.scheduleOptionTextActive,
                ]}
              >
                {schedule === 'daily' && 'Diario'}
                {schedule === 'weekly' && 'Semanal'}
                {schedule === 'monthly' && 'Mensual'}
                {schedule === 'manual' && 'Manual'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.toggleOption}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleTitle}>Pagos instantáneos</Text>
          <Text style={styles.toggleDescription}>
            Recibe el dinero en minutos (comisión adicional del 1%)
          </Text>
        </View>
        <Switch
          value={instantPayouts}
          onValueChange={setInstantPayouts}
          trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
          thumbColor="#FFF"
        />
      </View>

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSavePaymentSettings}
        disabled={isSaving}
      >
        <LinearGradient
          colors={Colors.dark.gradient.primary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.saveButtonGradient}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Save color="#FFF" size={20} />
              <Text style={styles.saveButtonText}>Guardar Configuración</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderNotificationsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Notificaciones</Text>

      <View style={styles.toggleOption}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleTitle}>Notificaciones por email</Text>
          <Text style={styles.toggleDescription}>
            Recibe actualizaciones importantes por correo
          </Text>
        </View>
        <Switch
          value={emailNotifications}
          onValueChange={setEmailNotifications}
          trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
          thumbColor="#FFF"
        />
      </View>

      <View style={styles.toggleOption}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleTitle}>Alertas de ventas</Text>
          <Text style={styles.toggleDescription}>
            Notificación cada vez que se venda una entrada
          </Text>
        </View>
        <Switch
          value={saleNotifications}
          onValueChange={setSaleNotifications}
          trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
          thumbColor="#FFF"
        />
      </View>

      <View style={styles.toggleOption}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleTitle}>Alertas de pagos</Text>
          <Text style={styles.toggleDescription}>
            Notificación cuando se procese un pago
          </Text>
        </View>
        <Switch
          value={payoutNotifications}
          onValueChange={setPayoutNotifications}
          trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
          thumbColor="#FFF"
        />
      </View>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <LogOut color={Colors.dark.error} size={20} />
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
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
          title: 'Mi Cuenta',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      <View style={styles.tabsContainer}>
        {renderSectionTab('profile', <User color={activeSection === 'profile' ? Colors.dark.primary : Colors.dark.textMuted} size={18} />, 'Perfil')}
        {renderSectionTab('payment', <CreditCard color={activeSection === 'payment' ? Colors.dark.primary : Colors.dark.textMuted} size={18} />, 'Pagos')}
        {renderSectionTab('notifications', <Bell color={activeSection === 'notifications' ? Colors.dark.primary : Colors.dark.textMuted} size={18} />, 'Alertas')}
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {activeSection === 'profile' && renderProfileSection()}
        {activeSection === 'payment' && renderPaymentSection()}
        {activeSection === 'notifications' && renderNotificationsSection()}
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
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  sectionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
  },
  sectionTabActive: {
    backgroundColor: Colors.dark.primary + '20',
  },
  sectionTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  sectionTabTextActive: {
    color: Colors.dark.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 14,
    gap: 12,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: Colors.dark.text,
  },
  inputTextDisabled: {
    color: Colors.dark.textMuted,
  },
  inputHint: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 8,
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  stripeCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  stripeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stripeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripeInfo: {
    flex: 1,
    gap: 4,
  },
  stripeName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusActive: {
    backgroundColor: Colors.dark.success + '20',
  },
  statusPending: {
    backgroundColor: Colors.dark.warning + '20',
  },
  statusDisabled: {
    backgroundColor: Colors.dark.error + '20',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stripeDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  stripeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.primary + '15',
  },
  stripeActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  connectStripeButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  connectStripeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  connectStripeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  optionCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  optionDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  scheduleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  scheduleOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  scheduleOptionActive: {
    backgroundColor: Colors.dark.primary + '20',
    borderColor: Colors.dark.primary,
  },
  scheduleOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  scheduleOptionTextActive: {
    color: Colors.dark.primary,
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.dark.error + '15',
    marginTop: 8,
  },
  logoutButtonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.error + '20',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.error + '40',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.error,
  },
});
