// src/lib/supabase/deals.ts
import { supabase } from './client';

export type DealWindow = {
  id: string;
  venue_id: string;
  discount_pct: number;
  starts_at: string;
  ends_at: string;
  venue: { id: string; name: string; rules?:any | null };
};

// PostgREST bazen 1-1 join’i array gibi döndürebiliyor; normalize edelim.
type RawVenue = { id: string; name: string } | { id: string; name: string }[] | null | undefined;
type RawDealRow = {
  id: string;
  venue_id: string;
  discount_pct: number;
  starts_at: string;
  ends_at: string;
  venue?: RawVenue;
};

function normalizeVenue(v: RawVenue): { id: string; name: string } | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : (v as any);
}

function toDealWindow(
  r: RawDealRow,
  byVenueId: Record<string, { id: string; name: string }>
): DealWindow {
  const v = normalizeVenue(r.venue) ?? byVenueId[r.venue_id] ?? { id: r.venue_id, name: 'Venue' };
  return {
    id: r.id,
    venue_id: r.venue_id,
    discount_pct: r.discount_pct,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    venue: v,
  };
}

/**
 * Şu an aktif olan pencereleri döndürür.
 * - FK’yi açıkça hedefler: venues!deal_windows_venue_id_fkey
 * - Venue gelmezse (RLS/ilişki glitch) ikinci sorguyla tamamlar.
 */
export async function fetchActiveWindows(): Promise<DealWindow[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('deal_windows')
    .select(
      // FK ismini açıkça hedeflemek çoğu “array döndü” sorununu yok eder
      'id, venue_id, discount_pct, starts_at, ends_at, venue:venues!deal_windows_venue_id_fkey(id,name)'
    )
    .lte('starts_at', now)
    .gte('ends_at', now)
    .order('starts_at', { ascending: true })
    .returns<RawDealRow[]>();

  if (error) throw error;
  const rows = (data ?? []);

  // Venue’sü eksik kalan satırlar için ikinci bir lookup yap
  const missingVenueIds = [
    ...new Set(rows.filter(r => !normalizeVenue(r.venue)).map(r => r.venue_id)),
  ];
  let byId: Record<string, { id: string; name: string }> = {};
  if (missingVenueIds.length) {
    const { data: vRows, error: vErr } = await supabase
      .from('venues')
      .select('id, name')
      .in('id', missingVenueIds);
    if (vErr) throw vErr;
    byId = Object.fromEntries((vRows ?? []).map(v => [v.id, { id: v.id, name: v.name }]));
  }

  return rows.map(r => toDealWindow(r, byId));
}

/** Tek pencere detayını getirir (venue fallback aynı mantık). */
export async function fetchDealDetails(windowId: string): Promise<DealWindow | null> {
  const { data, error } = await supabase
    .from('deal_windows')
    .select(
      'id, venue_id, discount_pct, starts_at, ends_at, venue:venues!deal_windows_venue_id_fkey(id,name,rules)'
    )
    .eq('id', windowId)
    .maybeSingle()
    .returns<RawDealRow | null>();

  if (error) throw error;
  if (!data) return null;

  let vNorm = normalizeVenue(data.venue);
  if (!vNorm) {
    const { data: v, error: vErr } = await supabase
      .from('venues')
      .select('id, name')
      .eq('id', data.venue_id)
      .maybeSingle();
    if (vErr) throw vErr;
    vNorm = v ? { id: v.id, name: v.name } : { id: data.venue_id, name: 'Venue' };
  }
  return {
    id: data.id,
    venue_id: data.venue_id,
    discount_pct: data.discount_pct,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    venue: vNorm,
  };
}

export function isWindowActive(starts_at: string, ends_at: string): boolean {
  const now = Date.now();
  return new Date(starts_at).getTime() <= now && now <= new Date(ends_at).getTime();
}

export function secondsLeft(ends_at: string): number {
  return Math.max(0, Math.floor((new Date(ends_at).getTime() - Date.now()) / 1000));
}