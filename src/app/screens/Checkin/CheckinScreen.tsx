// src/app/screens/Checkin/CheckinScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Button, ActivityIndicator, Pressable, AppState, AppStateStatus } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/app/navigation/RootStack';
import { createCheckin } from '@/lib/supabase/checkin';
import { supabase } from '@/lib/supabase/client';

type RouteParams = {
  expectedVenueId?: string;
  expectedWindowId?: string;
};

type Banner =
  | { kind: 'ok'; msg: string; cta?: { label: string; onPress: () => void } }
  | { kind: 'err'; msg: string; cta?: { label: string; onPress: () => void } };

// Debug env (gerçek cihazda mock location için)
const USE_MOCK = (process.env.EXPO_PUBLIC_DEBUG_MOCK_LOCATION ?? '') === '1';
const MOCK_LAT = Number(process.env.EXPO_PUBLIC_DEBUG_LAT);
const MOCK_LNG = Number(process.env.EXPO_PUBLIC_DEBUG_LNG);

export default function CheckinScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { expectedVenueId, expectedWindowId } = (route.params || {}) as RouteParams;

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [locPerm, requestLocPerm] = Location.useForegroundPermissions();

  const [processing, setProcessing] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>('active');
  const isActive = isFocused && appState === 'active';
  const lockRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  useEffect(() => {
    if (!camPerm) requestCamPerm();
    if (!locPerm) requestLocPerm();
  }, [camPerm, locPerm, requestCamPerm, requestLocPerm]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setAppState(s));
    return () => sub.remove();
  }, []);

  const showError = async (msg: string, cta?: Banner['cta']) => {
    setBanner({ kind: 'err', msg, cta });
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
  };
  const showOk = async (msg: string, cta?: Banner['cta']) => {
    setBanner({ kind: 'ok', msg, cta });
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  };

  const parseObj = (val: unknown) => {
    if (!val) return null;
    if (typeof val === 'object') return val as any;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return null; }
    }
    return null;
  };

  const handleScan = async (raw: string) => {
    if (lockRef.current || processing || !isActive) return;
    lockRef.current = true;

    try {
      // Parse QR
      const url = new URL(raw);
      const venue_id = url.searchParams.get('venue_id') ?? '';
      const window_id = url.searchParams.get('window_id') ?? '';
      if (!venue_id || !window_id) {
        await showError('This QR is not valid for Cravus.');
        return;
      }
      if (expectedVenueId && venue_id !== expectedVenueId) {
        await showError('QR does not match this venue.');
        return;
      }
      if (expectedWindowId && window_id !== expectedWindowId) {
        await showError('QR does not match this window.');
        return;
      }

      // Location is required
      if (!locPerm?.granted && !USE_MOCK) {
        await showError('Location permission is required to check in.');
        return;
      }

      let lat: number, lng: number;
      if (USE_MOCK && !Number.isNaN(MOCK_LAT) && !Number.isNaN(MOCK_LNG)) {
        lat = MOCK_LAT;
        lng = MOCK_LNG;
      } else {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: true,
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        // eslint-disable-next-line no-console
        console.log('Checkin device coords', { lat, lng });
      }

      setProcessing(true);
      setBanner(null);

      const chk = await createCheckin({ venue_id, window_id, method: 'qr', lat, lng });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      nav.navigate('ActiveDiscount', {
        checkinId: chk.id,
        otp: chk.otp_code ?? '',
        expiresAt: chk.otp_expires_at ?? null,
      });
    } catch (e: any) {
      try {
        if (e && e.raw) {
          // eslint-disable-next-line no-console
          console.error('Checkin error raw:', e.raw);
        }
      } catch {}

      const body = parseObj(e?.raw) || parseObj(e?.message);
      const code = String(body?.error || e?.message || '').toLowerCase();

      if (code === 'free_limit_reached') {
        await showError('Free plan limit reached. Upgrade to continue.', {
          label: 'Upgrade',
          onPress: () => nav.navigate('Paywall'),
        });
      } else if (code === 'not_at_venue') {
        const meters = typeof body?.meters === 'number' ? Math.round(body.meters) : null;
        const threshold = body?.threshold ?? 75;
        await showError(
          meters != null
            ? `You are ~${meters}m away. Get within ${threshold}m of the venue.`
            : 'You are not at this venue. Move closer.'
        );
      } else if (code === 'location_required') {
        await showError('Location permission is required.');
      } else if (code === 'cooldown_active') {
        const untilIso = body?.until;
        if (untilIso) {
          const ms = new Date(untilIso).getTime() - Date.now();
          const min = Math.max(1, Math.ceil(ms / 60000));
          await showError(`Please try again in ~${min} min.`);
        } else {
          await showError('You’ve used a discount recently. Try again later.');
        }
      } else if (code === 'window_inactive') {
        await showError('This window is not active.');
      } else if (code === 'window_mismatch') {
        await showError('QR does not match this venue window.');
      } else if (code === 'not_authenticated') {
        await showError('Please sign in again from Profile.');
      } else if (code === 'missing_env') {
        await showError('Server misconfigured. Please try later.');
      } else {
        const rawMsg = String(e?.raw || e?.message || 'Check-in failed.');
        await showError(rawMsg);
      }
    } finally {
      setProcessing(false);
      setTimeout(() => (lockRef.current = false), 600);
    }
  };

  // Guards
  if (!camPerm || (!locPerm && !USE_MOCK))
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
        <Text>Requesting permissions…</Text>
      </View>
    );

  if (!camPerm.granted || (!locPerm?.granted && !USE_MOCK))
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }}>
        {!camPerm.granted && (
          <>
            <Text style={{ fontWeight: '600' }}>Camera permission is required.</Text>
            <Button title="Allow camera" onPress={requestCamPerm} />
          </>
        )}
        {!locPerm?.granted && !USE_MOCK && (
          <>
            <Text style={{ fontWeight: '600', marginTop: 8 }}>Location permission is required.</Text>
            <Button title="Allow location" onPress={requestLocPerm} />
          </>
        )}
      </View>
    );

  if (!hasSession)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 }}>
        <Text style={{ textAlign: 'center', marginBottom: 8, fontWeight: '600' }}>Please sign in to scan.</Text>
        <Button title="Go to Profile" onPress={() => nav.navigate('Tabs')} />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      {isActive && (
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => handleScan(data)}
        />
      )}

      {/* Top help */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + 16,
          left: 16,
          right: 16,
        }}
      >
        <Text style={{ color: 'white', fontSize: 20, fontWeight: '800' }}>Point at the QR on your table</Text>
        <Text style={{ color: '#ddd', marginTop: 6 }}>We’ll start your discount automatically</Text>
      </View>

      {/* Processing overlay */}
      {processing && isActive && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.25)',
          }}
        >
          <ActivityIndicator />
          <Text style={{ color: 'white', marginTop: 8 }}>Starting your discount…</Text>
        </View>
      )}

      {/* Bottom banner */}
      {banner && (
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: insets.bottom + 16,
            backgroundColor: banner.kind === 'ok' ? '#16a34a' : '#dc2626',
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>{banner.msg}</Text>
          <View style={{ marginTop: 8, alignSelf: 'center', flexDirection: 'row', gap: 12 }}>
            <Pressable onPress={() => setBanner(null)} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: 'white', fontWeight: '600', textDecorationLine: 'underline' }}>Scan again</Text>
            </Pressable>
            {banner.cta && (
              <Pressable onPress={banner.cta.onPress} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: 'white', fontWeight: '600', textDecorationLine: 'underline' }}>
                  {banner.cta.label}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}