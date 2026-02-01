import { Tabs, router } from "expo-router";
import { LayoutDashboard, Calendar, Users, ScanLine, Settings, Building2 } from "lucide-react-native";
import React from "react";
import { Platform, TouchableOpacity } from "react-native";
import Colors from "@/constants/colors";

export default function TabLayout() {
  const handleOpenSettings = () => {
    router.push('/account/settings');
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
          <TouchableOpacity 
            onPress={handleOpenSettings}
            style={{ marginRight: 16, padding: 8 }}
          >
            <Settings color={Colors.dark.textMuted} size={20} />
          </TouchableOpacity>
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
