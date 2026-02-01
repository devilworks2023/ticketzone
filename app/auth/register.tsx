import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Lock, Mail, User, Eye, EyeOff, ArrowLeft, Ticket } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import Colors from '@/constants/colors';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const registerMutation = trpc.auth.registerUser.useMutation();

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu nombre');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu email');
      return;
    }
    if (!password.trim() || password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    setIsLoading(true);
    try {
      const result = await registerMutation.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (result.success) {
        const res = result as any;
        if (res.requiresVerification) {
          router.replace({
            pathname: '/auth/verify-email',
            params: { email: res.email },
          });
        } else {
          Alert.alert(
            'Registro Exitoso',
            'Tu cuenta ha sido creada. Ahora puedes iniciar sesión.',
            [{ text: 'Iniciar Sesión', onPress: () => router.replace('/auth/login') }]
          );
        }
      }
    } catch (error: any) {
      console.log('Register error:', error);
      Alert.alert('Error', error.message || 'Ocurrió un error al registrarse');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft color={Colors.dark.text} size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ticket color={Colors.dark.primary} size={40} />
              </View>
              <Text style={styles.title}>Crear Cuenta</Text>
              <Text style={styles.subtitle}>Regístrate para comprar entradas</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <User color={Colors.dark.textMuted} size={20} />
                <TextInput
                  style={styles.input}
                  placeholder="Nombre completo"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Mail color={Colors.dark.textMuted} size={20} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Lock color={Colors.dark.textMuted} size={20} />
                <TextInput
                  style={styles.input}
                  placeholder="Contraseña (mín. 6 caracteres)"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <EyeOff color={Colors.dark.textMuted} size={20} />
                  ) : (
                    <Eye color={Colors.dark.textMuted} size={20} />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Lock color={Colors.dark.textMuted} size={20} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar contraseña"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>

              <TouchableOpacity
                style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.registerButtonText}>Registrarse</Text>
                )}
              </TouchableOpacity>

              <View style={styles.loginLinkContainer}>
                <Text style={styles.loginLinkText}>¿Ya tienes cuenta? </Text>
                <TouchableOpacity onPress={() => router.replace('/auth/login')}>
                  <Text style={styles.loginLink}>Iniciar Sesión</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  formContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  input: {
    flex: 1,
    height: 52,
    color: Colors.dark.text,
    fontSize: 15,
    marginLeft: 12,
  },
  registerButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginLinkText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
  },
  loginLink: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
