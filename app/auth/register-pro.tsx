import React, { useState, useEffect } from 'react';
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
import { 
  Lock, 
  Mail, 
  User, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Key, 
  Phone,
  Briefcase,
  Users,
  CheckCircle,
  XCircle,
} from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import Colors from '@/constants/colors';

export default function RegisterProScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [codeValidated, setCodeValidated] = useState<boolean | null>(null);
  const [codeType, setCodeType] = useState<string | null>(null);

  const registerMutation = trpc.auth.registerWithInvitation.useMutation();
  const validateCodeQuery = trpc.auth.validateInvitationCode.useQuery(
    { code: invitationCode },
    { enabled: invitationCode.length >= 6 }
  );

  useEffect(() => {
    if (validateCodeQuery.data) {
      setCodeValidated(validateCodeQuery.data.valid);
      setCodeType(validateCodeQuery.data.type);
    } else if (invitationCode.length >= 6 && !validateCodeQuery.isLoading) {
      setCodeValidated(false);
      setCodeType(null);
    } else if (invitationCode.length < 6) {
      setCodeValidated(null);
      setCodeType(null);
    }
  }, [validateCodeQuery.data, invitationCode, validateCodeQuery.isLoading]);

  const handleRegister = async () => {
    if (!invitationCode.trim()) {
      Alert.alert('Error', 'Por favor ingresa el código de invitación');
      return;
    }
    if (!codeValidated) {
      Alert.alert('Error', 'El código de invitación no es válido');
      return;
    }
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
        phone: phone.trim() || undefined,
        password,
        invitationCode: invitationCode.trim().toUpperCase(),
      });

      if (result.success) {
        const res = result as any;
        if (res.requiresVerification) {
          router.replace({
            pathname: '/auth/verify-email',
            params: { email: res.email, type: res.type || codeType },
          });
        } else {
          const roleText = codeType === 'promoter' ? 'promotor' : 'vendedor';
          Alert.alert(
            'Registro Exitoso',
            `Tu cuenta de ${roleText} ha sido creada. Ahora puedes iniciar sesión.`,
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

  const getRoleIcon = () => {
    if (codeType === 'promoter') {
      return <Briefcase color={Colors.dark.primary} size={20} />;
    } else if (codeType === 'seller') {
      return <Users color={Colors.dark.secondary} size={20} />;
    }
    return null;
  };

  const getRoleText = () => {
    if (codeType === 'promoter') return 'Promotor';
    if (codeType === 'seller') return 'Vendedor/RRPP';
    return '';
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
                <Key color={Colors.dark.primary} size={40} />
              </View>
              <Text style={styles.title}>Registro Profesional</Text>
              <Text style={styles.subtitle}>Para promotores y vendedores</Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.sectionLabel}>Código de Invitación</Text>
              <View style={[
                styles.inputContainer,
                codeValidated === true && styles.inputValid,
                codeValidated === false && styles.inputInvalid,
              ]}>
                <Key color={codeValidated === true ? Colors.dark.success : codeValidated === false ? Colors.dark.error : Colors.dark.textMuted} size={20} />
                <TextInput
                  style={styles.input}
                  placeholder="INV-XXXXXXXX"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={invitationCode}
                  onChangeText={(text) => setInvitationCode(text.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  nativeID="pro-invitation-code"
                  autoComplete="off"
                />
                {validateCodeQuery.isLoading ? (
                  <ActivityIndicator size="small" color={Colors.dark.primary} />
                ) : codeValidated === true ? (
                  <CheckCircle color={Colors.dark.success} size={20} />
                ) : codeValidated === false ? (
                  <XCircle color={Colors.dark.error} size={20} />
                ) : null}
              </View>

              {codeValidated === true && codeType && (
                <View style={styles.roleIndicator}>
                  {getRoleIcon()}
                  <Text style={styles.roleText}>Registro como: {getRoleText()}</Text>
                </View>
              )}

              {codeValidated === false && (
                <Text style={styles.errorText}>Código inválido, expirado o ya utilizado</Text>
              )}

              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Datos Personales</Text>

              <View style={styles.inputContainer}>
                <User color={Colors.dark.textMuted} size={20} />
                <TextInput
                  style={styles.input}
                  placeholder="Nombre completo"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  nativeID="pro-name"
                  autoComplete="name"
                  textContentType="name"
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
                  nativeID="pro-email"
                  autoComplete="email"
                  textContentType="emailAddress"
                />
              </View>

              <View style={styles.inputContainer}>
                <Phone color={Colors.dark.textMuted} size={20} />
                <TextInput
                  style={styles.input}
                  placeholder="Teléfono (opcional)"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  nativeID="pro-phone"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
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
                  nativeID="pro-password"
                  autoComplete="new-password"
                  textContentType="newPassword"
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
                  nativeID="pro-confirm-password"
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.registerButton, 
                  (isLoading || !codeValidated) && styles.registerButtonDisabled
                ]}
                onPress={handleRegister}
                disabled={isLoading || !codeValidated}
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

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>¿Cómo obtener un código?</Text>
              <Text style={styles.infoText}>
                Los códigos de invitación son generados por el administrador de la plataforma. 
                Contacta con el administrador para obtener tu código de acceso.
              </Text>
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
    paddingBottom: 40,
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
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
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
    fontSize: 26,
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  inputValid: {
    borderColor: Colors.dark.success,
  },
  inputInvalid: {
    borderColor: Colors.dark.error,
  },
  input: {
    flex: 1,
    height: 52,
    color: Colors.dark.text,
    fontSize: 15,
    marginLeft: 12,
  },
  roleIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.primary + '15',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  roleText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 12,
    marginBottom: 8,
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
    opacity: 0.5,
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
  infoBox: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    lineHeight: 20,
  },
});
