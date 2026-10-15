import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '../../theme';
const icons = { index: '⌂', users: '👥', equipment: '📦', reservations: '📋', reports: '📊' };
export default function AdminTabsLayout() {
  return <Tabs screenOptions={({ route }) => ({ headerStyle: { backgroundColor: colors.navy }, headerTintColor: '#FFFFFF',
    tabBarActiveTintColor: colors.tealDark, tabBarInactiveTintColor: colors.muted,
    tabBarLabelStyle: { fontSize: 10 }, tabBarIcon: () => <Text style={{ fontSize: 20 }}>{icons[route.name]}</Text> })}>
    <Tabs.Screen name="index" options={{ title: 'Overview', headerTitle: 'Administrator' }} />
    <Tabs.Screen name="users" options={{ title: 'Users' }} /><Tabs.Screen name="equipment" options={{ title: 'Equipment' }} />
    <Tabs.Screen name="reservations" options={{ title: 'Bookings' }} /><Tabs.Screen name="reports" options={{ title: 'Reports' }} />
  </Tabs>;
}
