// src/lib/supabase/checkin.ts
import { supabase } from './client';

export type CreateCheckinInput = {
  venue_id: string;
  window_id: string;
  method: 'qr' | 'gps';
  lat?: number;
  lng?: number;
};

export type CheckinShort = {
  id: string;
  otp_code: string | null;
  otp_expires_at: string | null;
  window_id: string;
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

async function callFunction<T>(name: string, body: any): Promise<T> {
  // Kullanıcı JWT'si
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    const e: any = new Error('not_authenticated');
    e.raw = 'not_authenticated';
    throw e;
  }

  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY, // Supabase Functions bunu bekliyor
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await resp.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // text ise json null kalsın
  }

  if (!resp.ok) {
    const raw = (json && (json.error || json.message)) || text || 'Edge Function error';
    const err: any = new Error(raw);
    err.raw = raw;
    err.status = resp.status;
    throw err;
  }

  // Başarılı cevap
  return (json ?? ({} as any)) as T;
}

export async function createCheckin(input: CreateCheckinInput): Promise<CheckinShort> {
  const payload: any = await callFunction('checkin-create', input);

  if (payload?.error) {
    const err: any = new Error(payload.error);
    err.raw = payload.error;
    throw err;
  }

  // already_active yanıtı → checkin objesini döndür
  if (payload?.already_active && payload?.checkin) {
    return payload.checkin as CheckinShort;
  }

  return (payload?.checkin ?? payload) as CheckinShort;
}

export async function redeemCheckin(checkin_id: string) {
  const payload: any = await callFunction('checkin-redeem', { checkin_id });

  if (payload?.error) {
    const e: any = new Error(payload.error);
    e.raw = payload.error;
    throw e;
  }
  return payload;
}

export async function listMyCheckins() {
  const { data, error } = await supabase
    .from('checkins_view')
    .select('id, created_at, window_id, venue_name, discount_pct')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}