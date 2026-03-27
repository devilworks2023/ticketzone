import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { User, Copy, Trash2, Mail, Phone, TrendingUp, Plus, Minus } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/contexts/AppContext';
import Colors from '@/constants/colors';
import { CommissionTier } from '@/types';

export default function SellerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { sellers, updateSeller, deleteSeller } = useApp();
  const seller = sellers.find(s => s.id === id);

  const [isEditing, setIsEditing] = useState(false);
  const [editedTiers, setEditedTiers] = useState<CommissionTier[]>([]);

  if (!seller) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Vendedor no encontrado</Text>
      </View>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getCurrentCommission = () => {
    const tier = seller.commissionTiers.find(
      t => seller.totalSales >= t.minSales && (t.maxSales === null || seller.totalSales <= t.maxSales)
    );
    return tier?.percentage || 0;
  };

  const commissionEarned = seller.totalRevenue * (getCurrentCommission() / 100);

  const copyCode = async () => {
    await Clipboard.setStringAsync(seller.code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copiado', 'Código copiado al portapapeles');
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar Vendedor',
      '¿Estás seguro de que quieres eliminar este vendedor?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteSeller(seller.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          },
        },
      ]
    );
  };

  const startEditing = () => {
    setEditedTiers([...seller.commissionTiers]);
    setIsEditing(true);
  };

  const saveCommissions = async () => {
    const sortedTiers = [...editedTiers].sort((a, b) => a.minSales - b.minSales);
    await updateSeller(seller.id, { commissionTiers: sortedTiers });
    setIsEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const addTier = () => {
    const lastTier = editedTiers[editedTiers.length - 1];
    const newMin = lastTier ? (lastTier.maxSales || lastTier.minSales) + 1 : 0;
    setEditedTiers([
      ...editedTiers.slice(0, -1),
      { ...lastTier, maxSales: newMin - 1 },
      { minSales: newMin, maxSales: null, percentage: (lastTier?.percentage || 5) + 2 },
    ]);
  };

  const updateTier = (index: number, field: keyof CommissionTier, value: number | null) => {
    const updated = [...editedTiers];
    updated[index] = { ...updated[index], [field]: value };
    setEditedTiers(updated);
  };

  const removeTier = (index: number) => {
    if (editedTiers.length <= 1) return;
    setEditedTiers(editedTiers.filter((_, i) => i !== index));
  };

  const toggleActive = async () => {
    await updateSeller(seller.id, { isActive: !seller.isActive });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Stack.Screen 
        options={{ 
          headerRight: () => (
            <TouchableOpacity onPress={handleDelete}>
              <Trash2 color={Colors.dark.error} size={20} />
            </TouchableOpacity>
          ),
        }} 
      />

      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          <User color={Colors.dark.text} size={40} />
        </View>
        <Text style={styles.sellerName}>{seller.name}</Text>
        <TouchableOpacity style={styles.codeBox} onPress={copyCode}>
          <Text style={styles.codeText}>{seller.code}</Text>
          <Copy color={Colors.dark.secondary} size={16} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statusToggle, seller.isActive ? styles.statusActive : styles.statusInactive]}
          onPress={toggleActive}
        >
          <Text style={styles.statusText}>{seller.isActive ? 'ACTIVO' : 'INACTIVO'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contactCard}>
        <View style={styles.contactItem}>
          <Mail color={Colors.dark.textMuted} size={18} />
          <Text style={styles.contactText}>{seller.email}</Text>
        </View>
        <View style={styles.contactItem}>
          <Phone color={Colors.dark.textMuted} size={18} />
          <Text style={styles.contactText}>{seller.phone}</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{seller.totalSales}</Text>
          <Text style={styles.statLabel}>Ventas Totales</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatCurrency(seller.totalRevenue)}</Text>
          <Text style={styles.statLabel}>Ingresos Generados</Text>
        </View>
        <View style={[styles.statCard, styles.statCardWide]}>
          <View style={styles.statRow}>
            <TrendingUp color={Colors.dark.success} size={24} />
            <View>
              <Text style={[styles.statValue, { color: Colors.dark.success }]}>
                {formatCurrency(commissionEarned)}
              </Text>
              <Text style={styles.statLabel}>Comisión Ganada ({getCurrentCommission()}%)</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tramos de Comisión</Text>
          {!isEditing ? (
            <TouchableOpacity onPress={startEditing}>
              <Text style={styles.editButton}>Editar</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <Text style={styles.cancelButton}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveCommissions}>
                <Text style={styles.saveButton}>Guardar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {isEditing ? (
          <View style={styles.tiersEditContainer}>
            {editedTiers.map((tier, index) => (
              <View key={index} style={styles.tierEditCard}>
                <View style={styles.tierEditRow}>
                  <View style={styles.tierEditField}>
                    <Text style={styles.tierEditLabel}>Desde</Text>
                    <TextInput
                      style={styles.tierEditInput}
                      value={tier.minSales.toString()}
                      onChangeText={(t) => updateTier(index, 'minSales', parseInt(t) || 0)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.tierEditField}>
                    <Text style={styles.tierEditLabel}>Hasta</Text>
                    <TextInput
                      style={styles.tierEditInput}
                      value={tier.maxSales?.toString() || '∞'}
                      onChangeText={(t) => updateTier(index, 'maxSales', t === '∞' || t === '' ? null : parseInt(t) || null)}
                      keyboardType="numeric"
                      placeholder="∞"
                      placeholderTextColor={Colors.dark.textMuted}
                    />
                  </View>
                  <View style={styles.tierEditField}>
                    <Text style={styles.tierEditLabel}>%</Text>
                    <TextInput
                      style={[styles.tierEditInput, styles.tierPercentInput]}
                      value={tier.percentage.toString()}
                      onChangeText={(t) => updateTier(index, 'percentage', parseFloat(t) || 0)}
                      keyboardType="numeric"
                    />
                  </View>
                  <TouchableOpacity 
                    style={styles.removeTierButton}
                    onPress={() => removeTier(index)}
                  >
                    <Minus color={Colors.dark.error} size={16} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addTierButton} onPress={addTier}>
              <Plus color={Colors.dark.primary} size={18} />
              <Text style={styles.addTierText}>Añadir tramo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.tiersContainer}>
            {seller.commissionTiers.map((tier, index) => {
              const isCurrentTier = seller.totalSales >= tier.minSales && 
                (tier.maxSales === null || seller.totalSales <= tier.maxSales);
              
              return (
                <View 
                  key={index} 
                  style={[styles.tierCard, isCurrentTier && styles.tierCardActive]}
                >
                  <View style={styles.tierRange}>
                    <Text style={[styles.tierRangeText, isCurrentTier && styles.tierTextActive]}>
                      {tier.minSales} - {tier.maxSales ?? '∞'} ventas
                    </Text>
                  </View>
                  <Text style={[styles.tierPercent, isCurrentTier && styles.tierTextActive]}>
                    {tier.percentage}%
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.shareSection}>
        <Text style={styles.shareTitle}>Enlace de Venta</Text>
        <Text style={styles.shareDescription}>
          Comparte este enlace para que las ventas se asignen a este vendedor
        </Text>
        <TouchableOpacity 
          style={styles.shareLink}
          onPress={() => {
            Clipboard.setStringAsync(`https://tickets.app?ref=${seller.code}`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Copiado', 'Enlace copiado');
          }}
        >
          <Text style={styles.shareLinkText}>
            tickets.app?ref={seller.code}
          </Text>
          <Copy color={Colors.dark.secondary} size={16} />
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    padding: 20,
  },
  errorText: {
    color: Colors.dark.error,
    textAlign: 'center',
    marginTop: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sellerName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  codeText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.secondary,
    fontFamily: 'monospace',
  },
  statusToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusActive: {
    backgroundColor: Colors.dark.success + '20',
  },
  statusInactive: {
    backgroundColor: Colors.dark.textMuted + '20',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.success,
    letterSpacing: 0.5,
  },
  contactCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactText: {
    fontSize: 15,
    color: Colors.dark.text,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
  },
  statCardWide: {
    minWidth: '100%',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
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
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  editButton: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  editActions: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelButton: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  saveButton: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.success,
  },
  tiersContainer: {
    gap: 10,
  },
  tierCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tierCardActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + '10',
  },
  tierRange: {
    flex: 1,
  },
  tierRangeText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  tierPercent: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  tierTextActive: {
    color: Colors.dark.primary,
  },
  tiersEditContainer: {
    gap: 10,
  },
  tierEditCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 12,
  },
  tierEditRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  tierEditField: {
    flex: 1,
  },
  tierEditLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: 4,
  },
  tierEditInput: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  tierPercentInput: {
    backgroundColor: Colors.dark.primary + '20',
  },
  removeTierButton: {
    padding: 10,
  },
  addTierButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderStyle: 'dashed',
  },
  addTierText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  shareSection: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 20,
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 6,
  },
  shareDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 14,
  },
  shareLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 14,
  },
  shareLinkText: {
    fontSize: 14,
    color: Colors.dark.secondary,
    fontFamily: 'monospace',
  },
});
