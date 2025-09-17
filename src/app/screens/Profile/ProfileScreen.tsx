// src/app/screens/Profile/ProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase/client';
import { getMembership, upgradeMembership } from '@/lib/supabase/membership';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string>('');
  const [tier, setTier] = useState<'free' | 'regular' | 'pro'>('free');
  const [freeLeft, setFreeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    try {
      const t = await getMembership();
      setTier(t);
      if (t === 'free') {
        const { data } = await supabase
          .from('profiles')
          .select('free_checkins_remaining')
          .maybeSingle();
        setFreeLeft((data as any)?.free_checkins_remaining ?? null);
      } else {
        setFreeLeft(null);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('membership refresh error:', e);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''));
    refresh();
  }, []);

  const choose = async (t: 'regular' | 'pro') => {
    try {
      setLoading(true);
      await upgradeMembership(t);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Upgrade failed', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sign out failed', e?.message ?? 'Unknown error');
    }
  };

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 16,
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 6 }}>Profile</Text>
      {!!email && <Text style={{ color: '#666', marginBottom: 16 }}>{email}</Text>}

      <Text style={{ color: '#111', marginBottom: 12 }}>
        Current tier: <Text style={{ fontWeight: '700' }}>{tier}</Text>
      </Text>
      {tier === 'free' && (
        <Text style={{ color: '#555', marginBottom: 12 }}>
          Free check-ins left: <Text style={{ fontWeight: '700' }}>{freeLeft ?? '—'}</Text>
        </Text>
      )}

      <Pressable
        onPress={refresh}
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 10,
          backgroundColor: '#e5e7eb',
          marginBottom: 16,
        }}
      >
        <Text style={{ fontWeight: '700' }}>Refresh</Text>
      </Pressable>

      {loading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <ActivityIndicator />
          <Text style={{ marginLeft: 8, color: '#666' }}>Updating…</Text>
        </View>
      )}

      <Pressable
        disabled={loading}
        onPress={() => choose('regular')}
        style={{
          backgroundColor: '#2563eb',
          paddingVertical: 14,
          borderRadius: 12,
          marginBottom: 10,
          opacity: loading ? 0.7 : 1,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700', textAlign: 'center' }}>Go Regular</Text>
      </Pressable>

      <Pressable
        disabled={loading}
        onPress={() => choose('pro')}
        style={{
          backgroundColor: '#16a34a',
          paddingVertical: 14,
          borderRadius: 12,
          marginBottom: 10,
          opacity: loading ? 0.7 : 1,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700', textAlign: 'center' }}>Go Pro</Text>
      </Pressable>

      <Pressable
        disabled={loading}
        onPress={signOut}
        style={{
          backgroundColor: '#ef4444',
          paddingVertical: 14,
          borderRadius: 12,
          marginTop: 24,
          opacity: loading ? 0.7 : 1,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700', textAlign: 'center' }}>Sign out</Text>
      </Pressable>
    </View>
  );
}