import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#F8C537',
        tabBarInactiveTintColor: '#8D99AE',
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#0B1628',
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Players',
          tabBarIcon: ({ color }) => <MaterialIcons size={25} name="groups" color={color} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color }) => <MaterialIcons size={25} name="sports-tennis" color={color} />,
        }}
      />
    </Tabs>
  );
}
