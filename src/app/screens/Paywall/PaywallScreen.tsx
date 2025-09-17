// src/app/screens/Paywall/PaywallScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMembership, upgradeMembership, SubscriptionTier } from '@/lib/supabase/membership';

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const t = await getMembership();
      setTier(t);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('membership refresh error:', e?.message || e);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onChoose = async (t: Exclude<SubscriptionTier, 'free'>) => {
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

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 16,
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ fontWeight: '800', fontSize: 22, marginBottom: 12 }}>Membership</Text>
      <Text style={{ color: '#666', marginBottom: 16 }}>
        Current tier: <Text style={{ fontWeight: '700', color: '#111' }}>{tier}</Text>
      </Text>

      {loading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <ActivityIndicator />
          <Text style={{ marginLeft: 8, color: '#666' }}>Updating…</Text>
        </View>
      )}

      <Pressable
        disabled={loading}
        onPress={() => onChoose('regular')}
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
        onPress={() => onChoose('pro')}
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

      <Text style={{ color: '#6b7280', marginTop: 16 }}>
        Changes take effect immediately for development. In production, purchases are validated by the server.
      </Text>
    </View>
  );
}