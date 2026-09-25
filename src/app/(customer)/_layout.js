import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useApp } from '../../AppContext';
import { colors } from '../../theme';

const icons = { index: '⌂', equipment: '🎪', cart: '🛒', 'my-rentals': '📋' };

export default function CustomerTabsLayout() {
  const { cart } = useApp();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

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
      <Tabs.Screen name="index" options={{ title: 'Home', headerTitle: 'EventGear' }} />
      <Tabs.Screen name="equipment" options={{ title: 'Equipment' }} />
      <Tabs.Screen name="cart" options={{ title: 'Cart', tabBarBadge: count || undefined, tabBarBadgeStyle: { backgroundColor: colors.teal } }} />
      <Tabs.Screen name="my-rentals" options={{ title: 'My Rentals' }} />
    </Tabs>
  );
}
