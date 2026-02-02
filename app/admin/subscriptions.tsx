import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Plus,
  Edit3,
  Trash2,
  Calendar,
  Users,
  TrendingUp,
  X,
  Check,
  Package,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  maxEventsPerMonth: number;
  priceMonthly: number;
  features?: string[];
  isActive: boolean;
  sortOrder?: number;
}

export default function AdminSubscriptionsScreen() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMaxEvents, setFormMaxEvents] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSortOrder, setFormSortOrder] = useState('');

  const plansQuery = trpc.subscriptions.listAllPlans.useQuery();
  const statsQuery = trpc.subscriptions.getSubscriptionStats.useQuery();
  const createPlanMutation = trpc.subscriptions.createPlan.useMutation();
  const updatePlanMutation = trpc.subscriptions.updatePlan.useMutation();
  const deletePlanMutation = trpc.subscriptions.deletePlan.useMutation();

  const plans = plansQuery.data || [];
  const stats = statsQuery.data;

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormMaxEvents('');
    setFormPrice('');
    setFormIsActive(true);
    setFormSortOrder('');
    setEditingPlan(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalVisible(true);
  };

  const openEditModal = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormName(plan.name);
    setFormDescription(plan.description || '');
    setFormMaxEvents(plan.maxEventsPerMonth.toString());
    setFormPrice(plan.priceMonthly.toString());
    setFormIsActive(plan.isActive);
    setFormSortOrder(plan.sortOrder?.toString() || '');
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    if (!formMaxEvents || parseInt(formMaxEvents) < 1) {
      Alert.alert('Error', 'El número de eventos debe ser al menos 1');
      return;
    }
    if (!formPrice || parseFloat(formPrice) < 0) {
      Alert.alert('Error', 'El precio debe ser válido');
      return;
    }

    try {
      console.log('[SUBSCRIPTIONS] Guardando plan...');
      if (editingPlan) {
        console.log('[SUBSCRIPTIONS] Actualizando plan:', editingPlan.id);
        await updatePlanMutation.mutateAsync({
          id: editingPlan.id,
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          maxEventsPerMonth: parseInt(formMaxEvents),
          priceMonthly: parseFloat(formPrice),
          isActive: formIsActive,
          sortOrder: formSortOrder ? parseInt(formSortOrder) : undefined,
        });
        console.log('[SUBSCRIPTIONS] Plan actualizado correctamente');
        Alert.alert('Éxito', 'Plan actualizado correctamente');
      } else {
        console.log('[SUBSCRIPTIONS] Creando nuevo plan');
        await createPlanMutation.mutateAsync({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          maxEventsPerMonth: parseInt(formMaxEvents),
          priceMonthly: parseFloat(formPrice),
          sortOrder: formSortOrder ? parseInt(formSortOrder) : undefined,
        });
        console.log('[SUBSCRIPTIONS] Plan creado correctamente');
        Alert.alert('Éxito', 'Plan creado correctamente');
      }
      setIsModalVisible(false);
      resetForm();
      plansQuery.refetch();
      statsQuery.refetch();
    } catch (error: any) {
      console.error('[SUBSCRIPTIONS] Error guardando plan:', error);
      Alert.alert('Error', error.message || 'No se pudo guardar el plan');
    }
  };

  const handleDelete = (plan: SubscriptionPlan) => {
    Alert.alert(
      'Eliminar Plan',
      `¿Estás seguro de eliminar el plan "${plan.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePlanMutation.mutateAsync({ id: plan.id });
              Alert.alert('Éxito', 'Plan eliminado');
              plansQuery.refetch();
              statsQuery.refetch();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar el plan');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getSubscribersForPlan = (planId: string) => {
    return stats?.planStats?.find(p => p.id === planId)?.subscribers || 0;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Planes de Suscripción',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Colors.dark.primary + '20' }]}>
                <Users color={Colors.dark.primary} size={20} />
              </View>
              <Text style={styles.statValue}>{stats?.activeSubscriptions || 0}</Text>
              <Text style={styles.statLabel}>Suscriptores activos</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Colors.dark.success + '20' }]}>
                <TrendingUp color={Colors.dark.success} size={20} />
              </View>
              <Text style={[styles.statValue, { color: Colors.dark.success }]}>
                {formatCurrency(stats?.monthlyRevenue || 0)}
              </Text>
              <Text style={styles.statLabel}>Ingresos mensuales</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Planes Disponibles</Text>
            <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
              <Plus color="#FFF" size={18} />
              <Text style={styles.addButtonText}>Nuevo Plan</Text>
            </TouchableOpacity>
          </View>

          {plansQuery.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={Colors.dark.primary} />
            </View>
          ) : plans.length === 0 ? (
            <View style={styles.emptyState}>
              <Package color={Colors.dark.textMuted} size={48} />
              <Text style={styles.emptyTitle}>No hay planes</Text>
              <Text style={styles.emptyText}>Crea tu primer plan de suscripción</Text>
            </View>
          ) : (
            plans.map((plan) => (
              <View
                key={plan.id}
                style={[styles.planCard, !plan.isActive && styles.planCardInactive]}
              >
                <View style={styles.planHeader}>
                  <View style={styles.planTitleRow}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    {!plan.isActive && (
                      <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveBadgeText}>Inactivo</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.planActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openEditModal(plan)}
                    >
                      <Edit3 color={Colors.dark.primary} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDelete(plan)}
                    >
                      <Trash2 color={Colors.dark.error} size={18} />
                    </TouchableOpacity>
                  </View>
                </View>

                {plan.description && (
                  <Text style={styles.planDescription}>{plan.description}</Text>
                )}

                <View style={styles.planDetails}>
                  <View style={styles.planDetailItem}>
                    <Calendar color={Colors.dark.secondary} size={16} />
                    <Text style={styles.planDetailText}>
                      {plan.maxEventsPerMonth >= 999
                        ? 'Eventos ilimitados'
                        : `${plan.maxEventsPerMonth} eventos/mes`}
                    </Text>
                  </View>
                  <View style={styles.planDetailItem}>
                    <Users color={Colors.dark.textMuted} size={16} />
                    <Text style={styles.planDetailText}>
                      {getSubscribersForPlan(plan.id)} suscriptores
                    </Text>
                  </View>
                </View>

                <View style={styles.planFooter}>
                  <Text style={styles.planPrice}>{formatCurrency(plan.priceMonthly)}</Text>
                  <Text style={styles.planPriceLabel}>/mes</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingPlan ? 'Editar Plan' : 'Nuevo Plan'}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setIsModalVisible(false);
                  resetForm();
                }}
              >
                <X color={Colors.dark.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre del plan *</Text>
                <TextInput
                  style={styles.input}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="Ej: Profesional"
                  placeholderTextColor={Colors.dark.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Descripción</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder="Descripción del plan..."
                  placeholderTextColor={Colors.dark.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Eventos por mes *</Text>
                <TextInput
                  style={styles.input}
                  value={formMaxEvents}
                  onChangeText={setFormMaxEvents}
                  placeholder="Ej: 10"
                  placeholderTextColor={Colors.dark.textMuted}
                  keyboardType="number-pad"
                />
                <Text style={styles.inputHint}>Usa 999 para eventos ilimitados</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Precio mensual (€) *</Text>
                <TextInput
                  style={styles.input}
                  value={formPrice}
                  onChangeText={setFormPrice}
                  placeholder="Ej: 79.99"
                  placeholderTextColor={Colors.dark.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Orden de visualización</Text>
                <TextInput
                  style={styles.input}
                  value={formSortOrder}
                  onChangeText={setFormSortOrder}
                  placeholder="Ej: 1"
                  placeholderTextColor={Colors.dark.textMuted}
                  keyboardType="number-pad"
                />
              </View>

              {editingPlan && (
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleTitle}>Plan activo</Text>
                    <Text style={styles.toggleDescription}>
                      Los planes inactivos no se muestran a los promotores
                    </Text>
                  </View>
                  <Switch
                    value={formIsActive}
                    onValueChange={setFormIsActive}
                    trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
                    thumbColor="#FFF"
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setIsModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
              >
                <LinearGradient
                  colors={Colors.dark.gradient.primary as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveButtonGradient}
                >
                  {createPlanMutation.isPending || updatePlanMutation.isPending ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Check color="#FFF" size={18} />
                      <Text style={styles.saveButtonText}>Guardar</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  statsContainer: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
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
  planCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  planCardInactive: {
    opacity: 0.6,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  inactiveBadge: {
    backgroundColor: Colors.dark.textMuted + '30',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inactiveBadgeText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: '600',
  },
  planActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    backgroundColor: Colors.dark.surface,
    borderRadius: 8,
  },
  planDescription: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  planDetails: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  planDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planDetailText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  planFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.primary,
  },
  planPriceLabel: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.dark.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
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
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 0,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
