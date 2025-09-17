// src/app/screens/Map/MapScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { fetchActiveWindows } from '@/lib/supabase/deals';
import { canStartCheckinLocal } from '@/lib/supabase/membership';
import { getCoordsFresh, distanceToVenueMeters } from '@/lib/supabase/geo';

type DealItem = {
  id: string; // window id
  venue: { id: string; name: string };
  discount_pct: number;
  starts_at: string;
  ends_at: string;
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();

  const [deals, setDeals] = useState<DealItem[]>([]);
  const [allowed, setAllowed] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // mesafe state'i: windowId -> metre
  const [distances, setDistances] = useState<Record<string, number | null>>({});
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [rows, ok] = await Promise.all([
        fetchActiveWindows(),
        canStartCheckinLocal().catch(() => false),
      ]);
      setDeals((rows ?? []) as DealItem[]);
      setAllowed(!!ok);
    } finally {
      setLoading(false);
    }
  }, []);

  // İlk yük
  useEffect(() => { load(); }, [load]);

  // Koordinatı bir kez al, kısa süre cache'le
  useEffect(() => {
    (async () => {
      try {
        const c = await getCoordsFresh().catch(() => null);
        if (c) setCoords(c);
      } catch {}
    })();
  }, []);

  // Ekrana dönünce sadece izin/tier kontrolü
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        if (!mounted) return;
        try {
          const ok = await canStartCheckinLocal().catch(() => false);
          setAllowed(!!ok);
        } catch {}
      })();
      return () => { mounted = false; };
    }, [])
  );

  // Mesafeleri hesapla (coords ve deals geldikten sonra)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!coords || !deals.length) return;
      const entries = await Promise.all(
        deals.map(async d => {
          try {
            const m = await distanceToVenueMeters(d.venue.id, coords);
            return [d.id, m != null ? Math.round(m) : null] as const;
          } catch {
            return [d.id, null] as const;
          }
        })
      );
      if (!cancelled) setDistances(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [coords, deals]);

  const openQR = useCallback((expectedVenueId: string, expectedWindowId: string) => {
    if (!allowed) { nav.navigate('Paywall'); return; }

    const parent = nav.getParent?.();
    if (parent) {
      parent.navigate('Tabs', {
        screen: 'Checkin',
        params: { expectedVenueId, expectedWindowId },
      });
      return;
    }
    nav.navigate('Checkin', { expectedVenueId, expectedWindowId });
  }, [allowed, nav]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await fetchActiveWindows();
      setDeals((rows ?? []) as DealItem[]);
      const ok = await canStartCheckinLocal().catch(() => false);
      setAllowed(!!ok);
      // koordinatı da güncelle (opsiyonel)
      const c = await getCoordsFresh().catch(() => null);
      if (c) setCoords(c);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
      <Text style={{ fontWeight: '800', fontSize: 18, marginBottom: 8 }}>Near you · Active windows</Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: '#666' }}>Loading…</Text>
        </View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={(d) => d.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={{ color: '#666', marginTop: 24 }}>No active deals right now.</Text>}
          renderItem={({ item }) => {
            const dist = distances[item.id];
            return (
              <View
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderColor: '#eee',
                  borderRadius: 12,
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontWeight: '700' }}>
                  {item.venue.name} — {item.discount_pct}%
                </Text>
                <Text style={{ color: '#555', marginTop: 2 }}>
                  {new Date(item.starts_at).toLocaleTimeString()}–{new Date(item.ends_at).toLocaleTimeString()}
                </Text>
                {dist != null && (
                  <Text style={{ color: '#6b7280', marginTop: 2 }}>~{dist} m away</Text>
                )}

                {/* Primary: go to QR scanner */}
                <Pressable
                  onPress={() => openQR(item.venue.id, item.id)}
                  style={{
                    marginTop: 12,
                    backgroundColor: allowed ? '#38BF7D' : '#1A4263',
                    opacity: allowed ? 1 : 0.8,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>
                    {allowed ? 'Check in' : 'Go Pro'}
                  </Text>
                </Pressable>

                {/* Secondary: Deal details */}
                <Pressable
                  onPress={() => nav.navigate('DealDetails', { windowId: item.id })}
                  style={{
                    marginTop: 8,
                    borderWidth: 1,
                    borderColor: '#ddd',
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontWeight: '600' }}>View details</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}