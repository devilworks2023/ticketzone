import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { trpc, trpcClient } from '@/lib/trpc';
import Colors from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: Colors.dark.background },
              headerTintColor: Colors.dark.text,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: Colors.dark.background },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'MusicLab AI' }} />
            <Stack.Screen name="analyzer/index" options={{ title: 'Analizar Track' }} />
            <Stack.Screen name="analyzer/[id]" options={{ title: 'Resultado del Análisis' }} />
            <Stack.Screen name="recommender/index" options={{ title: 'Descubrir Similares' }} />
            <Stack.Screen name="recommender/[id]" options={{ title: 'Recomendaciones' }} />
            <Stack.Screen name="history/index" options={{ title: 'Historial' }} />
          </Stack>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
