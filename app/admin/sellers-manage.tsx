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
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  Mail,
  Phone,
  Hash,
  Edit3,
  Trash2,
  X,
  Check,
  Ticket,
  DollarSign,
  Eye,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function AdminSellersManageScreen() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSeller, setEditingSeller] = useState<any>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formCommissionPercentage, setFormCommissionPercentage] = useState('10');

  const sellersQuery = trpc.sellers.list.useQuery();
  const createMutation = trpc.sellers.create.useMutation();
  const updateMutation = trpc.sellers.update.useMutation();
  const deleteMutation = trpc.sellers.delete.useMutation();

  const sellers = sellersQuery.data || [];

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormCode(generateCode());
    setFormIsActive(true);
    setFormCommissionPercentage('10');
    setEditingSeller(null);
  };

  const openCreateModal = () => {
    resetForm();
    setFormCode(generateCode());
    setIsModalVisible(true);
  };

  const openEditModal = (seller: any) => {
    setEditingSeller(seller);
    setFormName(seller.name);
    setFormEmail(seller.email);
    setFormPhone(seller.phone || '');
    setFormIsActive(seller.isActive);
    setFormCommissionPercentage(seller.commissionPercentage?.toString() || '10');
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
      const commissionValue = parseFloat(formCommissionPercentage);
      if (isNaN(commissionValue) || commissionValue < 0 || commissionValue > 100) {
        Alert.alert('Error', 'La comisión debe ser un número entre 0 y 100');
        return;
      }

      if (editingSeller) {
        await updateMutation.mutateAsync({
          id: editingSeller.id,
          name: formName.trim(),
          phone: formPhone.trim() || undefined,
          isActive: formIsActive,
          commissionPercentage: commissionValue,
        });
        Alert.alert('Éxito', 'Vendedor actualizado correctamente');
      } else {
        await createMutation.mutateAsync({
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          phone: formPhone.trim() || undefined,
          code: formCode.trim().toUpperCase(),
          commissionPercentage: commissionValue,
        });
        Alert.alert('Éxito', 'Vendedor creado correctamente');
      }
      setIsModalVisible(false);
      resetForm();
      sellersQuery.refetch();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo guardar');
    }
  };

  const handleDelete = (seller: any) => {
    Alert.alert(
      'Eliminar Vendedor',
      `¿Estás seguro de eliminar a "${seller.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id: seller.id });
              Alert.alert('Éxito', 'Vendedor eliminado');
              sellersQuery.refetch();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Gestión de Vendedores',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Vendedores / RRPP</Text>
            <Text style={styles.headerSubtitle}>{sellers.length} vendedores registrados</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
            <Text style={styles.addButtonText}>+ Nuevo</Text>
          </TouchableOpacity>
        </View>

        {sellersQuery.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : sellers.length === 0 ? (
          <View style={styles.emptyState}>
            <Users color={Colors.dark.textMuted} size={48} />
            <Text style={styles.emptyTitle}>No hay vendedores</Text>
            <Text style={styles.emptyText}>Añade vendedores para que puedan vender entradas</Text>
          </View>
        ) : (
          sellers.map((seller) => (
            <View key={seller.id} style={[styles.sellerCard, !seller.isActive && styles.sellerCardInactive]}>
              <View style={styles.sellerHeader}>
                <View style={styles.sellerAvatar}>
                  <Users color="#9b59b6" size={22} />
                </View>
                <View style={styles.sellerInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.sellerName}>{seller.name}</Text>
                    {!seller.isActive && (
                      <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveBadgeText}>Inactivo</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.codeContainer}>
                    <Hash color={Colors.dark.primary} size={14} />
                    <Text style={styles.sellerCode}>{seller.code}</Text>
                  </View>
                </View>
                <View style={styles.sellerActions}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => router.push(`/seller/${seller.id}`)}>
                    <Eye color={Colors.dark.textMuted} size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(seller)}>
                    <Edit3 color={Colors.dark.primary} size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(seller)}>
                    <Trash2 color={Colors.dark.error} size={18} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.contactInfo}>
                <View style={styles.contactItem}>
                  <Mail color={Colors.dark.textMuted} size={14} />
                  <Text style={styles.contactText}>{seller.email}</Text>
                </View>
                {seller.phone && (
                  <View style={styles.contactItem}>
                    <Phone color={Colors.dark.textMuted} size={14} />
                    <Text style={styles.contactText}>{seller.phone}</Text>
                  </View>
                )}
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Ticket color={Colors.dark.secondary} size={16} />
                  <Text style={styles.statValue}>{seller.totalSales || 0}</Text>
                  <Text style={styles.statLabel}>ventas</Text>
                </View>
                <View style={styles.statItem}>
                  <DollarSign color={Colors.dark.success} size={16} />
                  <Text style={styles.statValue}>{formatCurrency(seller.totalRevenue || 0)}</Text>
                  <Text style={styles.statLabel}>generado</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.commissionBadge}>{seller.commissionPercentage || 10}%</Text>
                  <Text style={styles.statLabel}>comisión</Text>
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
                {editingSeller ? 'Editar Vendedor' : 'Nuevo Vendedor'}
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
                  placeholder="Nombre del vendedor"
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
                  editable={!editingSeller}
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
                <Text style={styles.inputLabel}>Comisión por venta (%)</Text>
                <TextInput
                  style={styles.input}
                  value={formCommissionPercentage}
                  onChangeText={setFormCommissionPercentage}
                  placeholder="10"
                  placeholderTextColor={Colors.dark.textMuted}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.inputHint}>Porcentaje de comisión que recibe por cada venta (0-100)</Text>
              </View>

              {editingSeller && (
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleTitle}>Vendedor activo</Text>
                    <Text style={styles.toggleDescription}>
                      Los vendedores inactivos no pueden vender entradas
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

              {!editingSeller && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Código de vendedor *</Text>
                  <TextInput
                    style={styles.input}
                    value={formCode}
                    onChangeText={(text) => setFormCode(text.toUpperCase())}
                    placeholder="ABC123"
                    placeholderTextColor={Colors.dark.textMuted}
                    autoCapitalize="characters"
                    maxLength={10}
                  />
                  <Text style={styles.inputHint}>Código único para identificar las ventas de este vendedor</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    marginTop: 2,
  },
  addButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
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
    textAlign: 'center',
  },
  sellerCard: {
    backgroundColor: Colors.dark.card,
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    padding: 16,
  },
  sellerCardInactive: {
    opacity: 0.6,
  },
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sellerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#9b59b620',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sellerName: {
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
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  sellerCode: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.primary,
    fontFamily: 'monospace',
  },
  sellerActions: {
    flexDirection: 'row',
    gap: 6,
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
    gap: 24,
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
  infoBox: {
    backgroundColor: Colors.dark.primary + '15',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.primary,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
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
  inputHint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 6,
  },
  commissionBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.warning,
  },
});
