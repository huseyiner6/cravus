// src/lib/supabase/river.ts
import { supabase } from './client';

export type RiverSession = {
  id: string;
  venue_id: string;
  title: string | null;
  starts_at: string;
  duration_min: number | null;
  seats_total: number | null;
  seats_left: number | null;
  price: number | null;
  intent: 'singles' | 'friends' | null;
  venue?: { id: string; name: string } | null;
};

export async function fetchRiverSessions(): Promise<RiverSession[]> {
  try {
    const { data, error } = await supabase
      .from('river_sessions')
      .select('id, venue_id, title, starts_at, duration_min, seats_total, seats_left, price, intent, venue:venues(id,name)')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as any;
  } catch (e: any) {
    // if table doesn't exist in v0.1, fail safe
    if (e?.message?.includes('relation') || e?.code === 'PGRST205') return [];
    throw e;
  }
}

export async function fetchRiverSession(sessionId: string): Promise<RiverSession | null> {
  try {
    const { data, error } = await supabase
      .from('river_sessions')
      .select('id, venue_id, title, starts_at, duration_min, seats_total, seats_left, price, intent, venue:venues(id,name)')
      .eq('id', sessionId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as any;
  } catch (e: any) {
    if (e?.message?.includes('relation') || e?.code === 'PGRST205') return null;
    throw e;
  }
}