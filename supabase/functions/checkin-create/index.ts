// supabase/functions/checkin-create/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BASE_URL, ANON_KEY, CFG } from '../_shared/env.ts';

type ReqBody = {
  venue_id: string;
  window_id?: string;               // opsiyonel (host stand tek QR)
  method: 'qr' | 'gps';
  lat?: number;
  lng?: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  try {
    if (!BASE_URL || !ANON_KEY) return json({ error: 'missing_env' }, 500);

    // RLS altında çağıranın JWT’si ile client
    const supabase = createClient(BASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    // ---- Auth
    const { data: au, error: auErr } = await supabase.auth.getUser();
    if (auErr || !au?.user) return json({ error: 'not_authenticated' }, 401);
    const userId = au.user.id;

    // ---- Body
    let body: ReqBody;
    try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
    const { venue_id, window_id, method, lat, lng } = body;
    if (!venue_id || method !== 'qr') return json({ error: 'invalid_input' }, 400);

    const nowIso = new Date().toISOString();

    // ---- Aktif window seçimi
    let activeWindowId: string | null = window_id ?? null;

    if (!activeWindowId) {
      const q = await supabase
        .from('deal_windows')
        .select('id, venue_id, starts_at, ends_at')
        .eq('venue_id', venue_id)
        .lte('starts_at', nowIso)
        .gte('ends_at', nowIso)
        .order('ends_at', { ascending: true }) // earliest-end öne
        .limit(5);

      if (q.error) return json({ error: q.error.message }, 500);
      const rows = q.data ?? [];

      if (rows.length === 0) return json({ error: 'window_inactive' }, 403);
      if (rows.length > 1 && CFG.REQUIRE_SINGLE_ACTIVE) {
        return json({ error: 'multiple_active_windows' }, 409);
      }
      // Politika: en erken bitecek olanı seç (config ile kapatılabilir)
      activeWindowId = (CFG.SELECT_EARLIEST_END ? rows[0] : rows[rows.length - 1]).id;
    } else {
      // window_id verildiyse doğrula (aktif ve venue eşleşmesi)
      const win = await supabase
        .from('deal_windows')
        .select('id, venue_id, starts_at, ends_at')
        .eq('id', activeWindowId)
        .lte('starts_at', nowIso)
        .gte('ends_at', nowIso)
        .maybeSingle();
      if (win.error) return json({ error: win.error.message }, 500);
      if (!win.data) return json({ error: 'window_inactive' }, 403);
      if (win.data.venue_id !== venue_id) return json({ error: 'window_mismatch' }, 403);
    }

    // ---- Geofence
    if (lat == null || lng == null) return json({ error: 'location_required' }, 403);

    const within = await supabase.rpc('is_within_venue', {
      p_venue_id: venue_id,
      p_lat: lat,
      p_lng: lng,
      p_meters: CFG.DISTANCE_METERS,
    });
    if (within.error) return json({ error: within.error.message }, 500);

    if (!within.data) {
      const dist = await supabase.rpc('distance_to_venue', {
        p_venue_id: venue_id, p_lat: lat, p_lng: lng,
      });
      if (CFG.LOG_DEBUG) {
        console.log('geo debug', {
          userId, venue_id, lat, lng,
          meters: dist.data ?? null, threshold: CFG.DISTANCE_METERS,
        });
      }
      return json({
        error: 'not_at_venue',
        meters: dist.data ?? null,
        threshold: CFG.DISTANCE_METERS,
      }, 403);
    }

    // ---- Zaten aktif check-in varsa onu döndür
    const active = await supabase
      .from('checkins')
      .select('id, otp_code, otp_expires_at, window_id')
      .eq('user_id', userId)
      .is('redeemed_at', null)
      .eq('status', 'started')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (active.data) return json({ already_active: true, checkin: active.data });

    // ---- Global cooldown
    if (CFG.COOLDOWN_MIN > 0) {
      const since = new Date(Date.now() - CFG.COOLDOWN_MIN * 60 * 1000).toISOString();
      const recent = await supabase
        .from('checkins')
        .select('id, created_at')
        .eq('user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);
      if (recent.error) return json({ error: recent.error.message }, 500);
      if (recent.data && recent.data.length) {
        const last = recent.data[0];
        const until = new Date(new Date(last.created_at).getTime() + CFG.COOLDOWN_MIN * 60 * 1000).toISOString();
        return json({ error: 'cooldown_active', minutes: CFG.COOLDOWN_MIN, until }, 403);
      }
    }

    // ---- Üyelik (view → fallback)
    let effectiveTier: 'free' | 'regular' | 'pro' = 'free';
    const mem = await supabase
      .from('user_membership_view')
      .select('effective_tier')
      .eq('user_id', userId)
      .maybeSingle();
    if (!mem.error && mem.data?.effective_tier) {
      effectiveTier = mem.data.effective_tier as any;
    } else {
      const sub = await supabase
        .from('subscriptions')
        .select('tier, status, renews_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (!sub.error && sub.data?.status === 'active') {
        effectiveTier = (sub.data.tier as any) ?? 'free';
      }
    }
    if (CFG.LOG_DEBUG) console.log('membership', { userId, effectiveTier });

    if (effectiveTier === 'free' && CFG.FREE_LIMIT > 0) {
      const redeemed = await supabase
        .from('checkins')
        .select('id', { head: true, count: 'exact' })
        .eq('user_id', userId)
        .not('redeemed_at', 'is', null);
      if (redeemed.error) return json({ error: redeemed.error.message }, 500);
      if ((redeemed.count ?? 0) >= CFG.FREE_LIMIT) {
        return json({ error: 'free_limit_reached', next: 'upgrade' }, 403);
      }
    }

    // ---- OTP üret ve kayıt (yarışa dayanıklı)
    const base = Math.pow(10, Math.max(1, CFG.OTP_DIGITS - 1));
    const top  = Math.pow(10, CFG.OTP_DIGITS) - 1;
    const otp = String(Math.floor(base + Math.random() * (top - base)));
    const expiresAt = new Date(Date.now() + CFG.OTP_MINUTES * 60 * 1000).toISOString();

    const ins = await supabase
      .from('checkins')
      .upsert(
        {
          user_id: userId,
          venue_id,
          window_id: activeWindowId!,
          method: 'qr',
          otp_code: otp,
          otp_expires_at: expiresAt,
          status: 'started',
        },
        { onConflict: 'user_id,window_id', ignoreDuplicates: true }
      )
      .select('id, otp_code, otp_expires_at, window_id')
      .maybeSingle();

    let row = ins.data;
    if (!row) {
      const ex = await supabase
        .from('checkins')
        .select('id, otp_code, otp_expires_at, window_id')
        .eq('user_id', userId)
        .eq('window_id', activeWindowId!)
        .is('redeemed_at', null)
        .order('created_at', { ascending: false })
        .maybeSingle();
      if (ex.error) return json({ error: ex.error.message }, 500);
      row = ex.data ?? null;
    }

    if (ins.error) return json({ error: ins.error.message }, 500);
    if (!row) return json({ error: 'insert_failed' }, 500);

    return json({ checkin: row });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? 'server_error' }, 500);
  }
});