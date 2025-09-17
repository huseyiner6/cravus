// src/app/screens/DealDetails/DealDetailsScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/app/navigation/RootStack';

import { fetchDealDetails, isWindowActive, secondsLeft, DealWindow } from '@/lib/supabase/deals';
import { canStartCheckinLocal } from '@/lib/supabase/membership';
import { getCoordsFresh, distanceToVenueMeters } from '@/lib/supabase/geo';

type RouteParams = { windowId: string };

function fmtTimeRange(starts_at: string, ends_at: string) {
  const s = new Date(starts_at);
  const e = new Date(ends_at);
  const sameDay = s.toDateString() === e.toDateString();
  const dateStr = s.toLocaleDateString();
  const sT = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const eT = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `${dateStr} · ${sT}–${eT}` : `${s.toLocaleString()} – ${e.toLocaleString()}`;
}

function useTick(sec: number, enabled: boolean) {
  const [n, setN] = useState(sec);
  const ref = useRef<any>(null);
  useEffect(() => {
    if (!enabled) return;
    ref.current = setInterval(() => setN((x) => (x > 0 ? x - 1 : 0)), 1000);
    return () => clearInterval(ref.current);
  }, [enabled]);
  return n;
}

function Countdown({ ends_at }: { ends_at: string }) {
  const initial = secondsLeft(ends_at);
  const remain = useTick(initial, initial > 0);
  const mm = String(Math.floor(remain / 60)).padStart(2, '0');
  const ss = String(remain % 60).padStart(2, '0');
  return <Text style={{ color: '#16a34a', fontWeight: '700' }}>Ends in {mm}:{ss}</Text>;
}

function Rules({ rules }: { rules: any }) {
  if (rules == null) return null;

  // Dönüş tipine göre esnek render
  if (Array.isArray(rules)) {
    return (
      <View style={{ marginTop: 8 }}>
        {rules.map((it, idx) => (
          <Text key={idx} style={{ color: '#374151', marginTop: idx ? 4 : 0 }}>
            • {typeof it === 'string' ? it : JSON.stringify(it)}
          </Text>
        ))}
      </View>
    );
  }
  if (typeof rules === 'object') {
    const entries = Object.entries(rules);
    if (!entries.length) return null;
    return (
      <View style={{ marginTop: 8 }}>
        {entries.map(([k, v], idx) => (
          <Text key={k} style={{ color: '#374151', marginTop: idx ? 4 : 0 }}>
            • {k}: {typeof v === 'string' ? v : JSON.stringify(v)}
          </Text>
        ))}
      </View>
    );
  }
  // string / number vs.
  return <Text style={{ color: '#374151', marginTop: 8 }}>{String(rules)}</Text>;
}

export default function DealDetailsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute() as { params: RouteParams };

  const [row, setRow] = useState<DealWindow | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean>(true);
  const [distanceM, setDistanceM] = useState<number | null>(null);

  const active = useMemo(() => (row ? isWindowActive(row.starts_at, row.ends_at) : false), [row]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, ok] = await Promise.all([
        fetchDealDetails(params.windowId),
        canStartCheckinLocal().catch(() => false),
      ]);
      setRow(d);
      setAllowed(!!ok);

      // Mesafe (izne bağlı)
      if (d?.venue?.id) {
        try {
          const coords = await getCoordsFresh().catch(() => null);
          if (coords) {
            const meters = await distanceToVenueMeters(d.venue.id, coords).catch(() => null);
            if (meters != null) setDistanceM(Math.round(meters));
          }
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  }, [params.windowId]);

  useEffect(() => {
    load();
  }, [load]);

  const startCheckin = useCallback(() => {
    if (!row) return;
    if (!allowed) {
      nav.navigate('Paywall');
      return;
    }
    const parent = (nav as any).getParent?.();
    if (parent) {
      parent.navigate('Tabs', {
        screen: 'Checkin',
        params: { expectedVenueId: row.venue.id, expectedWindowId: row.id },
      });
    } else {
      nav.navigate('Checkin', { expectedVenueId: row.venue.id, expectedWindowId: row.id });
    }
  }, [nav, row, allowed]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
        <Text style={{ color: '#6b7280', marginTop: 8 }}>Loading deal…</Text>
      </View>
    );
  }

  if (!row) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontWeight: '700' }}>Deal not found</Text>
        <Text style={{ color: '#6b7280', marginTop: 6 }}>It may have ended or been removed.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      style={{ flex: 1, backgroundColor: 'white' }}
    >
      {/* Header */}
      <Text style={{ fontSize: 22, fontWeight: '800' }}>{row.venue.name}</Text>
      <Text style={{ color: '#10b981', fontWeight: '800', marginTop: 4 }}>{row.discount_pct}% OFF</Text>

      {/* Zaman ve durum */}
      <View style={{ marginTop: 8 }}>
        <Text style={{ color: '#111827' }}>{fmtTimeRange(row.starts_at, row.ends_at)}</Text>
        {active ? (
          <View style={{ marginTop: 6 }}>
            <Text style={{ color: '#059669', fontWeight: '700' }}>Active now</Text>
            <Countdown ends_at={row.ends_at} />
          </View>
        ) : (
          <Text style={{ color: '#6b7280', marginTop: 6 }}>Not active right now</Text>
        )}
        {distanceM != null && (
          <Text style={{ color: '#6b7280', marginTop: 6 }}>~{distanceM} m away</Text>
        )}
      </View>

      {/* Kurallar */}
      {!!row.venue?.rules && (
        <View style={{ marginTop: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ fontWeight: '800', marginBottom: 6 }}>How it works</Text>
          <Rules rules={row.venue.rules} />
        </View>
      )}

      {/* CTA */}
      <Pressable
        onPress={startCheckin}
        disabled={!allowed || !active}
        style={{
          marginTop: 18,
          backgroundColor: !allowed ? '#1A4263' : active ? '#38BF7D' : '#9ca3af',
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
          opacity: !allowed || !active ? 0.9 : 1,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '800' }}>
          {!allowed ? 'Go Pro' : active ? 'Start check-in' : 'Not active'}
        </Text>
      </Pressable>

      {/* Secondary */}
      <Pressable
        onPress={load}
        style={{
          marginTop: 10,
          borderWidth: 1,
          borderColor: '#e5e7eb',
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontWeight: '600' }}>Refresh details</Text>
      </Pressable>
    </ScrollView>
  );
}