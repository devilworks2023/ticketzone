import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, Mail, Phone, CreditCard, TrendingUp, Calendar, Ticket, DollarSign, Edit, UserX, UserCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function PromoterDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const promotersQuery = trpc.promoters.list.useQuery();
  const updatePromoterMutation = trpc.promoters.update.useMutation();
  
  const promoter = promotersQuery.data?.find(p => p.id === id);

  const onRefresh = async () => {
    await promotersQuery.refetch();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getStripeStatusConfig = (status: string | null | undefined) => {
    switch (status) {
      case 'active':
        return { color: Colors.dark.success, label: 'Stripe activo', icon: CreditCard };
      case 'disabled':
        return { color: Colors.dark.error, label: 'Stripe deshabilitado', icon: CreditCard };
      case 'pending':
      default:
        return { color: Colors.dark.warning, label: 'Stripe pendiente', icon: CreditCard };
    }
  };

  const handleToggleStatus = async () => {
    if (!promoter) return;
    
    Alert.alert(
      promoter.isActive ? 'Desactivar promotor' : 'Activar promotor',
      `¿Estás seguro de que quieres ${promoter.isActive ? 'desactivar' : 'activar'} a ${promoter.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: promoter.isActive ? 'Desactivar' : 'Activar',
          style: promoter.isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await updatePromoterMutation.mutateAsync({
                id: promoter.id,
                isActive: !promoter.isActive,
              });
              await promotersQuery.refetch();
              Alert.alert('Éxito', `Promotor ${promoter.isActive ? 'desactivado' : 'activado'} correctamente`);
            } catch (error) {
              Alert.alert('Error', 'No se pudo actualizar el estado del promotor');
            }
          },
        },
      ]
    );
  };

  if (promotersQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  if (!promoter) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen 
          options={{ 
            title: 'Promotor no encontrado',
            headerStyle: { backgroundColor: Colors.dark.background },
            headerTintColor: Colors.dark.text,
          }} 
        />
        <View style={styles.errorContainer}>
          <Building2 color={Colors.dark.textMuted} size={64} />
          <Text style={styles.errorTitle}>Promotor no encontrado</Text>
          <Text style={styles.errorText}>Este promotor no existe o ha sido eliminado</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const stripeStatus = getStripeStatusConfig(promoter.stripeAccountStatus);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen 
        options={{ 
          title: promoter.name,
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }} 
      />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={promotersQuery.isRefetching}
            onRefresh={onRefresh}
            tintColor={Colors.dark.primary}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.avatarLarge}>
            <Building2 color={Colors.dark.primary} size={40} />
          </View>
          <Text style={styles.nameTitle}>{promoter.name}</Text>
          {promoter.companyName && (
            <Text style={styles.companyName}>{promoter.companyName}</Text>
          )}
          <View style={[
            styles.statusBadge,
            { backgroundColor: promoter.isActive ? Colors.dark.success + '20' : Colors.dark.error + '20' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: promoter.isActive ? Colors.dark.success : Colors.dark.error }
            ]}>
              {promoter.isActive ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
        </View>

        <View style={styles.contactSection}>
          <View style={styles.contactItem}>
            <View style={styles.contactIcon}>
              <Mail color={Colors.dark.primary} size={18} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>{promoter.email}</Text>
            </View>
          </View>

          {promoter.phone && (
            <View style={styles.contactItem}>
              <View style={styles.contactIcon}>
                <Phone color={Colors.dark.primary} size={18} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Teléfono</Text>
                <Text style={styles.contactValue}>{promoter.phone}</Text>
              </View>
            </View>
          )}

          <View style={styles.contactItem}>
            <View style={[styles.contactIcon, { backgroundColor: stripeStatus.color + '20' }]}>
              <CreditCard color={stripeStatus.color} size={18} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Estado de Stripe</Text>
              <Text style={[styles.contactValue, { color: stripeStatus.color }]}>
                {stripeStatus.label}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Estadísticas</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <LinearGradient
                colors={Colors.dark.gradient.primary as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statIconContainer}
              >
                <TrendingUp color="#FFF" size={20} />
              </LinearGradient>
              <Text style={styles.statValue}>{formatCurrency(promoter.totalEarnings || 0)}</Text>
              <Text style={styles.statLabel}>Ganancias totales</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: Colors.dark.success + '20' }]}>
                <DollarSign color={Colors.dark.success} size={20} />
              </View>
              <Text style={styles.statValue}>{formatCurrency(promoter.pendingPayout || 0)}</Text>
              <Text style={styles.statLabel}>Pendiente de pago</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: Colors.dark.secondary + '20' }]}>
                <Calendar color={Colors.dark.secondary} size={20} />
              </View>
              <Text style={styles.statValue}>{promoter.eventCount || 0}</Text>
              <Text style={styles.statLabel}>Eventos</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: Colors.dark.accent + '20' }]}>
                <Ticket color={Colors.dark.accent} size={20} />
              </View>
              <Text style={styles.statValue}>{promoter.commissionPercentage}%</Text>
              <Text style={styles.statLabel}>Comisión</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Acciones</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleToggleStatus}
          >
            {promoter.isActive ? (
              <>
                <UserX color={Colors.dark.error} size={20} />
                <Text style={[styles.actionButtonText, { color: Colors.dark.error }]}>
                  Desactivar promotor
                </Text>
              </>
            ) : (
              <>
                <UserCheck color={Colors.dark.success} size={20} />
                <Text style={[styles.actionButtonText, { color: Colors.dark.success }]}>
                  Activar promotor
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
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
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  errorText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  nameTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  companyName: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  contactSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    padding: 16,
    borderRadius: 14,
    gap: 14,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  actionsSection: {
    paddingHorizontal: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.card,
    padding: 16,
    borderRadius: 14,
    gap: 10,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
