import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Ticket,
  Users,
  DollarSign,
  MapPin,
  Calendar,
  User,
  Globe,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import MapView, { Marker, Circle, Region } from 'react-native-maps';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';

interface GenderData {
  gender: string;
  count: number;
  revenue: number;
}

interface AgeData {
  range: string;
  count: number;
  revenue: number;
}

interface CityData {
  city: string;
  country: string;
  count: number;
  revenue: number;
}

interface CountryData {
  country: string;
  count: number;
  revenue: number;
}

interface LocationData {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  count: number;
  revenue: number;
}

interface WeekdayData {
  weekday: number;
  count: number;
  revenue: number;
}

interface MonthlyData {
  month: string;
  count: number;
  revenue: number;
}

interface AnalyticsTotals {
  totalTickets: number;
  uniqueBuyers: number;
  totalRevenue: number;
  withGender: number;
  withBirthdate: number;
  withLocation: number;
}

interface BuyerAnalytics {
  gender: GenderData[];
  ageRanges: AgeData[];
  cities: CityData[];
  countries: CountryData[];
  locations: LocationData[];
  totals: AnalyticsTotals;
  monthlySales: MonthlyData[];
  weekdaySales: WeekdayData[];
  hourlySales: { hour: number; count: number; revenue: number }[];
}

interface ChartBarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

