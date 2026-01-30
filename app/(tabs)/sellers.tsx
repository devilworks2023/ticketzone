import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Plus, User, TrendingUp, Copy, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/contexts/AppContext';
import Colors from '@/constants/colors';

export default function SellersScreen() {
  const router = useRouter();
  const { sellers } = useApp();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const copyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const getCurrentCommission = (seller: typeof sellers[0]) => {
    const tier = seller.commissionTiers.find(
      t => seller.totalSales >= t.minSales && (t.maxSales === null || seller.totalSales <= t.maxSales)
    );
    return tier?.percentage || 0;
  };

  const renderSeller = ({ item }: { item: typeof sellers[0] }) => {
    const commission = getCurrentCommission(item);
    const commissionEarned = item.totalRevenue * (commission / 100);

    return (
      <TouchableOpacity
        style={styles.sellerCard}
        onPress={() => router.push(`/seller/${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.sellerHeader}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, !item.isActive && { opacity: 0.5 }]}>
              <User color={Colors.dark.text} size={24} />
            </View>
            {item.isActive && <View style={styles.activeIndicator} />}
          </View>
          
          <View style={styles.sellerInfo}>
            <Text style={styles.sellerName}>{item.name}</Text>
            <TouchableOpacity 
              style={styles.codeContainer}
              onPress={() => copyCode(item.code)}
            >
              <Text style={styles.codeText}>{item.code}</Text>
              <Copy color={Colors.dark.textMuted} size={14} />
            </TouchableOpacity>
          </View>

          <ChevronRight color={Colors.dark.textMuted} size={20} />
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{item.totalSales}</Text>
            <Text style={styles.statLabel}>Ventas</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatCurrency(item.totalRevenue)}</Text>
            <Text style={styles.statLabel}>Generado</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: Colors.dark.success }]}>{commission}%</Text>
            <Text style={styles.statLabel}>Comisión</Text>
          </View>
        </View>

        <View style={styles.earningsRow}>
          <TrendingUp color={Colors.dark.accent} size={16} />
          <Text style={styles.earningsLabel}>Ganado:</Text>
          <Text style={styles.earningsValue}>{formatCurrency(commissionEarned)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={sellers}
        renderItem={renderSeller}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Vendedores</Text>
              <Text style={styles.headerSubtitle}>{sellers.length} vendedores activos</Text>
            </View>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => router.push('/seller/create')}
            >
              <Plus color="#FFF" size={20} />
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>Sin vendedores</Text>
            <Text style={styles.emptyText}>Añade vendedores para que promocionen tus eventos</Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => router.push('/seller/create')}
            >
              <Text style={styles.emptyButtonText}>Añadir Vendedor</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  listContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.dark.success,
    borderWidth: 2,
    borderColor: Colors.dark.card,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeText: {
    fontSize: 13,
    color: Colors.dark.secondary,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.dark.border,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    textTransform: 'uppercase',
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  earningsLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  earningsValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.accent,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
