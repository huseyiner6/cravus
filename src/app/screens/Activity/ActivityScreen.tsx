// src/app/screens/Activity/ActivityScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listMyCheckins } from '@/lib/supabase/checkin';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const r = await listMyCheckins();
      setRows(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // İlk yüklemede ve ekrana her odaklanıldığında check‑in listesini yenile
  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
      <Text style={{ fontWeight: '800', fontSize: 22, marginBottom: 12 }}>Activity</Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: '#666' }}>Loading…</Text>
        </View>
      ) : rows.length === 0 ? (
        <Text style={{ color: '#666' }}>No activity yet.</Text>
      ) : (
        rows.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => {
              // Navigate using window_id from view
              if (r.window_id) {
                nav.navigate('DealDetails', { windowId: r.window_id });
              }
            }}
            style={{
              padding: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#eee',
              backgroundColor: 'white',
              marginBottom: 12,
            }}
          >
            <Text style={{ fontWeight: '700' }}>
              {r.venue_name ?? 'Venue'} — {r.discount_pct ?? 0}%
            </Text>
            <Text style={{ color: '#666', marginTop: 2 }}>
              {new Date(r.created_at).toLocaleString()}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}