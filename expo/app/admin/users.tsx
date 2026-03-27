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
import {
  Plus,
  Edit3,
  Trash2,
  X,
  Check,
  User,
  Mail,
  Lock,
  Shield,
  UserCheck,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

interface UserType {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminUsersScreen() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'seller'>('admin');
  const [formIsActive, setFormIsActive] = useState(true);

  const usersQuery = trpc.auth.getUsers.useQuery();
  const registerMutation = trpc.auth.register.useMutation();
  const updateMutation = trpc.auth.updateUser.useMutation();
  const deleteMutation = trpc.auth.deleteUser.useMutation();

  const users = usersQuery.data || [];

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('admin');
    setFormIsActive(true);
    setEditingUser(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalVisible(true);
  };

  const openEditModal = (user: UserType) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormRole(user.role as 'admin' | 'seller');
    setFormIsActive(user.isActive);
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
    if (!editingUser && !formPassword.trim()) {
      Alert.alert('Error', 'La contraseña es obligatoria para nuevos usuarios');
      return;
    }

    try {
      if (editingUser) {
        await updateMutation.mutateAsync({
          id: editingUser.id,
          name: formName.trim(),
          role: formRole,
          isActive: formIsActive,
          ...(formPassword.trim() ? { password: formPassword.trim() } : {}),
        });
        Alert.alert('Éxito', 'Usuario actualizado correctamente');
      } else {
        await registerMutation.mutateAsync({
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          password: formPassword.trim(),
          role: formRole,
        });
        Alert.alert('Éxito', 'Usuario creado correctamente');
      }
      setIsModalVisible(false);
      resetForm();
      usersQuery.refetch();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo guardar el usuario');
    }
  };

  const handleDelete = (user: UserType) => {
    if (user.email === 'devilworks2023@gmail.com') {
      Alert.alert('Error', 'No se puede eliminar el administrador principal');
      return;
    }

    Alert.alert(
      'Eliminar Usuario',
      `¿Estás seguro de eliminar a "${user.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id: user.id });
              Alert.alert('Éxito', 'Usuario eliminado');
              usersQuery.refetch();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar');
            }
          },
        },
      ]
    );
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'seller': return 'Vendedor';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return Colors.dark.primary;
      case 'seller': return Colors.dark.secondary;
      default: return Colors.dark.textMuted;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Usuarios del Sistema',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Gestión de Usuarios</Text>
          <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
            <Plus color="#FFF" size={18} />
            <Text style={styles.addButtonText}>Nuevo</Text>
          </TouchableOpacity>
        </View>

        {usersQuery.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : users.length === 0 ? (
          <View style={styles.emptyState}>
            <User color={Colors.dark.textMuted} size={48} />
            <Text style={styles.emptyTitle}>No hay usuarios</Text>
          </View>
        ) : (
          users.map((user) => (
            <View key={user.id} style={[styles.userCard, !user.isActive && styles.userCardInactive]}>
              <View style={styles.userHeader}>
                <View style={[styles.userAvatar, { backgroundColor: getRoleColor(user.role) + '30' }]}>
                  {user.role === 'admin' ? (
                    <Shield color={getRoleColor(user.role)} size={20} />
                  ) : (
                    <UserCheck color={getRoleColor(user.role)} size={20} />
                  )}
                </View>
                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={styles.userName}>{user.name}</Text>
                    {!user.isActive && (
                      <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveBadgeText}>Inactivo</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) + '20' }]}>
                    <Text style={[styles.roleBadgeText, { color: getRoleColor(user.role) }]}>
                      {getRoleLabel(user.role)}
                    </Text>
                  </View>
                </View>
                <View style={styles.userActions}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(user)}>
                    <Edit3 color={Colors.dark.primary} size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(user)}>
                    <Trash2 color={Colors.dark.error} size={18} />
                  </TouchableOpacity>
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
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
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
                <View style={styles.inputRow}>
                  <User color={Colors.dark.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    value={formName}
                    onChangeText={setFormName}
                    placeholder="Nombre completo"
                    placeholderTextColor={Colors.dark.textMuted}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email *</Text>
                <View style={styles.inputRow}>
                  <Mail color={Colors.dark.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    value={formEmail}
                    onChangeText={setFormEmail}
                    placeholder="email@ejemplo.com"
                    placeholderTextColor={Colors.dark.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!editingUser}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {editingUser ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}
                </Text>
                <View style={styles.inputRow}>
                  <Lock color={Colors.dark.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    value={formPassword}
                    onChangeText={setFormPassword}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.dark.textMuted}
                    secureTextEntry
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Rol</Text>
                <View style={styles.roleSelector}>
                  <TouchableOpacity
                    style={[styles.roleOption, formRole === 'admin' && styles.roleOptionSelected]}
                    onPress={() => setFormRole('admin')}
                  >
                    <Shield color={formRole === 'admin' ? Colors.dark.primary : Colors.dark.textMuted} size={20} />
                    <Text style={[styles.roleOptionText, formRole === 'admin' && styles.roleOptionTextSelected]}>
                      Administrador
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleOption, formRole === 'seller' && styles.roleOptionSelected]}
                    onPress={() => setFormRole('seller')}
                  >
                    <UserCheck color={formRole === 'seller' ? Colors.dark.secondary : Colors.dark.textMuted} size={20} />
                    <Text style={[styles.roleOptionText, formRole === 'seller' && styles.roleOptionTextSelected]}>
                      Vendedor
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {editingUser && (
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleTitle}>Usuario activo</Text>
                    <Text style={styles.toggleDescription}>
                      Los usuarios inactivos no pueden iniciar sesión
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
                disabled={registerMutation.isPending || updateMutation.isPending}
              >
                {registerMutation.isPending || updateMutation.isPending ? (
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
  userCard: {
    backgroundColor: Colors.dark.card,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 14,
  },
  userCardInactive: {
    opacity: 0.6,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
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
  userEmail: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    backgroundColor: Colors.dark.surface,
    borderRadius: 8,
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.dark.text,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 14,
    gap: 8,
  },
  roleOptionSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + '15',
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  roleOptionTextSelected: {
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
