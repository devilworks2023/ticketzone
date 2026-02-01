import { Tabs, router } from "expo-router";
import { LayoutDashboard, Calendar, Users, ScanLine, Settings, Building2, LogOut } from "lucide-react-native";
import React from "react";
import { Platform, TouchableOpacity, View, Alert } from "react-native";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

export default function TabLayout() {
  const { logout } = useAuth();

  const handleOpenSettings = () => {
    router.push('/account/settings');
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            console.log('Logging out...');
            await logout();
            console.log('Logged out, navigating to home...');
            router.replace('/');
          },
        },
      ]
    );
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.dark.primary,
        tabBarInactiveTintColor: Colors.dark.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.dark.surface,
          borderTopColor: Colors.dark.border,
          borderTopWidth: 1,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 88 : 68,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: Colors.dark.background,
        },
        headerTintColor: Colors.dark.text,
        headerTitleStyle: {
          fontWeight: '700',
        },
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
            <TouchableOpacity 
              onPress={handleOpenSettings}
              style={{ padding: 8 }}
            >
              <Settings color={Colors.dark.textMuted} size={20} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleLogout}
              style={{ padding: 8 }}
            >
              <LogOut color={Colors.dark.error} size={20} />
            </TouchableOpacity>
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Eventos",
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="sellers"
        options={{
          title: "Vendedores",
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="promoters"
        options={{
          title: "Promotores",
          tabBarIcon: ({ color, size }) => <Building2 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: "Escáner",
          tabBarIcon: ({ color, size }) => <ScanLine color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
