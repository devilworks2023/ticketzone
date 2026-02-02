import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Building2,
  Mail,
  Phone,
  CreditCard,
  Edit3,
  Trash2,
  X,
  Check,
  Calendar,
  DollarSign,
  Package,
  Percent,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function AdminPromotersManageScreen() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingPromoter, setEditingPromoter] = useState<any>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompanyName, setFormCompanyName] = useState('');
  const [formTaxId, setFormTaxId] = useState('');
  const [formCommission, setFormCommission] = useState('5');
  const [formBillingModel, setFormBillingModel] = useState<'commission' | 'subscription'>('commission');
  const [formIsActive, setFormIsActive] = useState(true);

  const promotersQuery = trpc.promoters.list.useQuery();
  const createMutation = trpc.promoters.create.useMutation();
  const updateMutation = trpc.promoters.update.useMutation();
  const deleteMutation = trpc.promoters.delete.useMutation();

  const promoters = promotersQuery.data || [];

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormCompanyName('');
    setFormTaxId('');
    setFormCommission('5');
    setFormBillingModel('commission');
    setFormIsActive(true);
    setEditingPromoter(null);
  };

  const openEditModal = (promoter: any) => {
    setEditingPromoter(promoter);
    setFormName(promoter.name);
    setFormEmail(promoter.email);
    setFormPhone(promoter.phone || '');
    setFormCompanyName(promoter.companyName || '');
    setFormTaxId(promoter.taxId || '');
    setFormCommission(String(promoter.commissionPercentage ?? 5));
    setFormBillingModel(promoter.billingModel || 'commission');
    setFormIsActive(promoter.isActive);
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    if (!formEmail.trim()) {
      Alert.alert('Error', 'El email es obligatorio');
      return;
    }

    try {
      if (editingPromoter) {
        const commission = parseFloat(formCommission);
        if (isNaN(commission) || commission < 0 || commission > 100) {
          Alert.alert('Error', 'La comisión debe ser un número entre 0 y 100');
          return;
        }
        await updateMutation.mutateAsync({
          id: editingPromoter.id,
          name: formName.trim(),
          phone: formPhone.trim() || undefined,
          companyName: formCompanyName.trim() || undefined,
          taxId: formTaxId.trim() || undefined,
          commissionPercentage: commission,
          billingModel: formBillingModel,
          isActive: formIsActive,
        });
        Alert.alert('Éxito', 'Promotor actualizado correctamente');
      } else {
        await createMutation.mutateAsync({
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          phone: formPhone.trim() || undefined,
          companyName: formCompanyName.trim() || undefined,
          taxId: formTaxId.trim() || undefined,
        });
        Alert.alert('Éxito', 'Promotor creado correctamente');
      }
      setIsModalVisible(false);
      resetForm();
      promotersQuery.refetch();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo guardar');
    }
  };

  const handleDelete = (promoter: any) => {
    Alert.alert(
      'Eliminar Promotor',
      `¿Estás seguro de eliminar a "${promoter.name}"? Esto NO eliminará sus eventos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id: promoter.id });
              Alert.alert('Éxito', 'Promotor eliminado');
              promotersQuery.refetch();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar');
            }
          },
        },
      ]
    );
  };

  const getStripeStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Verificado';
      case 'pending': return 'Pendiente';
      case 'restricted': return 'Restringido';
      default: return 'Sin configurar';
    }
  };

  const getStripeStatusColor = (status: string) => {
    switch (status) {
      case 'active': return Colors.dark.success;
      case 'pending': return Colors.dark.warning;
      case 'restricted': return Colors.dark.error;
      default: return Colors.dark.textMuted;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Gestión de Promotores',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Promotores</Text>
          <Text style={styles.headerSubtitle}>{promoters.length} promotores registrados</Text>
        </View>

        {promotersQuery.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : promoters.length === 0 ? (
          <View style={styles.emptyState}>
            <Building2 color={Colors.dark.textMuted} size={48} />
            <Text style={styles.emptyTitle}>No hay promotores</Text>
            <Text style={styles.emptyText}>Los promotores registrados aparecerán aquí</Text>
          </View>
        ) : (
          promoters.map((promoter) => (
            <View key={promoter.id} style={[styles.promoterCard, !promoter.isActive && styles.promoterCardInactive]}>
              <View style={styles.promoterHeader}>
                <View style={styles.promoterAvatar}>
                  <Building2 color={Colors.dark.secondary} size={24} />
                </View>
                <View style={styles.promoterInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.promoterName}>{promoter.name}</Text>
                    {!promoter.isActive && (
                      <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveBadgeText}>Inactivo</Text>
                      </View>
                    )}
                  </View>
                  {promoter.companyName && (
                    <Text style={styles.companyName}>{promoter.companyName}</Text>
                  )}
                </View>
                <View style={styles.promoterActions}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(promoter)}>
                    <Edit3 color={Colors.dark.primary} size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(promoter)}>
                    <Trash2 color={Colors.dark.error} size={18} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.contactInfo}>
                <View style={styles.contactItem}>
                  <Mail color={Colors.dark.textMuted} size={14} />
                  <Text style={styles.contactText}>{promoter.email}</Text>
                </View>
                {promoter.phone && (
                  <View style={styles.contactItem}>
                    <Phone color={Colors.dark.textMuted} size={14} />
                    <Text style={styles.contactText}>{promoter.phone}</Text>
                  </View>
                )}
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Calendar color={Colors.dark.secondary} size={16} />
                  <Text style={styles.statValue}>{promoter.eventCount || 0}</Text>
                  <Text style={styles.statLabel}>eventos</Text>
                </View>
                <View style={styles.statItem}>
                  <DollarSign color={Colors.dark.success} size={16} />
                  <Text style={styles.statValue}>{formatCurrency(promoter.totalEarnings || 0)}</Text>
                  <Text style={styles.statLabel}>generados</Text>
                </View>
                <View style={styles.statItem}>
                  <Package color={Colors.dark.primary} size={16} />
                  <Text style={styles.statValue}>{promoter.pendingPayout ? formatCurrency(promoter.pendingPayout) : '€0'}</Text>
                  <Text style={styles.statLabel}>pendiente</Text>
                </View>
              </View>

              <View style={styles.commissionRow}>
                <View style={styles.billingModelBadge}>
                  <Text style={styles.billingModelText}>
                    {promoter.billingModel === 'subscription' ? '📅 Suscripción' : '💰 Comisión'}
                  </Text>
                </View>
                {promoter.billingModel !== 'subscription' && (
                  <View style={styles.commissionItem}>
                    <Percent color={Colors.dark.warning} size={16} />
                    <Text style={styles.commissionValue}>{promoter.commissionPercentage ?? 5}%</Text>
                  </View>
                )}
                <View style={styles.stripeStatusItem}>
                  <CreditCard color={getStripeStatusColor(promoter.stripeAccountStatus)} size={16} />
                  <Text style={[styles.stripeStatusText, { color: getStripeStatusColor(promoter.stripeAccountStatus) }]}>
                    {getStripeStatusLabel(promoter.stripeAccountStatus)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
        <View style={styles.bottomPadding} />
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
                {editingPromoter ? 'Editar Promotor' : 'Nuevo Promotor'}
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
                <Text style={styles.inputLabel}>Nombre *</Text>
                <TextInput
                  style={styles.input}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="Nombre del promotor"
                  placeholderTextColor={Colors.dark.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput
                  style={styles.input}
                  value={formEmail}
                  onChangeText={setFormEmail}
                  placeholder="email@ejemplo.com"
                  placeholderTextColor={Colors.dark.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!editingPromoter}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Teléfono</Text>
                <TextInput
                  style={styles.input}
                  value={formPhone}
                  onChangeText={setFormPhone}
                  placeholder="+34 600 000 000"
                  placeholderTextColor={Colors.dark.textMuted}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre de empresa</Text>
                <TextInput
                  style={styles.input}
                  value={formCompanyName}
                  onChangeText={setFormCompanyName}
                  placeholder="Empresa S.L."
                  placeholderTextColor={Colors.dark.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CIF/NIF</Text>
                <TextInput
                  style={styles.input}
                  value={formTaxId}
                  onChangeText={setFormTaxId}
                  placeholder="B12345678"
                  placeholderTextColor={Colors.dark.textMuted}
                  autoCapitalize="characters"
                />
              </View>

              {editingPromoter && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Modelo de facturación</Text>
                    <View style={styles.billingModelSelector}>
                      <TouchableOpacity
                        style={[styles.billingOption, formBillingModel === 'commission' && styles.billingOptionSelected]}
                        onPress={() => setFormBillingModel('commission')}
                      >
                        <Text style={[styles.billingOptionText, formBillingModel === 'commission' && styles.billingOptionTextSelected]}>
                          💰 Comisión
                        </Text>
                        <Text style={styles.billingOptionDesc}>% por venta</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.billingOption, formBillingModel === 'subscription' && styles.billingOptionSelected]}
                        onPress={() => setFormBillingModel('subscription')}
                      >
                        <Text style={[styles.billingOptionText, formBillingModel === 'subscription' && styles.billingOptionTextSelected]}>
                          📅 Suscripción
                        </Text>
                        <Text style={styles.billingOptionDesc}>Cuota mensual</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {formBillingModel === 'commission' && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Comisión por venta (%)</Text>
                      <View style={styles.commissionInputRow}>
                        <TextInput
                          style={[styles.input, styles.commissionInput]}
                          value={formCommission}
                          onChangeText={setFormCommission}
                          placeholder="5"
                          placeholderTextColor={Colors.dark.textMuted}
                          keyboardType="decimal-pad"
                        />
                        <View style={styles.commissionSuffix}>
                          <Percent color={Colors.dark.textMuted} size={18} />
                        </View>
                      </View>
                      <Text style={styles.inputHint}>
                        Porcentaje que la plataforma retiene de cada venta
                      </Text>
                    </View>
                  )}
                </>
              )}

              {editingPromoter && (
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleTitle}>Promotor activo</Text>
                    <Text style={styles.toggleDescription}>
                      Los promotores inactivos no pueden crear eventos
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
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Check color="#FFF" size={18} />
                    <Text style={styles.saveButtonText}>Guardar</Text>
                  </>
                )}
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
  header: {
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginTop: 4,
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
  promoterCard: {
    backgroundColor: Colors.dark.card,
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    padding: 16,
  },
  promoterCardInactive: {
    opacity: 0.6,
  },
  promoterHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  promoterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoterInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promoterName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  inactiveBadge: {
    backgroundColor: Colors.dark.textMuted + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inactiveBadgeText: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    fontWeight: '600',
  },
  companyName: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  promoterActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    backgroundColor: Colors.dark.surface,
    borderRadius: 8,
  },
  contactInfo: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    gap: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  stripeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    gap: 8,
  },
  stripeStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  commissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  commissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commissionValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.warning,
  },
  commissionLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  billingModelBadge: {
    backgroundColor: Colors.dark.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  billingModelText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  billingModelSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  billingOption: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    padding: 14,
    alignItems: 'center',
  },
  billingOptionSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + '15',
  },
  billingOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textMuted,
    marginBottom: 4,
  },
  billingOptionTextSelected: {
    color: Colors.dark.text,
  },
  billingOptionDesc: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  stripeStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commissionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commissionInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  commissionSuffix: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: Colors.dark.border,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputHint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 6,
  },
  bottomPadding: {
    height: 40,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.primary,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
