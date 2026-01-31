import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CreditCard, Shield, Zap, CheckCircle, ExternalLink, ArrowRight, Building2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

export default function ConnectStripeScreen() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [step, setStep] = useState<'intro' | 'connecting' | 'success'>('intro');

  const handleConnectStripe = async () => {
    setIsConnecting(true);
    setStep('connecting');

    await new Promise(resolve => setTimeout(resolve, 2000));

    setStep('success');
    setIsConnecting(false);
  };

  const benefits = [
    {
      icon: <Zap color={Colors.dark.warning} size={24} />,
      title: 'Pagos instantáneos',
      description: 'Recibe el dinero de tus ventas directamente en tu cuenta',
    },
    {
      icon: <Shield color={Colors.dark.success} size={24} />,
      title: 'Seguro y protegido',
      description: 'Stripe cumple con los más altos estándares de seguridad',
    },
    {
      icon: <Building2 color={Colors.dark.secondary} size={24} />,
      title: 'Panel de control',
      description: 'Accede a reportes detallados y gestiona tus pagos',
    },
  ];

  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <CheckCircle color={Colors.dark.success} size={80} />
          </View>
          <Text style={styles.successTitle}>¡Cuenta conectada!</Text>
          <Text style={styles.successText}>
            Tu cuenta de Stripe ha sido vinculada correctamente. Ahora recibirás los pagos de tus eventos directamente.
          </Text>
          <TouchableOpacity
            style={styles.successButton}
            onPress={() => router.replace('/promoter/dashboard')}
          >
            <LinearGradient
              colors={Colors.dark.gradient.primary as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.successButtonGradient}
            >
              <Text style={styles.successButtonText}>Ir al dashboard</Text>
              <ArrowRight color="#FFF" size={20} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'connecting') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.connectingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
          <Text style={styles.connectingTitle}>Conectando con Stripe...</Text>
          <Text style={styles.connectingText}>
            Esto puede tardar unos segundos
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: 'Conectar Stripe',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }} 
      />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['#635BFF', '#A259FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroIconContainer}
          >
            <CreditCard color="#FFF" size={48} />
          </LinearGradient>
          <Text style={styles.heroTitle}>Recibe pagos directos</Text>
          <Text style={styles.heroSubtitle}>
            Conecta tu cuenta de Stripe para recibir el dinero de las ventas de entradas directamente, sin intermediarios.
          </Text>
        </View>

        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>Beneficios</Text>
          {benefits.map((benefit, index) => (
            <View key={index} style={styles.benefitCard}>
              <View style={styles.benefitIcon}>{benefit.icon}</View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDescription}>{benefit.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>¿Cómo funciona?</Text>
          <View style={styles.stepsList}>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Crea o conecta tu cuenta de Stripe</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>Verifica tu identidad y datos bancarios</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>Recibe pagos automáticos por cada venta</Text>
            </View>
          </View>
        </View>

        <View style={styles.feeInfo}>
          <Text style={styles.feeTitle}>Comisiones</Text>
          <Text style={styles.feeText}>
            La plataforma retiene un <Text style={styles.feeHighlight}>5%</Text> de cada venta. 
            El resto se transfiere directamente a tu cuenta de Stripe.
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.connectButton}
          onPress={handleConnectStripe}
          disabled={isConnecting}
        >
          <LinearGradient
            colors={['#635BFF', '#A259FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.connectButtonGradient}
          >
            <CreditCard color="#FFF" size={22} />
            <Text style={styles.connectButtonText}>Conectar con Stripe</Text>
            <ExternalLink color="#FFF" size={18} />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.footerText}>
          Serás redirigido a Stripe para completar el proceso
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 30,
    paddingBottom: 40,
  },
  heroIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  infoSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  stepsList: {
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.dark.primary,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  feeInfo: {
    marginHorizontal: 20,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 20,
  },
  feeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  feeText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  feeHighlight: {
    color: Colors.dark.primary,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.dark.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    padding: 20,
    paddingBottom: 36,
  },
  connectButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  connectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  connectButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  footerText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  connectingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  connectingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    marginTop: 8,
  },
  connectingText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  successButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  successButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  successButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
});
