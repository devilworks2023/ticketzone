import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet, Shield, Clock, ArrowRight, Banknote, Info } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

export default function PaymentInfoScreen() {
  const router = useRouter();

  const features = [
    {
      icon: <Shield color={Colors.dark.success} size={24} />,
      title: 'Pagos seguros',
      description: 'Todas las transacciones están protegidas con encriptación SSL',
    },
    {
      icon: <Clock color={Colors.dark.warning} size={24} />,
      title: 'Pagos periódicos',
      description: 'Recibe tus ganancias de forma regular según lo acordado',
    },
    {
      icon: <Banknote color={Colors.dark.secondary} size={24} />,
      title: 'Transferencia bancaria',
      description: 'El dinero se transfiere directamente a tu cuenta bancaria',
    },
  ];

  const steps = [
    'Vende entradas para tus eventos',
    'Acumula ganancias en tu balance',
    'Solicita el pago cuando quieras',
    'Recibe el dinero en tu cuenta',
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: 'Información de pagos',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }} 
      />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <LinearGradient
            colors={[Colors.dark.success, '#10B981']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroIconContainer}
          >
            <Wallet color="#FFF" size={48} />
          </LinearGradient>
          <Text style={styles.heroTitle}>Recibe tus ganancias</Text>
          <Text style={styles.heroSubtitle}>
            Tus ganancias por venta de entradas se acumulan automáticamente y puedes solicitar el pago cuando lo necesites.
          </Text>
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Beneficios</Text>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <View style={styles.featureIcon}>{feature.icon}</View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.stepsSection}>
          <Text style={styles.sectionTitle}>¿Cómo funciona?</Text>
          <View style={styles.stepsList}>
            {steps.map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.infoBox}>
          <Info color={Colors.dark.primary} size={20} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Comisión de la plataforma</Text>
            <Text style={styles.infoText}>
              La plataforma retiene un pequeño porcentaje de cada venta para cubrir costes de procesamiento y mantenimiento. El resto es tuyo.
            </Text>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/promoter/payouts')}
        >
          <LinearGradient
            colors={Colors.dark.gradient.primary as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Ver mis pagos</Text>
            <ArrowRight color="#FFF" size={20} />
          </LinearGradient>
        </TouchableOpacity>
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
    fontWeight: '800' as const,
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
  featuresSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 16,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  stepsSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
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
    fontWeight: '800' as const,
    color: Colors.dark.primary,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  infoBox: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: Colors.dark.primary + '15',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.dark.primary,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
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
  button: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFF',
  },
});
