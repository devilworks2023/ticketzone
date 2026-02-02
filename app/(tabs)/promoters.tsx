import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Search, Building2, Mail, Phone, CreditCard, TrendingUp, Calendar, MoreVertical } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

interface Promoter {
  id: string;
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  stripeAccountId?: string;
  stripeAccountStatus?: 'pending' | 'active' | 'disabled' | null;
  commissionPercentage: number;
  isActive: boolean;
  eventCount: number;
  totalEarnings: number;
}

export default function PromotersScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  
  const promotersQuery = trpc.promoters.list.useQuery();
  const updatePromoterMutation = trpc.promoters.update.useMutation({
    onSuccess: () => {
      promotersQuery.refetch();
    },
  });
  const promoters: Promoter[] = (promotersQuery.data || []).map(p => ({
    ...p,
    stripeAccountStatus: (p.stripeAccountStatus as 'pending' | 'active' | 'disabled' | null) || 'pending',
  }));

  const onRefresh = async () => {
    await promotersQuery.refetch();
  };

  const filteredPromoters = promoters.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.companyName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getStripeStatusConfig = (status: Promoter['stripeAccountStatus']) => {
    switch (status) {
      case 'active':
        return { color: Colors.dark.success, label: 'Stripe activo' };
      case 'disabled':
        return { color: Colors.dark.error, label: 'Stripe deshabilitado' };
      case 'pending':
      default:
        return { color: Colors.dark.warning, label: 'Stripe pendiente' };
    }
  };

  const handleToggleActive = useCallback((promoter: Promoter) => {
    const action = promoter.isActive ? 'desactivar' : 'activar';
    Alert.alert(
      `${promoter.isActive ? 'Desactivar' : 'Activar'} promotor`,
      `¿Estás seguro de que quieres ${action} a ${promoter.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: promoter.isActive ? 'Desactivar' : 'Activar',
          style: promoter.isActive ? 'destructive' : 'default',
          onPress: () => {
            updatePromoterMutation.mutate({
              id: promoter.id,
              isActive: !promoter.isActive,
            });
          },
        },
      ]
    );
  }, [updatePromoterMutation]);

  const handlePromoterOptions = (promoter: Promoter) => {
    Alert.alert(
      promoter.name,
      'Selecciona una acción',
      [
        { text: 'Ver detalles', onPress: () => router.push(`/promoter/${promoter.id}` as any) },
        { text: 'Editar', onPress: () => router.push(`/promoter/${promoter.id}/edit` as any) },
        { 
          text: promoter.isActive ? 'Desactivar' : 'Activar', 
          style: promoter.isActive ? 'destructive' : 'default',
          onPress: () => handleToggleActive(promoter),
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const renderPromoter = ({ item }: { item: Promoter }) => {
    const stripeStatus = getStripeStatusConfig(item.stripeAccountStatus);
    
    return (
      <TouchableOpacity
        style={styles.promoterCard}
        onPress={() => router.push(`/promoter/${item.id}` as any)}
      >
        <View style={styles.promoterHeader}>
          <View style={styles.promoterAvatar}>
            <Building2 color={Colors.dark.primary} size={24} />
          </View>
          <View style={styles.promoterInfo}>
            <Text style={styles.promoterName}>{item.name}</Text>
            {item.companyName && (
              <Text style={styles.companyName}>{item.companyName}</Text>
            )}
          </View>
          <TouchableOpacity 
            style={styles.moreButton}
            onPress={() => handlePromoterOptions(item)}
          >
            <MoreVertical color={Colors.dark.textMuted} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.contactRow}>
          <View style={styles.contactItem}>
            <Mail color={Colors.dark.textMuted} size={14} />
            <Text style={styles.contactText}>{item.email}</Text>
          </View>
          {item.phone && (
            <View style={styles.contactItem}>
              <Phone color={Colors.dark.textMuted} size={14} />
              <Text style={styles.contactText}>{item.phone}</Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Calendar color={Colors.dark.secondary} size={16} />
            <Text style={styles.statValue}>{item.eventCount}</Text>
            <Text style={styles.statLabel}>eventos</Text>
          </View>
          <View style={styles.statItem}>
            <TrendingUp color={Colors.dark.success} size={16} />
            <Text style={[styles.statValue, { color: Colors.dark.success }]}>
              {formatCurrency(item.totalEarnings)}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={[styles.stripeBadge, { backgroundColor: stripeStatus.color + '20' }]}>
            <CreditCard color={stripeStatus.color} size={14} />
            <Text style={[styles.stripeText, { color: stripeStatus.color }]}>
              {stripeStatus.label}
            </Text>
          </View>
          <View style={styles.commissionBadge}>
            <Text style={styles.commissionText}>{item.commissionPercentage}% comisión</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Search color={Colors.dark.textMuted} size={20} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar promotores..."
          placeholderTextColor={Colors.dark.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredPromoters}
        renderItem={renderPromoter}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={promotersQuery.isRefetching}
            onRefresh={onRefresh}
            tintColor={Colors.dark.primary}
          />
        }
        ListEmptyComponent={
          promotersQuery.isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={Colors.dark.primary} />
              <Text style={styles.loadingText}>Cargando promotores...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Building2 color={Colors.dark.textMuted} size={48} />
              <Text style={styles.emptyTitle}>No hay promotores</Text>
              <Text style={styles.emptyText}>Añade promotores para gestionar sus eventos y pagos</Text>
            </View>
          )
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/promoter/create')}
      >
        <LinearGradient
          colors={Colors.dark.gradient.primary as [string, string]}
          style={styles.fabGradient}
        >
          <Plus color="#FFF" size={28} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.dark.text,
  },
  list: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },
  promoterCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  promoterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  promoterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoterInfo: {
    flex: 1,
    marginLeft: 12,
  },
  promoterName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  companyName: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 14,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stripeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  stripeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  commissionBadge: {
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  commissionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
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
    paddingHorizontal: 40,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingState: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 80,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
});
