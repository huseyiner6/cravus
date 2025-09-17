// src/app/screens/River/RiverSessionDetailScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Alert, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@/app/navigation/RootStack';
import { fetchRiverSession } from '@/lib/supabase/river';

type R = RouteProp<RootStackParamList, 'RiverSession'>;

export default function RiverSessionDetailScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { params } = useRoute<R>();
  const [loading, setLoading] = useState(true);
  const [sess, setSess] = useState<Awaited<ReturnType<typeof fetchRiverSession>>>(null);

  useEffect(() => {
    (async () => {
      try { setSess(await fetchRiverSession(params.sessionId)); }
      catch (e:any) { Alert.alert('Error', e?.message ?? 'Failed'); }
      finally { setLoading(false); }
    })();
  }, [params.sessionId]);

  if (loading) return <View style={{flex:1,alignItems:'center',justifyContent:'center',paddingTop:insets.top}}><Text>Loading…</Text></View>;
  if (!sess) return <View style={{flex:1,alignItems:'center',justifyContent:'center',paddingTop:insets.top}}><Text>Not found</Text></View>;

  return (
    <View style={{ flex:1, paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
      <Text style={{ fontSize: 20, fontWeight:'800' }}>{sess.title ?? 'River session'}</Text>
      <Text style={{ color:'#555', marginTop: 6 }}>
        {sess.venue?.name ?? 'Venue'} · {new Date(sess.starts_at).toLocaleString()}
      </Text>
      <Text style={{ color:'#777', marginTop: 6 }}>
        Seats {sess.seats_left ?? '-'} / {sess.seats_total ?? '-'} · {sess.intent ?? '-'}
      </Text>

      <Pressable
        onPress={() => Alert.alert('Join', 'Ticketing arrives in Sprint-3.')}
        style={{ marginTop: 24, backgroundColor:'#1A4263', paddingVertical: 14, borderRadius: 12, alignItems:'center' }}
      >
        <Text style={{ color:'#fff', fontWeight:'700' }}>Join</Text>
      </Pressable>
    </View>
  );
}