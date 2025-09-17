// src/app/screens/Auth/LoginScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup';

const DEV_EMAIL = process.env.EXPO_PUBLIC_DEV_EMAIL || 'dev@cravus.local';
const DEV_PASSWORD = process.env.EXPO_PUBLIC_DEV_PASSWORD || 'devdevdev';

export default function LoginScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Giriş/kayıt sonrası nereye gideceğimiz:
  function postAuthNavigate() {
    // Bu ekran Profile tab'ının içinde; parent = BottomTab navigator
    const parent = navigation.getParent?.();
    if (parent?.navigate) {
      // İstersen 'Map' yazıp haritaya da atabilirsin.
      parent.navigate('Profile');
      return;
    }
    // Başka yerlerden de kullanılabilirse:
    if (typeof navigation.replace === 'function') {
      navigation.replace('Tabs');
      return;
    }
    if (navigation.canGoBack?.()) {
      navigation.goBack();
    }
  }

  const submit = async () => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Email ve parola zorunlu.');
      return;
    }
    try {
      setLoading(true);
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // enable_confirmations=false ise oturum anında açılır
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      postAuthNavigate();
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(mode === 'signin' ? 'Sign in failed' : 'Sign up failed', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const devLoginSeed = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
      });
      if (error) throw error;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      postAuthNavigate();
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Dev login failed', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const devSignupOneTap = async () => {
    try {
      setLoading(true);
      const ts = Date.now();
      const devMail = `dev+${ts}@cravus.local`;
      const { error } = await supabase.auth.signUp({ email: devMail, password: DEV_PASSWORD });
      if (error) throw error;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      postAuthNavigate();
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Dev sign-up failed', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 24 }}>
        {mode === 'signin' ? 'Sign in' : 'Create account'}
      </Text>

      <Text style={{ fontSize: 28, fontWeight: '800', marginBottom: 12 }}>Cravus</Text>

      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: '#e5e7eb',
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 10,
        }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: '#e5e7eb',
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 16,
        }}
      />

      <Pressable
        disabled={loading}
        onPress={submit}
        style={{
          backgroundColor: '#111827',
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
          opacity: loading ? 0.7 : 1,
          marginBottom: 10,
        }}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={{ color: 'white', fontWeight: '700' }}>
            {mode === 'signin' ? 'Sign in' : 'Sign up'}
          </Text>
        )}
      </Pressable>

      <Pressable
        disabled={loading}
        onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        style={{ alignSelf: 'center', padding: 8 }}
      >
        <Text style={{ color: '#2563eb', fontWeight: '700' }}>
          {mode === 'signin' ? 'Create an account' : 'Have an account? Sign in'}
        </Text>
      </Pressable>

      {/* Dev yardımcıları */}
      <Pressable disabled={loading} onPress={devLoginSeed} style={{ alignSelf: 'center', padding: 12, marginTop: 24 }}>
        <Text style={{ color: '#2563eb', fontWeight: '700' }}>Dev Login (seed)</Text>
      </Pressable>
      <Pressable disabled={loading} onPress={devSignupOneTap} style={{ alignSelf: 'center', padding: 12 }}>
        <Text style={{ color: '#16a34a', fontWeight: '700' }}>Dev Sign-up (1-tap)</Text>
      </Pressable>

      <Text style={{ color: '#9ca3af', textAlign: 'center', marginTop: 24 }}>
        Tip: Supabase Studio → Auth → Config → Email: enable_confirmations=false ise kayıt sonrası anında oturum açılır.
      </Text>
    </View>
  );
}