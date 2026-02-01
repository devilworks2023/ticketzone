import React, { useState, useRef, useEffect } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { Mail, ArrowLeft, RefreshCw } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import Colors from '@/constants/colors';

export default function VerifyEmailScreen() {
  const { email, type } = useLocalSearchParams<{ email: string; type?: string }>();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const verifyMutation = (trpc.auth as any).verifyEmail.useMutation();
  const resendMutation = (trpc.auth as any).resendVerificationCode.useMutation();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleCodeChange = (value: string, index: number) => {
    if (value.length > 1) {
      const digits = value.split('').slice(0, 6);
      const newCode = [...code];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit;
        }
      });
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      Alert.alert('Error', 'Por favor ingresa el código completo de 6 dígitos');
      return;
    }

    if (!email) {
      Alert.alert('Error', 'Email no encontrado');
      return;
    }

    setIsLoading(true);
    try {
      const result = await verifyMutation.mutateAsync({
        email: email,
        code: fullCode,
      });

      if (result.success) {
        Alert.alert(
          'Verificación Exitosa',
          'Tu cuenta ha sido verificada. Ahora puedes iniciar sesión.',
          [{ text: 'Iniciar Sesión', onPress: () => router.replace('/auth/login') }]
        );
      }
    } catch (error: any) {
      console.log('Verify error:', error);
      Alert.alert('Error', error.message || 'Código de verificación inválido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || !email) return;

    setIsResending(true);
    try {
      await resendMutation.mutateAsync({ email });
      setCountdown(60);
      Alert.alert('Código Reenviado', 'Se ha enviado un nuevo código a tu email');
    } catch (error: any) {
      console.log('Resend error:', error);
      Alert.alert('Error', error.message || 'No se pudo reenviar el código');
    } finally {
      setIsResending(false);
    }
  };

  const getTypeText = () => {
    if (type === 'promoter') return 'promotor';
    if (type === 'seller') return 'vendedor';
    return 'usuario';
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft color={Colors.dark.text} size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Mail color={Colors.dark.primary} size={40} />
            </View>
          </View>

          <Text style={styles.title}>Verifica tu Email</Text>
          <Text style={styles.subtitle}>
            Hemos enviado un código de verificación a
          </Text>
          <Text style={styles.email}>{email}</Text>
          {type && (
            <Text style={styles.typeText}>Registro como {getTypeText()}</Text>
          )}

          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[
                  styles.codeInput,
                  digit ? styles.codeInputFilled : null,
                ]}
                value={digit}
                onChangeText={(value) => handleCodeChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.verifyButton, isLoading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.verifyButtonText}>Verificar</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>¿No recibiste el código? </Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={countdown > 0 || isResending}
            >
              {isResending ? (
                <ActivityIndicator size="small" color={Colors.dark.primary} />
              ) : (
                <View style={styles.resendButton}>
                  <RefreshCw color={countdown > 0 ? Colors.dark.textMuted : Colors.dark.primary} size={16} />
                  <Text style={[
                    styles.resendLink,
                    countdown > 0 && styles.resendLinkDisabled
                  ]}>
                    {countdown > 0 ? `Reenviar en ${countdown}s` : 'Reenviar'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              El código expira en 30 minutos. Si no lo recibes, revisa tu carpeta de spam.
            </Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.primary,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.primary,
    marginTop: 4,
    marginBottom: 8,
  },
  typeText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  codeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 32,
    marginBottom: 24,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  codeInputFilled: {
    borderColor: Colors.dark.primary,
  },
  verifyButton: {
    width: '100%',
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  verifyButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  resendText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resendLink: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  resendLinkDisabled: {
    color: Colors.dark.textMuted,
  },
  infoBox: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 32,
    width: '100%',
  },
  infoText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
