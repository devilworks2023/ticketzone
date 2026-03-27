import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Check,
  Calendar,
  Crown,
  AlertCircle,
  CheckCircle,
  ArrowRight,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

export default function PromoterSubscriptionScreen() {
  const { promoterId } = useLocalSearchParams<{ promoterId: string }>();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const plansQuery = trpc.subscriptions.listPlans.useQuery();
  const subscriptionQuery = trpc.subscriptions.getPromoterSubscription.useQuery(
    { promoterId: promoterId || '' },
    { enabled: !!promoterId }
  );
  const eventLimitQuery = trpc.subscriptions.checkEventLimit.useQuery(
    { promoterId: promoterId || '' },
    { enabled: !!promoterId }
  );

  const createSubscriptionMutation = trpc.subscriptions.createSubscription.useMutation();

  const plans = plansQuery.data || [];
  const currentSubscription = subscriptionQuery.data;
  const eventLimit = eventLimitQuery.data;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const handleSelectPlan = async (planId: string) => {
    if (!promoterId) {
      Alert.alert('Error', 'ID de promotor no válido');
      return;
    }

    if (currentSubscription?.planId === planId) {
      Alert.alert('Info', 'Ya tienes este plan activo');
      return;
    }

    setSelectedPlanId(planId);

    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    Alert.alert(
      'Confirmar Suscripción',
      `¿Deseas suscribirte al plan ${plan.name} por ${formatCurrency(plan.priceMonthly)}/mes?`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => setSelectedPlanId(null) },
        {
          text: 'Confirmar',
          onPress: () => processSubscription(planId),
        },
      ]
    );
  };

  const processSubscription = async (planId: string) => {
    if (!promoterId) return;

    setIsProcessing(true);
    try {
      await createSubscriptionMutation.mutateAsync({
        promoterId,
        planId,
      });

      Alert.alert(
        'Suscripción Activada',
        'Tu suscripción ha sido activada correctamente.',
        [
          {
            text: 'Continuar',
            onPress: () => {
              subscriptionQuery.refetch();
              eventLimitQuery.refetch();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo procesar la suscripción');
    } finally {
      setIsProcessing(false);
      setSelectedPlanId(null);
    }
  };

  const getPlanFeatures = (maxEvents: number) => {
    const features = [];
    if (maxEvents >= 999) {
      features.push('Eventos ilimitados');
    } else {
      features.push(`${maxEvents} eventos por mes`);
    }
    features.push('Sin comisiones por venta');
    features.push('Panel de gestión completo');
    features.push('Soporte prioritario');
    if (maxEvents >= 10) {
      features.push('Estadísticas avanzadas');
    }
    if (maxEvents >= 999) {
      features.push('API personalizada');
      features.push('Gestor de cuenta dedicado');
    }
    return features;
  };

  if (plansQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Planes de Suscripción',
            headerStyle: { backgroundColor: Colors.dark.background },
            headerTintColor: Colors.dark.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Planes de Suscripción',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {currentSubscription && (
          <View style={styles.currentPlanCard}>
            <LinearGradient
              colors={Colors.dark.gradient.primary as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.currentPlanGradient}
            >
              <View style={styles.currentPlanHeader}>
                <Crown color="#FFF" size={24} />
                <Text style={styles.currentPlanLabel}>Tu Plan Actual</Text>
              </View>
              <Text style={styles.currentPlanName}>{currentSubscription.planName}</Text>
              <View style={styles.currentPlanDetails}>
                <View style={styles.currentPlanDetail}>
                  <Calendar color="rgba(255,255,255,0.8)" size={16} />
                  <Text style={styles.currentPlanDetailText}>
                    {eventLimit?.eventsUsed || 0} / {currentSubscription.maxEventsPerMonth >= 999 ? '∞' : currentSubscription.maxEventsPerMonth} eventos
                  </Text>
                </View>
                <Text style={styles.currentPlanPrice}>
                  {formatCurrency(currentSubscription.priceMonthly)}/mes
                </Text>
              </View>
              <View style={styles.periodInfo}>
                <Text style={styles.periodText}>
                  Próxima renovación: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString('es-ES')}
                </Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {!currentSubscription && eventLimit && !eventLimit.hasSubscription && (
          <View style={styles.alertCard}>
            <AlertCircle color={Colors.dark.warning} size={24} />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Sin suscripción activa</Text>
              <Text style={styles.alertText}>
                Necesitas una suscripción para crear eventos
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Selecciona tu Plan</Text>
        <Text style={styles.sectionSubtitle}>
          Todos los planes incluyen 0% de comisión por venta de entradas
        </Text>

        {plans.map((plan, index) => {
          const isCurrentPlan = currentSubscription?.planId === plan.id;
          const isPopular = index === 1;
          const features = getPlanFeatures(plan.maxEventsPerMonth);

          return (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                isCurrentPlan && styles.planCardCurrent,
                isPopular && styles.planCardPopular,
              ]}
              onPress={() => handleSelectPlan(plan.id)}
              disabled={isProcessing || isCurrentPlan}
              activeOpacity={0.8}
            >
              {isPopular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>MÁS POPULAR</Text>
                </View>
              )}

              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {plan.description && (
                    <Text style={styles.planDescription}>{plan.description}</Text>
                  )}
                </View>
                {isCurrentPlan && (
                  <View style={styles.currentBadge}>
                    <CheckCircle color={Colors.dark.success} size={16} />
                    <Text style={styles.currentBadgeText}>Activo</Text>
                  </View>
                )}
              </View>

              <View style={styles.planPricing}>
                <Text style={styles.planPrice}>{formatCurrency(plan.priceMonthly)}</Text>
                <Text style={styles.planPriceLabel}>/mes</Text>
              </View>

              <View style={styles.planFeatures}>
                {features.map((feature, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Check color={Colors.dark.success} size={16} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {!isCurrentPlan && (
                <View style={styles.planAction}>
                  {isProcessing && selectedPlanId === plan.id ? (
                    <ActivityIndicator color={Colors.dark.primary} />
                  ) : (
                    <>
                      <Text style={styles.planActionText}>
                        {currentSubscription ? 'Cambiar a este plan' : 'Seleccionar plan'}
                      </Text>
                      <ArrowRight color={Colors.dark.primary} size={18} />
                    </>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>¿Cómo funciona?</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoNumber}>1</Text>
            <Text style={styles.infoText}>Selecciona el plan que mejor se adapte a tus necesidades</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoNumber}>2</Text>
            <Text style={styles.infoText}>Paga la cuota mensual según el número de eventos</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoNumber}>3</Text>
            <Text style={styles.infoText}>Crea eventos y vende entradas sin comisiones adicionales</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  currentPlanCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  currentPlanGradient: {
    padding: 20,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  currentPlanLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  currentPlanName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 12,
  },
  currentPlanDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  currentPlanDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentPlanDetailText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  currentPlanPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  periodInfo: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  periodText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.warning + '15',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.dark.warning + '30',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.warning,
    marginBottom: 2,
  },
  alertText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 20,
  },
  planCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardCurrent: {
    borderColor: Colors.dark.success,
    backgroundColor: Colors.dark.success + '10',
  },
  planCardPopular: {
    borderColor: Colors.dark.primary,
  },
  popularBadge: {
    position: 'absolute',
    top: -1,
    right: 20,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    maxWidth: 200,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.success,
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 18,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.dark.primary,
  },
  planPriceLabel: {
    fontSize: 16,
    color: Colors.dark.textMuted,
    marginLeft: 4,
  },
  planFeatures: {
    gap: 10,
    marginBottom: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  planAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  planActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.primary,
  },
  infoSection: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  infoNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.primary + '20',
    color: Colors.dark.primary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
});
