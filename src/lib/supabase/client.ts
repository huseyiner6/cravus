// src/lib/supabase/client.ts
import 'react-native-url-polyfill/auto'; // URL/crypto polyfills for RN/Expo
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Ortak kullanmak için dışa açıyoruz (Edge Function fetch vs.) */
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env'
  );
}

/**
 * Expo / React Native önerilen auth ayarları:
 * - storage: AsyncStorage → kalıcı oturum
 * - flowType: 'pkce' → mobil için güvenli akış
 * - detectSessionInUrl: false → Expo Go’da URL yakalamaya gerek yok
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: AsyncStorage,
    flowType: 'pkce',
  },
});

/** Kullanışlı yardımcılar */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

/**
 * Edge Function çağrıları için küçük bir yardımcı.
 * Non-2xx olursa response'u aynen döndürür, çağıran parse eder.
 *
 * Örnek:
 *   const res = await edgeFetch('checkin-create', { venue_id, window_id, method: 'qr' });
 *   const json = await res.json();
 */
export async function edgeFetch(
  functionName: string,
  body?: unknown,
  init?: RequestInit
): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...init,
  });
}