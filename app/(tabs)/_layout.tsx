import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      headerShown: false, // Hides the default top header
      tabBarStyle: { display: 'none' } // Hides the default bottom tabs (Home/Explore)
    }}>
      <Tabs.Screen name="index" />
    </Tabs>
  );
}