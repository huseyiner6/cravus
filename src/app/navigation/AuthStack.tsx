import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../screens/Onboarding/OnboardingScreen';
import LoginScreen from '../screens/Auth/LoginScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  const [initial, setInitial] = useState<'Onboarding' | 'Login' | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem('onboarded_v1');
        setInitial(seen ? 'Login' : 'Onboarding');
      } catch {
        setInitial('Login');
      }
    })();
  }, []);

  if (initial === null) {
    return <View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator/></View>;
  }

  return (
    <Stack.Navigator initialRouteName={initial}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
    </Stack.Navigator>
  );
}