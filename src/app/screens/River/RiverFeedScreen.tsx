// src/app/screens/River/RiverFeedScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchRiverSessions, RiverSession } from '@/lib/supabase/river';
import { useNavigation } from '@react-navigation/native';

export default function RiverFeedScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const [items, setItems] = useState<RiverSession[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await fetchRiverSessions()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <View style={{ flex:1, paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>River</Text>
      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        ListEmptyComponent={<Text style={{ color:'#666', marginTop: 24 }}>
          {loading ? 'Loading…' : 'No sessions yet.'}
        </Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => nav.navigate('RiverSession', { sessionId: item.id })}
            style={{ padding: 12, borderWidth:1, borderColor:'#eee', borderRadius: 12, marginBottom: 12 }}
          >
            <Text style={{ fontWeight:'700' }}>{item.title ?? 'Session'}</Text>
            <Text style={{ color:'#555' }}>
              {item.venue?.name ?? 'Venue'} · {new Date(item.starts_at).toLocaleString()}
            </Text>
            <Text style={{ color:'#777', marginTop: 4 }}>
              Seats: {item.seats_left ?? '-'} / {item.seats_total ?? '-'} · {item.intent ?? '-'}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}