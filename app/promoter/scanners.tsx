import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Share, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserPlus, Copy, Trash2, Users, QrCode, Link2, Calendar, ChevronDown, ChevronUp, Mail, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';

export default function PromoterScannersScreen() {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [maxUses, setMaxUses] = useState('1');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [expandedSection, setExpandedSection] = useState<'invitations' | 'users' | null>('invitations');

  const promotersQuery = trpc.promoters.list.useQuery();
  const currentPromoter = promotersQuery.data?.find(
    p => p.email.toLowerCase() === user?.email?.toLowerCase()
  );

  const eventsQuery = trpc.events.list.useQuery();
  const promoterEvents = eventsQuery.data?.filter(e => e.promoterId === currentPromoter?.id) || [];

  const invitationsQuery = trpc.scanner.getInvitations.useQuery(
    { promoterId: currentPromoter?.id || '' },
    { enabled: !!currentPromoter?.id }
  );

  const scannersQuery = trpc.scanner.getScannerUsers.useQuery(
    { promoterId: currentPromoter?.id || '' },
    { enabled: !!currentPromoter?.id }
  );

  const createInvitationMutation = trpc.scanner.createInvitation.useMutation({
    onSuccess: () => {
      invitationsQuery.refetch();
      setShowCreateForm(false);
      setSelectedEventId(null);
      setMaxUses('1');
      setExpiresInDays('7');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Éxito', 'Código de invitación creado correctamente');
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const deleteInvitationMutation = trpc.scanner.deleteInvitation.useMutation({
    onSuccess: () => {
      invitationsQuery.refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const toggleInvitationMutation = trpc.scanner.toggleInvitation.useMutation({
    onSuccess: () => {
      invitationsQuery.refetch();
    },
  });

  const deleteScannerMutation = trpc.scanner.deleteScannerUser.useMutation({
    onSuccess: () => {
      scannersQuery.refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const toggleScannerMutation = trpc.scanner.updateScannerUser.useMutation({
    onSuccess: () => {
      scannersQuery.refetch();
    },
  });

  const handleCreateInvitation = () => {
    if (!currentPromoter?.id) return;

    createInvitationMutation.mutate({
      promoterId: currentPromoter.id,
      eventId: selectedEventId || undefined,
      maxUses: parseInt(maxUses) || 1,
      expiresInDays: parseInt(expiresInDays) || undefined,
    });
  };

  const copyToClipboard = useCallback(async (code: string) => {
    await Clipboard.setStringAsync(code);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copiado', 'Código copiado al portapapeles');
  }, []);

  const shareInvitation = useCallback(async (code: string) => {
    const baseUrl = Platform.OS === 'web' ? window.location.origin : 'https://ticketzone.app';
    const link = `${baseUrl}/scanner/access?code=${code}`;
    
    try {
      await Share.share({
        message: `Únete como personal de escaneo de entradas. Usa el código: ${code}\n\nO accede directamente: ${link}`,
        title: 'Invitación de Escaneo',
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  }, []);

  const handleDeleteInvitation = (id: string) => {
    Alert.alert(
      'Eliminar invitación',
      '¿Estás seguro de eliminar esta invitación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteInvitationMutation.mutate({ id }) },
      ]
    );
  };

  const handleDeleteScanner = (id: string, name: string) => {
    Alert.alert(
      'Eliminar personal',
      `¿Estás seguro de eliminar a ${name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteScannerMutation.mutate({ id }) },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isLoading = promotersQuery.isLoading || invitationsQuery.isLoading || scannersQuery.isLoading;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  if (!currentPromoter) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ title: 'Personal de Escaneo' }} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No se encontró tu cuenta de promotor</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Personal de Escaneo' }} />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Users color={Colors.dark.primary} size={28} />
          </View>
          <Text style={styles.headerTitle}>Gestión de Personal</Text>
          <Text style={styles.headerSubtitle}>
            Crea códigos de invitación para que tu personal pueda escanear entradas en tus eventos
          </Text>
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateForm(!showCreateForm)}
        >
          <UserPlus color="#FFF" size={20} />
          <Text style={styles.createButtonText}>
            {showCreateForm ? 'Cancelar' : 'Crear Invitación'}
          </Text>
        </TouchableOpacity>

        {showCreateForm && (
          <View style={styles.createForm}>
            <Text style={styles.formLabel}>Evento (opcional)</Text>
            <Text style={styles.formHint}>Si no seleccionas evento, el personal tendrá acceso a todos tus eventos activos</Text>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventPicker}>
              <TouchableOpacity
                style={[styles.eventChip, !selectedEventId && styles.eventChipSelected]}
                onPress={() => setSelectedEventId(null)}
              >
                <Text style={[styles.eventChipText, !selectedEventId && styles.eventChipTextSelected]}>
                  Todos los eventos
                </Text>
              </TouchableOpacity>
              {promoterEvents.map(event => (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.eventChip, selectedEventId === event.id && styles.eventChipSelected]}
                  onPress={() => setSelectedEventId(event.id)}
                >
                  <Text style={[styles.eventChipText, selectedEventId === event.id && styles.eventChipTextSelected]}>
                    {event.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Usos máximos</Text>
                <TextInput
                  style={styles.input}
                  value={maxUses}
                  onChangeText={setMaxUses}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={Colors.dark.textMuted}
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Expira en (días)</Text>
                <TextInput
                  style={styles.input}
                  value={expiresInDays}
                  onChangeText={setExpiresInDays}
                  keyboardType="number-pad"
                  placeholder="7"
                  placeholderTextColor={Colors.dark.textMuted}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, createInvitationMutation.isPending && styles.submitButtonDisabled]}
              onPress={handleCreateInvitation}
              disabled={createInvitationMutation.isPending}
            >
              {createInvitationMutation.isPending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Crear Código</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setExpandedSection(expandedSection === 'invitations' ? null : 'invitations')}
        >
          <View style={styles.sectionHeaderLeft}>
            <QrCode color={Colors.dark.primary} size={20} />
            <Text style={styles.sectionTitle}>Códigos de Invitación</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{invitationsQuery.data?.length || 0}</Text>
            </View>
          </View>
          {expandedSection === 'invitations' ? (
            <ChevronUp color={Colors.dark.textMuted} size={20} />
          ) : (
            <ChevronDown color={Colors.dark.textMuted} size={20} />
          )}
        </TouchableOpacity>

        {expandedSection === 'invitations' && (
          <View style={styles.sectionContent}>
            {invitationsQuery.data?.length === 0 ? (
              <Text style={styles.emptyText}>No hay códigos de invitación creados</Text>
            ) : (
              invitationsQuery.data?.map(invitation => (
                <View key={invitation.id} style={styles.invitationCard}>
                  <View style={styles.invitationHeader}>
                    <View style={styles.codeContainer}>
                      <Text style={styles.codeLabel}>Código</Text>
                      <Text style={styles.codeValue}>{invitation.code}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => toggleInvitationMutation.mutate({ id: invitation.id, isActive: !invitation.isActive })}
                    >
                      {invitation.isActive ? (
                        <ToggleRight color={Colors.dark.success} size={28} />
                      ) : (
                        <ToggleLeft color={Colors.dark.textMuted} size={28} />
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.invitationInfo}>
                    {invitation.eventName ? (
                      <View style={styles.infoRow}>
                        <Calendar color={Colors.dark.textMuted} size={14} />
                        <Text style={styles.infoText}>{invitation.eventName}</Text>
                      </View>
                    ) : (
                      <View style={styles.infoRow}>
                        <RefreshCw color={Colors.dark.secondary} size={14} />
                        <Text style={[styles.infoText, { color: Colors.dark.secondary }]}>Todos los eventos</Text>
                      </View>
                    )}
                    <Text style={styles.usageText}>
                      Usos: {invitation.currentUses}/{invitation.maxUses}
                    </Text>
                    {invitation.expiresAt && (
                      <Text style={styles.expiresText}>
                        Expira: {formatDate(invitation.expiresAt)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.invitationActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => copyToClipboard(invitation.code)}
                    >
                      <Copy color={Colors.dark.primary} size={18} />
                      <Text style={styles.actionButtonText}>Copiar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => shareInvitation(invitation.code)}
                    >
                      <Link2 color={Colors.dark.secondary} size={18} />
                      <Text style={[styles.actionButtonText, { color: Colors.dark.secondary }]}>Compartir</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDeleteInvitation(invitation.id)}
                    >
                      <Trash2 color={Colors.dark.error} size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setExpandedSection(expandedSection === 'users' ? null : 'users')}
        >
          <View style={styles.sectionHeaderLeft}>
            <Users color={Colors.dark.secondary} size={20} />
            <Text style={styles.sectionTitle}>Personal Registrado</Text>
            <View style={[styles.badge, { backgroundColor: Colors.dark.secondary + '20' }]}>
              <Text style={[styles.badgeText, { color: Colors.dark.secondary }]}>{scannersQuery.data?.length || 0}</Text>
            </View>
          </View>
          {expandedSection === 'users' ? (
            <ChevronUp color={Colors.dark.textMuted} size={20} />
          ) : (
            <ChevronDown color={Colors.dark.textMuted} size={20} />
          )}
        </TouchableOpacity>

        {expandedSection === 'users' && (
          <View style={styles.sectionContent}>
            {scannersQuery.data?.length === 0 ? (
              <Text style={styles.emptyText}>No hay personal registrado aún</Text>
            ) : (
              scannersQuery.data?.map(scanner => (
                <View key={scanner.id} style={styles.scannerCard}>
                  <View style={styles.scannerInfo}>
                    <View style={styles.scannerAvatar}>
                      <Text style={styles.scannerAvatarText}>
                        {scanner.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.scannerDetails}>
                      <Text style={styles.scannerName}>{scanner.name}</Text>
                      <View style={styles.scannerEmail}>
                        <Mail color={Colors.dark.textMuted} size={12} />
                        <Text style={styles.scannerEmailText}>{scanner.email}</Text>
                      </View>
                      {scanner.events.length > 0 && (
                        <Text style={styles.scannerEvents}>
                          Eventos: {scanner.events.map(e => e.name).join(', ')}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.scannerActions}>
                    <TouchableOpacity
                      onPress={() => toggleScannerMutation.mutate({ id: scanner.id, isActive: !scanner.isActive })}
                    >
                      {scanner.isActive ? (
                        <ToggleRight color={Colors.dark.success} size={28} />
                      ) : (
                        <ToggleLeft color={Colors.dark.textMuted} size={28} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteScanner(scanner.id, scanner.name)}
                    >
                      <Trash2 color={Colors.dark.error} size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 12,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.primary,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  createForm: {
    backgroundColor: Colors.dark.card,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  formHint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: 12,
  },
  eventPicker: {
    marginBottom: 16,
  },
  eventChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.dark.background,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  eventChipSelected: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  eventChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  eventChipTextSelected: {
    color: '#FFF',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  formField: {
    flex: 1,
  },
  input: {
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: Colors.dark.success,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.dark.card,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  badge: {
    backgroundColor: Colors.dark.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  sectionContent: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  invitationCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  invitationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  codeContainer: {},
  codeLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
  codeValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.dark.primary,
    letterSpacing: 1,
  },
  iconButton: {
    padding: 4,
  },
  invitationInfo: {
    marginBottom: 12,
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  usageText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  expiresText: {
    fontSize: 12,
    color: Colors.dark.warning,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.dark.background,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  scannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  scannerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scannerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  scannerAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.secondary,
  },
  scannerDetails: {
    flex: 1,
  },
  scannerName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  scannerEmail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scannerEmailText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  scannerEvents: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  scannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    padding: 8,
  },
});
