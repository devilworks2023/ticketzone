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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Lock, Mail, Ticket, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu contraseña');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.success) {
        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.log('Login error:', error);
      Alert.alert('Error', 'Ocurrió un error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyerAccess = () => {
    router.push('/buyer');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ticket color={Colors.dark.primary} size={48} />
            </View>
            <Text style={styles.title}>Ticketera</Text>
            <Text style={styles.subtitle}>Panel de Gestión</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Iniciar Sesión</Text>
            <Text style={styles.formSubtitle}>
              Accede como vendedor o administrador
            </Text>

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
                placeholder="Contraseña"
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

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.buyerButton} onPress={handleBuyerAccess}>
              <Text style={styles.buyerButtonText}>Acceder como Comprador</Text>
            </TouchableOpacity>

            <Text style={styles.buyerHint}>
              Sin necesidad de registro, compra y consulta tus entradas
            </Text>
          </View>

          <View style={styles.demoCredentials}>
            <Text style={styles.demoTitle}>Credenciales de administrador:</Text>
            <Text style={styles.demoText}>Email: admin@ticketzone.com</Text>
            <Text style={styles.demoText}>Contraseña: admin123</Text>
          </View>
        </View>
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
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: 1,
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
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginBottom: 24,
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
  loginButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  dividerText: {
    color: Colors.dark.textMuted,
    paddingHorizontal: 16,
    fontSize: 13,
  },
  buyerButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.secondary,
  },
  buyerButtonText: {
    color: Colors.dark.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  buyerHint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  demoCredentials: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  demoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  demoText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
});
