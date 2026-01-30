import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AppProvider } from "@/contexts/AppContext";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack 
      screenOptions={{ 
        headerBackTitle: "Atrás",
        headerStyle: { backgroundColor: Colors.dark.background },
        headerTintColor: Colors.dark.text,
        contentStyle: { backgroundColor: Colors.dark.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="event/[id]" 
        options={{ 
          presentation: "card",
          headerTitle: "Detalles del Evento",
        }} 
      />
      <Stack.Screen 
        name="event/create" 
        options={{ 
          presentation: "modal",
          headerTitle: "Nuevo Evento",
        }} 
      />
      <Stack.Screen 
        name="seller/[id]" 
        options={{ 
          presentation: "card",
          headerTitle: "Vendedor",
        }} 
      />
      <Stack.Screen 
        name="seller/create" 
        options={{ 
          presentation: "modal",
          headerTitle: "Nuevo Vendedor",
        }} 
      />
      <Stack.Screen 
        name="purchase/[eventId]" 
        options={{ 
          presentation: "modal",
          headerTitle: "Comprar Entradas",
        }} 
      />
      <Stack.Screen 
        name="boxoffice" 
        options={{ 
          presentation: "fullScreenModal",
          headerShown: false,
        }} 
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppProvider>
          <StatusBar style="light" />
          <RootLayoutNav />
        </AppProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
