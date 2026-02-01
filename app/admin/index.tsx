import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Users,
  Calendar,
  Building2,
  CreditCard,
  Settings,
  TrendingUp,
  Ticket,
  UserCog,
  Package,
  DollarSign,
  BarChart3,
  Shield,
  Key,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

interface AdminMenuItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  color: string;
  badge?: string | number;
}

function AdminMenuItem({ icon, title, subtitle, onPress, color, badge }: AdminMenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      {badge !== undefined && (
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function AdminDashboardScreen() {
  const statsQuery = trpc.stats.getDashboardStats.useQuery();
  const usersQuery = trpc.auth.getUsers.useQuery();
  const promotersQuery = trpc.promoters.list.useQuery();
  const subscriptionStatsQuery = trpc.subscriptions.getSubscriptionStats.useQuery();

  const stats = statsQuery.data;
  const users = usersQuery.data || [];
  const promoters = promotersQuery.data || [];
  const subscriptionStats = subscriptionStatsQuery.data;

  const isLoading = statsQuery.isLoading || usersQuery.isLoading || promotersQuery.isLoading;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Panel de Administración',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Shield color={Colors.dark.primary} size={32} />
            </View>
            <Text style={styles.headerTitle}>TicketZone Admin</Text>
            <Text style={styles.headerSubtitle}>Panel de control exclusivo</Text>
          </View>
        </LinearGradient>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : (
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <TrendingUp color={Colors.dark.success} size={24} />
                <Text style={[styles.statValue, { color: Colors.dark.success }]}>
                  {formatCurrency(stats?.totalRevenue || 0)}
                </Text>
                <Text style={styles.statLabel}>Ingresos totales</Text>
              </View>
              <View style={styles.statCard}>
                <Ticket color={Colors.dark.primary} size={24} />
                <Text style={styles.statValue}>{stats?.totalTicketsSold || 0}</Text>
                <Text style={styles.statLabel}>Entradas vendidas</Text>
              </View>
              <View style={styles.statCard}>
                <Calendar color={Colors.dark.secondary} size={24} />
                <Text style={styles.statValue}>{stats?.activeEvents || 0}</Text>
                <Text style={styles.statLabel}>Eventos activos</Text>
              </View>
              <View style={styles.statCard}>
                <DollarSign color={Colors.dark.warning} size={24} />
                <Text style={[styles.statValue, { color: Colors.dark.warning }]}>
                  {formatCurrency(subscriptionStats?.monthlyRevenue || 0)}
                </Text>
                <Text style={styles.statLabel}>Suscripciones/mes</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gestión de Usuarios</Text>
              <AdminMenuItem
                icon={<UserCog color={Colors.dark.primary} size={22} />}
                title="Usuarios del Sistema"
                subtitle="Administrar administradores y vendedores"
                onPress={() => router.push('/admin/users')}
                color={Colors.dark.primary}
                badge={users.length}
              />
              <AdminMenuItem
                icon={<Building2 color={Colors.dark.secondary} size={22} />}
                title="Promotores"
                subtitle="Gestionar organizadores de eventos"
                onPress={() => router.push('/admin/promoters-manage')}
                color={Colors.dark.secondary}
                badge={promoters.length}
              />
              <AdminMenuItem
                icon={<Users color="#9b59b6" size={22} />}
                title="Vendedores / RRPP"
                subtitle="Administrar vendedores y comisiones"
                onPress={() => router.push('/admin/sellers-manage')}
                color="#9b59b6"
              />
              <AdminMenuItem
                icon={<Key color="#e67e22" size={22} />}
                title="Códigos de Invitación"
                subtitle="Generar códigos para registro de profesionales"
                onPress={() => router.push('/admin/invitations')}
                color="#e67e22"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gestión de Contenido</Text>
              <AdminMenuItem
                icon={<Calendar color="#e74c3c" size={22} />}
                title="Eventos"
                subtitle="Ver y gestionar todos los eventos"
                onPress={() => router.push('/admin/events-manage')}
                color="#e74c3c"
                badge={stats?.activeEvents || 0}
              />
              <AdminMenuItem
                icon={<Ticket color="#3498db" size={22} />}
                title="Entradas Vendidas"
                subtitle="Historial completo de ventas"
                onPress={() => router.push('/admin/tickets-manage')}
                color="#3498db"
                badge={stats?.totalTicketsSold || 0}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Facturación y Pagos</Text>
              <AdminMenuItem
                icon={<Package color={Colors.dark.primary} size={22} />}
                title="Planes de Suscripción"
                subtitle="Configurar planes mensuales"
                onPress={() => router.push('/admin/subscriptions')}
                color={Colors.dark.primary}
              />
              <AdminMenuItem
                icon={<CreditCard color="#27ae60" size={22} />}
                title="Pagos y Transferencias"
                subtitle="Historial de pagos a promotores"
                onPress={() => router.push('/admin/payments')}
                color="#27ae60"
              />
              <AdminMenuItem
                icon={<BarChart3 color="#f39c12" size={22} />}
                title="Reportes Financieros"
                subtitle="Estadísticas y reportes detallados"
                onPress={() => router.push('/admin/reports')}
                color="#f39c12"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Configuración</Text>
              <AdminMenuItem
                icon={<Settings color={Colors.dark.textMuted} size={22} />}
                title="Configuración General"
                subtitle="Ajustes de la plataforma"
                onPress={() => router.push('/admin/settings')}
                color={Colors.dark.textMuted}
              />
            </View>

            <View style={styles.bottomPadding} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  loading: {
    padding: 60,
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.text,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
    marginLeft: 14,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  bottomPadding: {
    height: 40,
  },
});
