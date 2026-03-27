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
import { router, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Key, Ticket, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function SellerLoginScreen() {
  const [code, setCode] = useState('');
  const loginMutation = trpc.sellers.login.useMutation();

  const handleLogin = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu código de vendedor');
      return;
    }

    try {
      const result = await loginMutation.mutateAsync({ code: code.trim().toUpperCase() });
      
      if (result.success && result.seller) {
        await AsyncStorage.setItem('seller_session', JSON.stringify({
          id: result.seller.id,
          name: result.seller.name,
          code: result.seller.code,
          email: result.seller.email,
        }));
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/seller/dashboard');
      }
    } catch (error: any) {
      console.log('Seller login error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Código de vendedor no válido');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={Colors.dark.text} size={24} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ticket color={Colors.dark.secondary} size={48} />
            </View>
            <Text style={styles.title}>Portal de Vendedor</Text>
            <Text style={styles.subtitle}>Accede para ver tus ventas y comisiones</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Iniciar Sesión</Text>
            <Text style={styles.formSubtitle}>
              Ingresa tu código de vendedor para acceder
            </Text>

            <View style={styles.inputContainer}>
              <Key color={Colors.dark.textMuted} size={20} />
              <TextInput
                style={styles.input}
                placeholder="Código de vendedor"
                placeholderTextColor={Colors.dark.textMuted}
                value={code}
                onChangeText={(text) => setCode(text.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={20}
              />
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loginMutation.isPending && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.loginButtonText}>Acceder</Text>
              )}
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 Tu código de vendedor te lo proporciona el administrador o promotor del evento.
              </Text>
            </View>
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
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
    borderColor: Colors.dark.secondary,
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
    marginTop: 6,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 24,
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  input: {
    flex: 1,
    height: 56,
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
    letterSpacing: 2,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: Colors.dark.secondary,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  infoText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