function ChartBar({ label, value, maxValue, color }: ChartBarProps) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  
  return (
    <View style={styles.chartBarContainer}>
      <Text style={styles.chartBarLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.chartBarTrack}>
        <View style={[styles.chartBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.chartBarValue}>{value}</Text>
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
];

export default function AdminReportsScreen() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    gender: true,
    age: true,
    location: true,
    map: false,
    time: false,
  });

  // @ts-expect-error - endpoint exists in backend but types not yet generated
  const analyticsQuery = trpc.stats.getBuyerAnalytics.useQuery();

  const analytics = analyticsQuery.data as BuyerAnalytics | undefined;
  const isLoading = analyticsQuery.isLoading;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const genderColors: Record<string, string> = {
    male: '#3498db',
    female: '#e91e63',
    other: '#9b59b6',
    prefer_not_say: '#95a5a6',
  };

  const genderLabels: Record<string, string> = {
    male: 'Hombre',
    female: 'Mujer',
    other: 'Otro',
    prefer_not_say: 'No especificado',
  };

  const ageColors = ['#1abc9c', '#3498db', '#9b59b6', '#e74c3c', '#f39c12', '#2ecc71'];

  const ageLabels: Record<string, string> = {
    'under_18': 'Menores de 18',
    '18-24': '18-24 años',
    '25-34': '25-34 años',
    '35-44': '35-44 años',
    '45-54': '45-54 años',
    '55+': '55+ años',
    'unknown': 'Sin datos',
  };

  const weekdayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const maxGenderCount = useMemo(() => {
    if (!analytics?.gender) return 1;
    return Math.max(...analytics.gender.map((g: GenderData) => g.count), 1);
  }, [analytics?.gender]);

  const maxAgeCount = useMemo(() => {
    if (!analytics?.ageRanges) return 1;
    return Math.max(...analytics.ageRanges.map((a: AgeData) => a.count), 1);
  }, [analytics?.ageRanges]);

  const maxCityCount = useMemo(() => {
    if (!analytics?.cities) return 1;
    return Math.max(...analytics.cities.map((c: CityData) => c.count), 1);
  }, [analytics?.cities]);

  const maxWeekdayCount = useMemo(() => {
    if (!analytics?.weekdaySales) return 1;
    return Math.max(...analytics.weekdaySales.map((w: WeekdayData) => w.count), 1);
  }, [analytics?.weekdaySales]);

  const mapRegion: Region = useMemo(() => {
    if (!analytics?.locations || analytics.locations.length === 0) {
      return { latitude: 40.4168, longitude: -3.7038, latitudeDelta: 10, longitudeDelta: 10 };
    }
    const lats = analytics.locations.map((l: LocationData) => l.latitude);
    const lngs = analytics.locations.map((l: LocationData) => l.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(maxLat - minLat, 0.5) * 1.5,
      longitudeDelta: Math.max(maxLng - minLng, 0.5) * 1.5,
    };
  }, [analytics?.locations]);

  const dataCompleteness = useMemo(() => {
    if (!analytics?.totals) return { gender: 0, age: 0, location: 0 };
    const total = analytics.totals.totalTickets || 1;
    return {
      gender: Math.round((analytics.totals.withGender / total) * 100),
      age: Math.round((analytics.totals.withBirthdate / total) * 100),
      location: Math.round((analytics.totals.withLocation / total) * 100),
    };
  }, [analytics?.totals]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Analíticas de Compradores',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
            <Text style={styles.loadingText}>Cargando analíticas...</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Ticket color={Colors.dark.primary} size={22} />
                <Text style={styles.summaryValue}>{analytics?.totals?.totalTickets || 0}</Text>
                <Text style={styles.summaryLabel}>Entradas</Text>
              </View>
              <View style={styles.summaryCard}>
                <Users color={Colors.dark.secondary} size={22} />
                <Text style={styles.summaryValue}>{analytics?.totals?.uniqueBuyers || 0}</Text>
                <Text style={styles.summaryLabel}>Compradores</Text>
              </View>
              <View style={styles.summaryCard}>
                <DollarSign color={Colors.dark.success} size={22} />
                <Text style={[styles.summaryValue, { color: Colors.dark.success, fontSize: 16 }]}>
                  {formatCurrency(analytics?.totals?.totalRevenue || 0)}
                </Text>
                <Text style={styles.summaryLabel}>Ingresos</Text>
              </View>
            </View>

            <View style={styles.completenessCard}>
              <Text style={styles.completenessTitle}>Datos demográficos recopilados</Text>
              <View style={styles.completenessRow}>
                <View style={styles.completenessItem}>
                  <View style={[styles.completenessBar, { width: `${dataCompleteness.gender}%`, backgroundColor: '#e91e63' }]} />
                  <Text style={styles.completenessLabel}>Género: {dataCompleteness.gender}%</Text>
                </View>
                <View style={styles.completenessItem}>
                  <View style={[styles.completenessBar, { width: `${dataCompleteness.age}%`, backgroundColor: '#3498db' }]} />
                  <Text style={styles.completenessLabel}>Edad: {dataCompleteness.age}%</Text>
                </View>
                <View style={styles.completenessItem}>
                  <View style={[styles.completenessBar, { width: `${dataCompleteness.location}%`, backgroundColor: '#2ecc71' }]} />
                  <Text style={styles.completenessLabel}>Ubicación: {dataCompleteness.location}%</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('gender')}>
              <View style={styles.sectionHeaderLeft}>
                <User color={Colors.dark.primary} size={20} />
                <Text style={styles.sectionTitle}>Distribución por Género</Text>
              </View>
              {expandedSections.gender ? (
                <ChevronUp color={Colors.dark.textMuted} size={20} />
              ) : (
                <ChevronDown color={Colors.dark.textMuted} size={20} />
              )}
            </TouchableOpacity>
            {expandedSections.gender && (
              <View style={styles.sectionContent}>
                {analytics?.gender && analytics.gender.length > 0 ? (
                  <>
                    <View style={styles.chartLegend}>
                      {analytics.gender.map((g: GenderData, i: number) => (
                        <View key={i} style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: genderColors[g.gender] || '#888' }]} />
                          <Text style={styles.legendText}>{genderLabels[g.gender] || g.gender}</Text>
                        </View>
                      ))}
                    </View>
                    {analytics.gender.map((g: GenderData, index: number) => (
                      <ChartBar
                        key={index}
                        label={genderLabels[g.gender] || g.gender}
                        value={g.count}
                        maxValue={maxGenderCount}
                        color={genderColors[g.gender] || '#888'}
                      />
                    ))}
                    <View style={styles.chartNote}>
                      <Text style={styles.chartNoteText}>
                        Ingresos por género: {analytics.gender.map((g: GenderData) => 
                          `${genderLabels[g.gender] || g.gender}: ${formatCurrency(g.revenue)}`
                        ).join(' • ')}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.noDataText}>No hay datos de género disponibles</Text>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('age')}>
              <View style={styles.sectionHeaderLeft}>
                <Calendar color={Colors.dark.warning} size={20} />
                <Text style={styles.sectionTitle}>Distribución por Edad</Text>
              </View>
              {expandedSections.age ? (
                <ChevronUp color={Colors.dark.textMuted} size={20} />
              ) : (
                <ChevronDown color={Colors.dark.textMuted} size={20} />
              )}
            </TouchableOpacity>
            {expandedSections.age && (
              <View style={styles.sectionContent}>
                {analytics?.ageRanges && analytics.ageRanges.filter((a: AgeData) => a.range !== 'unknown').length > 0 ? (
                  <>
                    {analytics.ageRanges
                      .filter((a: AgeData) => a.range !== 'unknown')
                      .map((a: AgeData, index: number) => (
                        <ChartBar
                          key={index}
                          label={ageLabels[a.range] || a.range}
                          value={a.count}
                          maxValue={maxAgeCount}
                          color={ageColors[index % ageColors.length]}
                        />
                      ))}
                    <View style={styles.ageInsights}>
                      <Text style={styles.ageInsightTitle}>Insights de edad:</Text>
                      {(() => {
                        const validAges = analytics.ageRanges.filter((a: AgeData) => a.range !== 'unknown');
                        if (validAges.length === 0) return null;
                        const dominant = validAges.reduce((prev: AgeData, curr: AgeData) => curr.count > prev.count ? curr : prev);
                        const highestRevenue = validAges.reduce((prev: AgeData, curr: AgeData) => curr.revenue > prev.revenue ? curr : prev);
                        return (
                          <>
                            <Text style={styles.ageInsightText}>
                              • Grupo más grande: <Text style={styles.highlight}>{ageLabels[dominant.range]}</Text> ({dominant.count} entradas)
                            </Text>
                            <Text style={styles.ageInsightText}>
                              • Mayor gasto: <Text style={styles.highlight}>{ageLabels[highestRevenue.range]}</Text> ({formatCurrency(highestRevenue.revenue)})
                            </Text>
                          </>
                        );
                      })()}
                    </View>
                  </>
                ) : (
                  <Text style={styles.noDataText}>No hay datos de edad disponibles</Text>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('location')}>
              <View style={styles.sectionHeaderLeft}>
                <Globe color={Colors.dark.secondary} size={20} />
                <Text style={styles.sectionTitle}>Distribución Geográfica</Text>
              </View>
              {expandedSections.location ? (
                <ChevronUp color={Colors.dark.textMuted} size={20} />
              ) : (
                <ChevronDown color={Colors.dark.textMuted} size={20} />
              )}
            </TouchableOpacity>
            {expandedSections.location && (
              <View style={styles.sectionContent}>
                {analytics?.cities && analytics.cities.length > 0 ? (
                  <>
                    <Text style={styles.subsectionTitle}>Top Ciudades</Text>
                    {analytics.cities.slice(0, 10).map((city: CityData, index: number) => (
                      <ChartBar
                        key={index}
                        label={`${city.city}${city.country ? `, ${city.country}` : ''}`}
                        value={city.count}
                        maxValue={maxCityCount}
                        color={Colors.dark.primary}
                      />
                    ))}
                    
                    {analytics.countries && analytics.countries.length > 0 && (
                      <>
                        <Text style={[styles.subsectionTitle, { marginTop: 20 }]}>Por País</Text>
                        <View style={styles.countryGrid}>
                          {analytics.countries.slice(0, 8).map((country: CountryData, index: number) => (
                            <View key={index} style={styles.countryItem}>
                              <Text style={styles.countryFlag}>🌍</Text>
                              <Text style={styles.countryName} numberOfLines={1}>{country.country}</Text>
                              <Text style={styles.countryCount}>{country.count}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                  </>
                ) : (
                  <Text style={styles.noDataText}>No hay datos de ubicación disponibles</Text>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('map')}>
              <View style={styles.sectionHeaderLeft}>
                <MapPin color="#e74c3c" size={20} />
                <Text style={styles.sectionTitle}>Mapa de Compradores</Text>
              </View>
              {expandedSections.map ? (
                <ChevronUp color={Colors.dark.textMuted} size={20} />
              ) : (
                <ChevronDown color={Colors.dark.textMuted} size={20} />
              )}
            </TouchableOpacity>
            {expandedSections.map && (
              <View style={styles.sectionContent}>
                {analytics?.locations && analytics.locations.length > 0 ? (
                  <View style={styles.mapContainer}>
                    <MapView
                      style={styles.map}
                      initialRegion={mapRegion}
                      customMapStyle={darkMapStyle}
                    >
                      {analytics.locations.map((loc: LocationData, index: number) => (
                        <React.Fragment key={index}>
                          <Circle
                            center={{ latitude: loc.latitude, longitude: loc.longitude }}
                            radius={Math.max(loc.count * 5000, 10000)}
                            fillColor="rgba(102, 126, 234, 0.3)"
                            strokeColor="rgba(102, 126, 234, 0.8)"
                            strokeWidth={2}
                          />
                          <Marker
                            coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                            title={`${loc.city}, ${loc.country}`}
                            description={`${loc.count} entradas - ${formatCurrency(loc.revenue)}`}
                          />
                        </React.Fragment>
                      ))}
                    </MapView>
                    <View style={styles.mapLegend}>
                      <Text style={styles.mapLegendText}>
                        {analytics.locations.length} ubicaciones • Toca los marcadores para más info
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.noDataText}>No hay datos de coordenadas disponibles para el mapa</Text>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('time')}>
              <View style={styles.sectionHeaderLeft}>
                <Clock color="#f39c12" size={20} />
                <Text style={styles.sectionTitle}>Análisis Temporal</Text>
              </View>
              {expandedSections.time ? (
                <ChevronUp color={Colors.dark.textMuted} size={20} />
              ) : (
                <ChevronDown color={Colors.dark.textMuted} size={20} />
              )}
            </TouchableOpacity>
            {expandedSections.time && (
              <View style={styles.sectionContent}>
                {analytics?.weekdaySales && analytics.weekdaySales.length > 0 && (
                  <>
                    <Text style={styles.subsectionTitle}>Ventas por Día de la Semana</Text>
                    <View style={styles.weekdayChart}>
                      {[0, 1, 2, 3, 4, 5, 6].map(day => {
                        const data = analytics.weekdaySales.find((w: WeekdayData) => w.weekday === day);
                        const count = data?.count || 0;
                        const height = maxWeekdayCount > 0 ? (count / maxWeekdayCount) * 80 : 0;
                        return (
                          <View key={day} style={styles.weekdayItem}>
                            <Text style={styles.weekdayCount}>{count}</Text>
                            <View style={styles.weekdayBarContainer}>
                              <View style={[styles.weekdayBar, { height, backgroundColor: day === 5 || day === 6 ? Colors.dark.primary : Colors.dark.secondary }]} />
                            </View>
                            <Text style={styles.weekdayLabel}>{weekdayLabels[day]}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}

                {analytics?.monthlySales && analytics.monthlySales.length > 0 && (
                  <>
                    <Text style={[styles.subsectionTitle, { marginTop: 24 }]}>Tendencia Mensual</Text>
                    {analytics.monthlySales.slice(-6).map((m: MonthlyData, index: number) => {
                      const maxMonthly = Math.max(...analytics.monthlySales.map((ms: MonthlyData) => ms.count), 1);
                      return (
                        <View key={index} style={styles.monthlyItem}>
                          <Text style={styles.monthlyLabel}>{m.month}</Text>
                          <View style={styles.monthlyBarContainer}>
                            <View style={[styles.monthlyBar, { width: `${(m.count / maxMonthly) * 100}%` }]} />
                          </View>
                          <Text style={styles.monthlyValue}>{m.count} ({formatCurrency(m.revenue)})</Text>
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            )}

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
  loading: {
    padding: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: Colors.dark.textMuted,
    fontSize: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  completenessCard: {
    backgroundColor: Colors.dark.card,
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  completenessTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  completenessRow: {
    gap: 10,
  },
  completenessItem: {
    marginBottom: 8,
  },
  completenessBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  completenessLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.card,
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    marginBottom: 2,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  sectionContent: {
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  chartBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  chartBarLabel: {
    width: 100,
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  chartBarTrack: {
    flex: 1,
    height: 20,
    backgroundColor: Colors.dark.border,
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  chartBarFill: {
    height: '100%',
    borderRadius: 10,
  },
  chartBarValue: {
    width: 40,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text,
    textAlign: 'right',
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  chartNote: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  chartNoteText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    lineHeight: 18,
  },
  noDataText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    padding: 20,
  },
  ageInsights: {
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  ageInsightTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  ageInsightText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  highlight: {
    color: Colors.dark.primary,
    fontWeight: '600',
  },
  countryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  countryItem: {
    width: '47%',
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryFlag: {
    fontSize: 16,
  },
  countryName: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  countryCount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: 300,
  },
  mapLegend: {
    backgroundColor: Colors.dark.background,
    padding: 10,
  },
  mapLegendText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  weekdayChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 130,
    paddingTop: 20,
  },
  weekdayItem: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayCount: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginBottom: 4,
  },
  weekdayBarContainer: {
    width: 24,
    height: 80,
    justifyContent: 'flex-end',
  },
  weekdayBar: {
    width: '100%',
    borderRadius: 4,
  },
  weekdayLabel: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 6,
  },
  monthlyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  monthlyLabel: {
    width: 60,
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  monthlyBarContainer: {
    flex: 1,
    height: 16,
    backgroundColor: Colors.dark.border,
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  monthlyBar: {
    height: '100%',
    backgroundColor: Colors.dark.primary,
    borderRadius: 8,
  },
  monthlyValue: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    width: 100,
    textAlign: 'right',
  },
  bottomPadding: {
    height: 40,
  },
});
