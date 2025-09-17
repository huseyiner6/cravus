// src/app/navigation/RootTabs.tsx
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import MapScreen from '../screens/Map/MapScreen';
import CheckinScreen from '../screens/Checkin/CheckinScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import LoginScreen from '../screens/Auth/LoginScreen';
import { supabase } from '@/lib/supabase/client';

export type TabParamList = {
  Map: undefined;
  Checkin:
    | { expectedVenueId?: string; expectedWindowId?: string }
    | undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

/**
 * Profile tab gate:
 * - Session varsa ProfileScreen
 * - Yoksa LoginScreen
 */
function ProfileTabGate() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => sub.subscription?.unsubscribe();
  }, []);

  if (hasSession === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return hasSession ? <ProfileScreen /> : <LoginScreen />;
}

export default function RootTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Map"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ title: 'Map' }}
      />
      <Tab.Screen
        name="Checkin"
        component={CheckinScreen}
        options={{ title: 'Scan' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileTabGate}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}