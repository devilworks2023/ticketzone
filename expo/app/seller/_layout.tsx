import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function SellerLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.dark.background,
        },
        headerTintColor: Colors.dark.text,
        headerTitleStyle: {
          fontWeight: '700',
        },
        contentStyle: {
          backgroundColor: Colors.dark.background,
        },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="history" options={{ title: 'Historial de Ventas' }} />
      <Stack.Screen name="[id]" options={{ title: 'Vendedor' }} />
      <Stack.Screen name="create" options={{ title: 'Nuevo Vendedor' }} />
    </Stack>
  );
}
