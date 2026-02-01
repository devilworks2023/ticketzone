import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Animated, Alert, ActivityIndicator, Platform } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { CheckCircle, XCircle, Scan, Keyboard, Camera, QrCode, LogIn, UserPlus, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

const SCANNER_SESSION_KEY = 'ticketzone_scanner_session';

interface ScannerSession {
  type: 'code' | 'user';
  promoterId: string;
  promoterName: string;
  scannerId?: string;
  scannerName?: string;
  events: { id: string; name: string }[];
}

export default function ScannerAccessScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [accessCode, setAccessCode] = useState(params.code || '');
  const [mode, setMode] = useState<'code' | 'login' | 'register' | 'scanning'>('code');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [session, setSession] = useState<ScannerSession | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; ticketInfo?: any } | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;

  

  const loginWithCodeMutation = trpc.scanner.loginWithCode.useMutation({
    onSuccess: (data) => {
      const newSession: ScannerSession = {
        type: 'code',
        promoterId: data.promoterId,
        promoterName: data.promoterName || 'Promotor',
        events: data.events,
      };
      setSession(newSession);
      if (data.events.length === 1) {
        setSelectedEventId(data.events[0].id);
      }
      setMode('scanning');
      saveSession(newSession);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const loginMutation = trpc.scanner.login.useMutation({
    onSuccess: (data) => {
      const newSession: ScannerSession = {
        type: 'user',
        promoterId: data.scanner.promoterId,
        promoterName: data.scanner.promoterName || 'Promotor',
        scannerId: data.scanner.id,
        scannerName: data.scanner.name,
        events: data.scanner.events,
      };
      setSession(newSession);
      if (data.scanner.events.length === 1) {
        setSelectedEventId(data.scanner.events[0].id);
      }
      setMode('scanning');
      saveSession(newSession);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const registerMutation = trpc.scanner.registerWithInvitation.useMutation({
    onSuccess: () => {
      Alert.alert('Éxito', 'Registro completado. Ahora puedes iniciar sesión.', [
        { text: 'OK', onPress: () => setMode('login') }
      ]);
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const validateTicketMutation = trpc.tickets.validate.useMutation({
    onSuccess: (data) => {
      setResult({
        success: data.success,
        message: data.message,
        ticketInfo: data.ticket,
      });
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    onError: (error) => {
      setResult({ success: false, message: error.message });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (params.code && params.code !== accessCode) {
      setAccessCode(params.code);
    }
  }, [params.code, accessCode]);

  useEffect(() => {
    if (mode === 'scanning') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [mode, pulseAnim]);

  useEffect(() => {
    if (result) {
      Animated.spring(resultAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(resultAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setScanned(false);
          setResult(null);
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [result, resultAnim]);

  const saveSession = async (newSession: ScannerSession) => {
    try {
      await AsyncStorage.setItem(SCANNER_SESSION_KEY, JSON.stringify(newSession));
    } catch (error) {
      console.log('Error saving scanner session:', error);
    }
  };

  const loadSession = async () => {
    try {
      const stored = await AsyncStorage.getItem(SCANNER_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ScannerSession;
        setSession(parsed);
        if (parsed.events.length === 1) {
          setSelectedEventId(parsed.events[0].id);
        }
        setMode('scanning');
      }
    } catch (error) {
      console.log('Error loading scanner session:', error);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem(SCANNER_SESSION_KEY);
    setSession(null);
    setSelectedEventId(null);
    setMode('code');
    setAccessCode('');
  };

  const handleAccessWithCode = () => {
    if (!accessCode.trim()) {
      Alert.alert('Error', 'Introduce un código de acceso');
      return;
    }
    loginWithCodeMutation.mutate({ code: accessCode.trim() });
  };

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }
    loginMutation.mutate({ email: email.trim(), password });
  };

  const handleRegister = () => {
    if (!accessCode.trim() || !name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }
    registerMutation.mutate({
      code: accessCode.trim(),
      name: name.trim(),
      email: email.trim(),
      password,
    });
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    validateTicketMutation.mutate({ qrCode: data });
  };

  const handleManualValidation = () => {
    if (!manualCode.trim()) return;
    setScanned(true);
    validateTicketMutation.mutate({ qrCode: manualCode.trim() });
    setManualCode('');
  };

  const isLoading = loginWithCodeMutation.isPending || loginMutation.isPending || registerMutation.isPending;

  if (mode === 'scanning') {
    if (!permission) {
      return (
        <View style={styles.container}>
          <Text style={styles.loadingText}>Cargando cámara...</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <Stack.Screen options={{ headerShown: false }} />
          <View style={styles.permissionContainer}>
            <Scan color={Colors.dark.primary} size={64} />
            <Text style={styles.permissionTitle}>Permiso de Cámara</Text>
            <Text style={styles.permissionText}>
              Necesitamos acceso a la cámara para escanear los códigos QR de las entradas
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Permitir Cámara</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.manualButton} onPress={() => setManualMode(true)}>
              <Text style={styles.manualButtonText}>Usar código manual</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        
        {!manualMode ? (
          <>
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            >
              <View style={styles.overlay}>
                <View style={styles.scanHeader}>
                  <TouchableOpacity style={styles.backButton} onPress={handleLogout}>
                    <ArrowLeft color="#FFF" size={24} />
                  </TouchableOpacity>
                  <View style={styles.headerText}>
                    <Text style={styles.title}>Escanear Entrada</Text>
                    <Text style={styles.subtitle}>
                      {session?.scannerName || 'Acceso con código'} • {session?.promoterName}
                    </Text>
                  </View>
                </View>

                {session && session.events.length > 1 && (
                  <View style={styles.eventSelector}>
                    {session.events.map(event => (
                      <TouchableOpacity
                        key={event.id}
                        style={[
                          styles.eventChip,
                          selectedEventId === event.id && styles.eventChipSelected,
                        ]}
                        onPress={() => setSelectedEventId(event.id)}
                      >
                        <Text style={[
                          styles.eventChipText,
                          selectedEventId === event.id && styles.eventChipTextSelected,
                        ]}>
                          {event.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Animated.View style={[styles.scanFrame, { transform: [{ scale: pulseAnim }] }]}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </Animated.View>

                <View style={styles.footer}>
                  <TouchableOpacity style={styles.modeButton} onPress={() => setManualMode(true)}>
                    <Keyboard color={Colors.dark.text} size={20} />
                    <Text style={styles.modeButtonText}>Código manual</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </CameraView>

            {result && (
              <Animated.View
                style={[
                  styles.resultCard,
                  result.success ? styles.resultSuccess : styles.resultError,
                  {
                    transform: [
                      { scale: resultAnim },
                      { translateY: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) },
                    ],
                    opacity: resultAnim,
                  },
                ]}
              >
                {result.success ? (
                  <CheckCircle color="#FFF" size={48} />
                ) : (
                  <XCircle color="#FFF" size={48} />
                )}
                <Text style={styles.resultMessage}>{result.message}</Text>
                {result.ticketInfo && (
                  <View style={styles.ticketInfo}>
                    <Text style={styles.ticketName}>{result.ticketInfo.buyerName}</Text>
                  </View>
                )}
              </Animated.View>
            )}
          </>
        ) : (
          <SafeAreaView style={styles.manualContainer} edges={['top']}>
            <View style={styles.manualHeader}>
              <Text style={styles.title}>Código Manual</Text>
              <Text style={styles.subtitle}>Introduce el código de la entrada</Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.codeInput}
                placeholder="Ej: NEON-001-JUAN"
                placeholderTextColor={Colors.dark.textMuted}
                value={manualCode}
                onChangeText={setManualCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.validateButton, !manualCode.trim() && styles.validateButtonDisabled]}
                onPress={handleManualValidation}
                disabled={!manualCode.trim()}
              >
                <Text style={styles.validateButtonText}>Validar</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => {
                setManualMode(false);
                setScanned(false);
                setResult(null);
              }}
            >
              <Camera color={Colors.dark.primary} size={20} />
              <Text style={styles.switchModeText}>Usar cámara</Text>
            </TouchableOpacity>

            {result && (
              <View style={[styles.resultCardManual, result.success ? styles.resultSuccess : styles.resultError]}>
                {result.success ? (
                  <CheckCircle color="#FFF" size={40} />
                ) : (
                  <XCircle color="#FFF" size={40} />
                )}
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultMessage}>{result.message}</Text>
                  {result.ticketInfo && (
                    <Text style={styles.ticketNameSmall}>{result.ticketInfo.buyerName}</Text>
                  )}
                </View>
              </View>
            )}

            <TouchableOpacity style={[styles.logoutButton, { marginTop: 40 }]} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </SafeAreaView>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.accessContainer}>
        <View style={styles.logoContainer}>
          <QrCode color={Colors.dark.primary} size={48} />
        </View>
        <Text style={styles.accessTitle}>Acceso Escáner</Text>
        <Text style={styles.accessSubtitle}>
          Accede para verificar entradas en eventos
        </Text>

        {mode === 'code' && (
          <>
            <View style={styles.formContainer}>
              <Text style={styles.formLabel}>Código de acceso</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: SCAN-A1B2C3D4"
                placeholderTextColor={Colors.dark.textMuted}
                value={accessCode}
                onChangeText={setAccessCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                onPress={handleAccessWithCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Scan color="#FFF" size={20} />
                    <Text style={styles.primaryButtonText}>Acceder con código</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setMode('login')}>
              <LogIn color={Colors.dark.primary} size={20} />
              <Text style={styles.secondaryButtonText}>Iniciar sesión</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => setMode('register')}>
              <UserPlus color={Colors.dark.textMuted} size={16} />
              <Text style={styles.linkButtonText}>¿Tienes un código? Regístrate</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === 'login' && (
          <>
            <View style={styles.formContainer}>
              <Text style={styles.formLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                placeholderTextColor={Colors.dark.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              <Text style={[styles.formLabel, { marginTop: 16 }]}>Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.dark.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.linkButton} onPress={() => setMode('code')}>
              <ArrowLeft color={Colors.dark.textMuted} size={16} />
              <Text style={styles.linkButtonText}>Volver</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === 'register' && (
          <>
            <View style={styles.formContainer}>
              <Text style={styles.formLabel}>Código de invitación</Text>
              <TextInput
                style={styles.input}
                placeholder="SCAN-XXXXXXXX"
                placeholderTextColor={Colors.dark.textMuted}
                value={accessCode}
                onChangeText={setAccessCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <Text style={[styles.formLabel, { marginTop: 16 }]}>Nombre completo</Text>
              <TextInput
                style={styles.input}
                placeholder="Tu nombre"
                placeholderTextColor={Colors.dark.textMuted}
                value={name}
                onChangeText={setName}
                autoCorrect={false}
              />

              <Text style={[styles.formLabel, { marginTop: 16 }]}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                placeholderTextColor={Colors.dark.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              <Text style={[styles.formLabel, { marginTop: 16 }]}>Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={Colors.dark.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Registrarse</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.linkButton} onPress={() => setMode('code')}>
              <ArrowLeft color={Colors.dark.textMuted} size={16} />
              <Text style={styles.linkButtonText}>Volver</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingText: {
    color: Colors.dark.text,
    textAlign: 'center',
    marginTop: 100,
  },
  accessContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  accessTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  accessSubtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  formContainer: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.dark.card,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.primary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  dividerText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    marginHorizontal: 16,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  linkButtonText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  manualButton: {
    paddingVertical: 12,
  },
  manualButtonText: {
    fontSize: 15,
    color: Colors.dark.secondary,
    fontWeight: '600',
  },
  logoutButton: {
    paddingVertical: 12,
    marginTop: 20,
  },
  logoutButtonText: {
    fontSize: 15,
    color: Colors.dark.error,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  scanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  eventSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  eventChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  eventChipSelected: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  eventChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  eventChipTextSelected: {
    color: '#FFF',
  },
  scanFrame: {
    width: 260,
    height: 260,
    alignSelf: 'center',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: Colors.dark.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  footer: {
    alignItems: 'center',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  resultCard: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
  },
  resultCardManual: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginTop: 24,
    gap: 16,
  },
  resultSuccess: {
    backgroundColor: Colors.dark.success,
  },
  resultError: {
    backgroundColor: Colors.dark.error,
  },
  resultMessage: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 12,
    textAlign: 'center',
  },
  resultTextContainer: {
    flex: 1,
  },
  ticketInfo: {
    marginTop: 12,
    alignItems: 'center',
  },
  ticketName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  ticketNameSmall: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  manualContainer: {
    flex: 1,
    padding: 24,
    paddingTop: 20,
  },
  manualHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    gap: 16,
  },
  codeInput: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 18,
    fontSize: 18,
    color: Colors.dark.text,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  validateButton: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  validateButtonDisabled: {
    opacity: 0.5,
  },
  validateButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  switchModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 12,
  },
  switchModeText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
});
