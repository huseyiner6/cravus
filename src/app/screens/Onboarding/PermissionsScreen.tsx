// src/app/screens/Onboarding/PermissionsScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

const USE_MOCK = (process.env.EXPO_PUBLIC_DEBUG_MOCK_LOCATION ?? '') === '1';

export default function PermissionsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [locPerm, requestLocPerm] = Location.useForegroundPermissions();
  const [checking, setChecking] = useState(false);

  // İlk render'da mevcut izinleri getir
  useEffect(() => {
    if (!camPerm) requestCamPerm();
    if (!locPerm) requestLocPerm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canContinue = useMemo(() => {
    const cameraOk = !!camPerm?.granted;
    const locOk = USE_MOCK ? true : !!locPerm?.granted;
    return cameraOk && locOk;
  }, [camPerm?.granted, locPerm?.granted]);

  const openSettings = () => Linking.openSettings();

  const onContinue = async () => {
    if (!canContinue || checking) return;
    setChecking(true);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Ana akışa geç
      navigation.replace('Tabs'); // projendeki root route'a göre ayarla
    } finally {
      setChecking(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 16,
        paddingHorizontal: 16,
        gap: 16,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: '800' }}>Let’s set things up</Text>
      <Text style={{ color: '#6b7280' }}>
        We need camera to scan the QR and location to confirm you’re at the venue.
      </Text>

      <View style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
        <Text style={{ fontWeight: '700' }}>Camera</Text>
        <Text style={{ color: '#6b7280', marginTop: 6 }}>
          Used only to scan the QR at your table.
        </Text>
        <Pressable
          onPress={() => requestCamPerm()}
          style={{ marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>
            {camPerm?.granted ? 'Granted ✓' : 'Allow camera'}
          </Text>
        </Pressable>
        {!!camPerm && camPerm.status === 'denied' && (
          <Pressable onPress={openSettings} style={{ marginTop: 8 }}>
            <Text style={{ color: '#2563eb', fontWeight: '600', textDecorationLine: 'underline' }}>
              Open Settings
            </Text>
          </Pressable>
        )}
      </View>

      <View style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
        <Text style={{ fontWeight: '700' }}>Location</Text>
        <Text style={{ color: '#6b7280', marginTop: 6 }}>
          Checked once to confirm you’re within ~75 m of the venue.
        </Text>
        <Pressable
          onPress={() => requestLocPerm()}
          style={{ marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>
            {USE_MOCK ? 'Mock enabled' : locPerm?.granted ? 'Granted ✓' : 'Allow location'}
          </Text>
        </Pressable>
        {!!locPerm && locPerm.status === 'denied' && !USE_MOCK && (
          <Pressable onPress={openSettings} style={{ marginTop: 8 }}>
            <Text style={{ color: '#2563eb', fontWeight: '600', textDecorationLine: 'underline' }}>
              Open Settings
            </Text>
          </Pressable>
        )}
      </View>

      <Pressable
        disabled={!canContinue || checking}
        onPress={onContinue}
        style={{
          marginTop: 12,
          backgroundColor: canContinue ? '#16a34a' : '#9ca3af',
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
          opacity: checking ? 0.8 : 1,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>Continue</Text>
      </Pressable>

      {USE_MOCK && (
        <Text style={{ color: '#6b7280', marginTop: 8 }}>
          Mock location is enabled (EXPO_PUBLIC_DEBUG_MOCK_LOCATION=1).
        </Text>
      )}
    </View>
  );
}