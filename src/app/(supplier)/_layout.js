import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '../../theme';

const icons = { index: '⌂', 'manage-equipment': '📦', reservations: '📋' };

export default function SupplierTabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: colors.tealDark,
        tabBarInactiveTintColor: '#8490A1',
        tabBarStyle: { height: 66, paddingTop: 7, paddingBottom: 8, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, color: focused ? colors.tealDark : '#8490A1' }}>{icons[route.name]}</Text>,
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', headerTitle: 'Supplier' }} />
      <Tabs.Screen name="manage-equipment" options={{ title: 'Equipment' }} />
      <Tabs.Screen name="reservations" options={{ title: 'Reservations' }} />
    </Tabs>
  );
}
