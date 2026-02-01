import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.dark.background },
        headerTintColor: Colors.dark.text,
        headerTitleStyle: { fontWeight: '700' as const },
        headerBackTitle: 'Atrás',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin' }} />
      <Stack.Screen name="users" options={{ title: 'Usuarios' }} />
      <Stack.Screen name="events-manage" options={{ title: 'Eventos' }} />
      <Stack.Screen name="promoters-manage" options={{ title: 'Promotores' }} />
      <Stack.Screen name="sellers-manage" options={{ title: 'Vendedores' }} />
      <Stack.Screen name="tickets-manage" options={{ title: 'Entradas' }} />
      <Stack.Screen name="subscriptions" options={{ title: 'Suscripciones' }} />
      <Stack.Screen name="payments" options={{ title: 'Pagos' }} />
      <Stack.Screen name="reports" options={{ title: 'Reportes' }} />
      <Stack.Screen name="settings" options={{ title: 'Configuración' }} />
    </Stack>
  );
}
