import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, TextInput, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { CheckCircle, XCircle, Scan, Keyboard, Camera } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/contexts/AppContext';
import Colors from '@/constants/colors';
import { Ticket } from '@/types';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; ticket?: Ticket } | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const { validateTicket, events } = useApp();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, []);

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
  }, [result]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    
    const validationResult = await validateTicket(data);
    setResult(validationResult);

    if (validationResult.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleManualValidation = async () => {
    if (!manualCode.trim()) return;
    setScanned(true);
    
    const validationResult = await validateTicket(manualCode.trim());
    setResult(validationResult);
    setManualCode('');

    if (validationResult.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const getEventName = (eventId: string) => {
    return events.find(e => e.id === eventId)?.name || 'Evento desconocido';
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Scan color={Colors.dark.primary} size={64} />
        <Text style={styles.permissionTitle}>Permiso de Cámara</Text>
        <Text style={styles.permissionText}>
          Necesitamos acceso a la cámara para escanear los códigos QR de las entradas
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Permitir Cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.manualButton}
          onPress={() => setManualMode(true)}
        >
          <Text style={styles.manualButtonText}>Usar código manual</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!manualMode ? (
        <>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          >
            <View style={styles.overlay}>
              <View style={styles.header}>
                <Text style={styles.title}>Escanear Entrada</Text>
                <Text style={styles.subtitle}>Apunta al código QR de la entrada</Text>
              </View>

              <Animated.View style={[styles.scanFrame, { transform: [{ scale: pulseAnim }] }]}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </Animated.View>

              <View style={styles.footer}>
                <TouchableOpacity 
                  style={styles.modeButton}
                  onPress={() => setManualMode(true)}
                >
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
                    { translateY: resultAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    })},
                  ],
                  opacity: resultAnim,
                }
              ]}
            >
              {result.success ? (
                <CheckCircle color="#FFF" size={48} />
              ) : (
                <XCircle color="#FFF" size={48} />
              )}
              <Text style={styles.resultMessage}>{result.message}</Text>
              {result.ticket && (
                <View style={styles.ticketInfo}>
                  <Text style={styles.ticketName}>{result.ticket.buyerName}</Text>
                  <Text style={styles.ticketEvent}>{getEventName(result.ticket.eventId)}</Text>
                </View>
              )}
            </Animated.View>
          )}
        </>
      ) : (
        <View style={styles.manualContainer}>
          <View style={styles.manualHeader}>
            <Text style={styles.title}>Código Manual</Text>
            <Text style={styles.subtitle}>Introduce el código de la entrada</Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
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
            <Animated.View 
              style={[
                styles.resultCardManual,
                result.success ? styles.resultSuccess : styles.resultError,
              ]}
            >
              {result.success ? (
                <CheckCircle color="#FFF" size={40} />
              ) : (
                <XCircle color="#FFF" size={40} />
              )}
              <View style={styles.resultTextContainer}>
                <Text style={styles.resultMessage}>{result.message}</Text>
                {result.ticket && (
                  <Text style={styles.ticketNameSmall}>{result.ticket.buyerName}</Text>
                )}
              </View>
            </Animated.View>
          )}
        </View>
      )}
    </View>
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
  permissionContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
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
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
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
  ticketEvent: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  ticketNameSmall: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  manualContainer: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  manualHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    gap: 16,
  },
  input: {
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
