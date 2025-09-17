// supabase/functions/checkin-redeem/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BASE_URL, ANON_KEY } from '../_shared/env.ts';

type ReqBody = { checkin_id: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  try {
    if (!BASE_URL || !ANON_KEY) return json({ error: 'missing_env' }, 500);

    const supabase = createClient(BASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    // Auth
    const { data: au, error: auErr } = await supabase.auth.getUser();
    if (auErr || !au?.user) return json({ error: 'not_authenticated' }, 401);
    const userId = au.user.id;

    // Body
    let body: ReqBody;
    try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
    const { checkin_id } = body;
    if (!checkin_id) return json({ error: 'invalid_input' }, 400);

    // Kayıt doğrula (kullanıcıya ait, started & unredeemed)
    const row = await supabase
      .from('checkins')
      .select('id, user_id, status, redeemed_at, otp_expires_at')
      .eq('id', checkin_id)
      .eq('user_id', userId)
      .is('redeemed_at', null)
      .eq('status', 'started')
      .maybeSingle();

    if (row.error) return json({ error: row.error.message }, 500);
    if (!row.data) return json({ error: 'not_found' }, 404);

    // OTP süresi
    if (row.data.otp_expires_at && new Date(row.data.otp_expires_at).getTime() < Date.now()) {
      return json({ error: 'otp_expired' }, 403);
    }

    // Redeem
    const upd = await supabase
      .from('checkins')
      .update({ redeemed_at: new Date().toISOString(), status: 'redeemed' })
      .eq('id', checkin_id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (upd.error) return json({ error: upd.error.message }, 500);
    if (!upd.data) return json({ error: 'update_failed' }, 500);

    return json({ ok: true, id: upd.data.id });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? 'server_error' }, 500);
  }
});