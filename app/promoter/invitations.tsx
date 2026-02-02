import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy, 
  Users, 
  QrCode,
  Calendar,
  Hash,
  X,
  CheckCircle,
  XCircle,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import Colors from '@/constants/colors';

export default function PromoterInvitationsScreen() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [newCodeType, setNewCodeType] = useState<'seller' | 'scanner'>('seller');
  const [maxUses, setMaxUses] = useState('1');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [isCreating, setIsCreating] = useState(false);

  const promoterId = user?.promoterId || '';
  const codesQuery = trpc.auth.getPromoterInvitationCodes.useQuery(
    { promoterId },
    { enabled: !!promoterId }
  );
  const createMutation = trpc.auth.createPromoterInvitationCode.useMutation();
  const deleteMutation = trpc.auth.deleteInvitationCode.useMutation();
  const toggleMutation = trpc.auth.toggleInvitationCode.useMutation();

  const codes = codesQuery.data || [];

  const handleCreateCode = async () => {
    if (!promoterId) {
      Alert.alert('Error', 'No se encontró el ID del promotor');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createMutation.mutateAsync({
        type: newCodeType,
        promoterId,
        maxUses: parseInt(maxUses) || 1,
        expiresInDays: parseInt(expiresInDays) || undefined,
      });

      if (result.success) {
        Alert.alert(
          'Código Creado',
          `El código ${result.code} ha sido creado exitosamente.`,
          [
            { text: 'Copiar', onPress: () => Clipboard.setStringAsync(result.code) },
            { text: 'OK' },
          ]
        );
        setShowModal(false);
        codesQuery.refetch();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo crear el código');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCode = (id: string, code: string) => {
    Alert.alert(
      'Eliminar Código',
      `¿Estás seguro de eliminar el código ${code}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id });
              codesQuery.refetch();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleToggleCode = async (id: string, isActive: boolean) => {
    try {
      await toggleMutation.mutateAsync({ id, isActive: !isActive });
      codesQuery.refetch();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleCopyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copiado', 'Código copiado al portapapeles');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Sin expiración';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerTitle: 'Códigos de Invitación',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Mis Códigos</Text>
            <Text style={styles.subtitle}>
              Genera códigos para vendedores y scanners de tu equipo
            </Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
            <Plus color="#000" size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Users color={Colors.dark.secondary} size={20} />
            <Text style={styles.statValue}>
              {codes.filter(c => c.type === 'seller').length}
            </Text>
            <Text style={styles.statLabel}>Vendedores</Text>
          </View>
          <View style={styles.statCard}>
            <QrCode color={Colors.dark.primary} size={20} />
            <Text style={styles.statValue}>
              {codes.filter(c => c.type === 'scanner').length}
            </Text>
            <Text style={styles.statLabel}>Scanners</Text>
          </View>
          <View style={styles.statCard}>
            <CheckCircle color={Colors.dark.success} size={20} />
            <Text style={styles.statValue}>
              {codes.filter(c => c.isActive).length}
            </Text>
            <Text style={styles.statLabel}>Activos</Text>
          </View>
        </View>

        {codesQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : codes.length === 0 ? (
          <View style={styles.emptyState}>
            <Key color={Colors.dark.textMuted} size={48} />
            <Text style={styles.emptyTitle}>Sin códigos</Text>
            <Text style={styles.emptySubtitle}>
              Crea códigos de invitación para añadir vendedores y scanners a tu equipo
            </Text>
          </View>
        ) : (
          <View style={styles.codesList}>
            {codes.map(code => (
              <View key={code.id} style={[styles.codeCard, !code.isActive && styles.codeCardInactive]}>
                <View style={styles.codeHeader}>
                  <View style={styles.codeTypeContainer}>
                    {code.type === 'seller' ? (
                      <Users color={Colors.dark.secondary} size={16} />
                    ) : (
                      <QrCode color={Colors.dark.primary} size={16} />
                    )}
                    <Text style={styles.codeType}>
                      {code.type === 'seller' ? 'Vendedor/RRPP' : 'Scanner'}
                    </Text>
                  </View>
                  <View style={styles.codeActions}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleCopyCode(code.code)}
                    >
                      <Copy color={Colors.dark.textSecondary} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleToggleCode(code.id, code.isActive)}
                    >
                      {code.isActive ? (
                        <CheckCircle color={Colors.dark.success} size={18} />
                      ) : (
                        <XCircle color={Colors.dark.error} size={18} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleDeleteCode(code.id, code.code)}
                    >
                      <Trash2 color={Colors.dark.error} size={18} />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.codeValue}
                  onPress={() => handleCopyCode(code.code)}
                >
                  <Text style={styles.codeText}>{code.code}</Text>
                </TouchableOpacity>

                <View style={styles.codeDetails}>
                  <View style={styles.codeDetail}>
                    <Hash color={Colors.dark.textMuted} size={14} />
                    <Text style={styles.codeDetailText}>
                      Usos: {code.currentUses}/{code.maxUses === 0 ? '∞' : code.maxUses}
                    </Text>
                  </View>
                  <View style={styles.codeDetail}>
                    <Calendar color={Colors.dark.textMuted} size={14} />
                    <Text style={styles.codeDetailText}>
                      {formatDate(code.expiresAt)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Código</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X color={Colors.dark.text} size={24} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Tipo de rol</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeOption, newCodeType === 'seller' && styles.typeOptionSelected]}
                onPress={() => setNewCodeType('seller')}
              >
                <Users color={newCodeType === 'seller' ? '#000' : Colors.dark.textMuted} size={20} />
                <Text style={[styles.typeOptionText, newCodeType === 'seller' && styles.typeOptionTextSelected]}>
                  Vendedor/RRPP
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeOption, newCodeType === 'scanner' && styles.typeOptionSelected]}
                onPress={() => setNewCodeType('scanner')}
              >
                <QrCode color={newCodeType === 'scanner' ? '#000' : Colors.dark.textMuted} size={20} />
                <Text style={[styles.typeOptionText, newCodeType === 'scanner' && styles.typeOptionTextSelected]}>
                  Scanner
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Máximo de usos</Text>
            <TextInput
              style={styles.modalInput}
              value={maxUses}
              onChangeText={setMaxUses}
              keyboardType="number-pad"
              placeholder="1 (0 = ilimitado)"
              placeholderTextColor={Colors.dark.textMuted}
            />

            <Text style={styles.inputLabel}>Expira en (días)</Text>
            <TextInput
              style={styles.modalInput}
              value={expiresInDays}
              onChangeText={setExpiresInDays}
              keyboardType="number-pad"
              placeholder="30 (vacío = sin expiración)"
              placeholderTextColor={Colors.dark.textMuted}
            />

            <TouchableOpacity
              style={[styles.createButton, isCreating && styles.createButtonDisabled]}
              onPress={handleCreateCode}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.createButtonText}>Generar Código</Text>
              )}
            </TouchableOpacity>
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
    alignItems: 'flex-start',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    maxWidth: 250,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
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
    lineHeight: 20,
  },
  codesList: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 20,
  },
  codeCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  codeCardInactive: {
    opacity: 0.6,
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  codeTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  codeType: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  codeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeValue: {
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  codeText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.primary,
    textAlign: 'center',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  codeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  codeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeDetailText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeOptionSelected: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  typeOptionTextSelected: {
    color: '#000',
  },
  modalInput: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 14,
    color: Colors.dark.text,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  createButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
