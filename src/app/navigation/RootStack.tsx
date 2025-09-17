import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';

import RootTabs from './RootTabs';
import CheckinScreen from '../screens/Checkin/CheckinScreen';
import ActiveDiscountScreen from '../screens/Checkin/ActiveDiscountScreen';
import PaywallScreen from '../screens/Paywall/PaywallScreen';
import DealDetailsScreen from '../screens/DealDetails/DealDetailsScreen';
import RiverSessionDetailScreen from '../screens/River/RiverSessionDetailScreen';
import PermissionsScreen from '../screens/Onboarding/PermissionsScreen';

export type RootStackParamList = {
  Gate: undefined;
  Permissions: undefined;
  Tabs: undefined;
  DealDetails: { windowId: string };
  ActiveDiscount: { checkinId: string; otp?: string | null; expiresAt?: string | null };
  Checkin: { expectedVenueId?: string; expectedWindowId?: string } | undefined;
  Paywall: undefined;
  RiverSession: { sessionId?: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ENV flag: allow running without real location when mocking
const USE_MOCK = (process.env.EXPO_PUBLIC_DEBUG_MOCK_LOCATION ?? '') === '1';

function GateScreen({ navigation }: any) {
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [locPerm, requestLocPerm] = Location.useForegroundPermissions();

  useEffect(() => {
    (async () => {
      if (!camPerm) await requestCamPerm();
      if (!locPerm) await requestLocPerm();

      const cameraOk = !!camPerm?.granted;
      const locationOk = USE_MOCK ? true : !!locPerm?.granted;

      if (cameraOk && locationOk) {
        navigation.replace('Tabs');
      } else {
        navigation.replace('Permissions');
      }
    })();
    // We intentionally depend on granted flags so Gate reacts to changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camPerm?.granted, locPerm?.granted]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <ActivityIndicator />
      <Text style={{ color: '#666' }}>Preparing…</Text>
    </View>
  );
}

export default function RootStack() {
  return (
    <Stack.Navigator initialRouteName="Gate" screenOptions={{ headerShown: false }}>
      {/* First-run gate that forwards to Permissions or Tabs */}
      <Stack.Screen name="Gate" component={GateScreen} />

      {/* Onboarding */}
      <Stack.Screen name="Permissions" component={PermissionsScreen} />

      {/* Main tabs */}
      <Stack.Screen name="Tabs" component={RootTabs} />

      {/* Feature screens */}
      <Stack.Screen name="Checkin" component={CheckinScreen} />
      <Stack.Screen name="ActiveDiscount" component={ActiveDiscountScreen} />
      <Stack.Screen name="DealDetails" component={DealDetailsScreen} />
      <Stack.Screen
        name="RiverSession"
        component={RiverSessionDetailScreen}
        options={{ headerShown: true, title: 'River session' }}
      />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ presentation: 'modal', headerShown: true, title: 'Membership' }}
      />
    </Stack.Navigator>
  );
}