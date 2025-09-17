// src/app/screens/Checkin/ActiveDiscountScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { redeemCheckin } from '@/lib/supabase/checkin';

type Params = {
  checkinId: string;
  otp?: string | null;
  expiresAt?: string | null; // ISO
};

export default function ActiveDiscountScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { params } = useRoute<any>();
  const { checkinId, otp, expiresAt }: Params = params ?? {};

  const [now, setNow] = useState<number>(Date.now());
  const [redeeming, setRedeeming] = useState(false);
  const [copied, setCopied] = useState(false);

  // Geri sayım
  const expiryMs = useMemo(
    () => (expiresAt ? new Date(expiresAt).getTime() : 0),
    [expiresAt]
  );
  const secsLeft = Math.max(0, Math.floor((expiryMs - now) / 1000));
  const expired = expiryMs > 0 ? secsLeft <= 0 : false;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(secsLeft / 60)).padStart(2, '0');
  const ss = String(secsLeft % 60).padStart(2, '0');

  const goHome = () => {
    const parent = nav.getParent?.();
    if (parent?.navigate) parent.navigate('Map');
    else nav.navigate('Tabs');
  };

  const startNewScan = () => {
    const parent = nav.getParent?.();
    if (parent?.navigate) parent.navigate('Checkin');
    else nav.navigate('Checkin');
  };

  const handleRedeem = async () => {
    try {
      setRedeeming(true);
      await redeemCheckin(checkinId);
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      goHome();
    } catch (e: any) {
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      const msg = String(e?.raw || e?.message || 'Redeem failed');
      if (msg.includes('otp_expired')) {
        Alert.alert('Expired', 'This code has expired. Please start a new check-in.');
      } else if (msg.includes('not_authenticated')) {
        Alert.alert('Sign in required', 'Please sign in again from Profile.');
      } else if (msg.includes('not_found')) {
        Alert.alert('Not found', 'Active discount could not be found.');
      } else {
        Alert.alert('Failed', msg);
      }
    } finally {
      setRedeeming(false);
    }
  };

  const copyOtp = async () => {
    if (!otp) return;
    try {
      await Clipboard.setStringAsync(otp);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    } catch {}
  };

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 16,
      }}
    >
      <Text style={{ fontWeight: '800', fontSize: 22, marginBottom: 6 }}>Active discount</Text>
      <Text style={{ color: '#666', marginBottom: 16 }}>
        Show this one-time code to your server. {expiryMs ? `Expires in ${mm}:${ss}.` : ''}
      </Text>

      <View
        style={{
          padding: 16,
          borderRadius: 16,
          backgroundColor: '#F6F6F6',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#888', fontWeight: '700' }}>OTP</Text>
        <Text style={{ fontSize: 64, fontWeight: '800', letterSpacing: 6, marginTop: 8 }}>
          {otp ?? '—'}
        </Text>
        <Text
          style={{
            marginTop: 8,
            color: expired ? '#DC2626' : '#16A34A',
            fontWeight: '700',
          }}
        >
          {expired ? 'Expired' : 'Active'}
        </Text>

        {copied && (
          <View
            style={{
              marginTop: 10,
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: '#111827',
              borderRadius: 8,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Copied</Text>
          </View>
        )}
      </View>

      <Pressable
        disabled={expired || redeeming}
        onPress={handleRedeem}
        style={{
          marginTop: 16,
          backgroundColor: '#16A34A',
          opacity: expired || redeeming ? 0.6 : 1,
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: 'center',
        }}
      >
        {redeeming ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={{ color: 'white', fontWeight: '800' }}>Mark as redeemed</Text>
        )}
      </Pressable>

      <Pressable onPress={copyOtp} style={{ marginTop: 18, alignItems: 'center' }}>
        <Text style={{ color: '#2563EB', fontSize: 18, fontWeight: '700' }}>Copy code</Text>
      </Pressable>

      <Pressable onPress={goHome} style={{ marginTop: 18, alignItems: 'center' }}>
        <Text style={{ color: '#2563EB', fontSize: 18, fontWeight: '700' }}>Back to Map</Text>
      </Pressable>

      {expired && (
        <Pressable onPress={startNewScan} style={{ marginTop: 22, alignItems: 'center' }}>
          <Text style={{ color: '#2563EB' }}>Start a new scan</Text>
        </Pressable>
      )}
    </View>
  );
}