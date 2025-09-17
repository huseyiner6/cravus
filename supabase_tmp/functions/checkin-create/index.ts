// supabase/functions/checkin-create/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function randomOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const body = await req.json();
  const { venue_id, window_id, method } = body ?? {};
  if (!venue_id || !window_id || !method) {
    return new Response(JSON.stringify({ error: "venue_id, window_id, method required" }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  const { data: auth, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !auth?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  const user_id = auth.user.id;

  // Membership gating
  const { data: can, error: canErr } = await supabase.rpc("can_checkin", { target_user: user_id });
  if (canErr) return new Response(JSON.stringify({ error: canErr.message }), { status: 500 });
  if (!can) return new Response(JSON.stringify({ error: "paywall", code: "NEEDS_MEMBERSHIP" }), { status: 402 });

  // Validate window time
  const { data: window, error: wErr } = await supabase
    .from("deal_windows")
    .select("id, starts_at, ends_at, venue_id")
    .eq("id", window_id)
    .single();
  if (wErr || !window) return new Response(JSON.stringify({ error: "Invalid window" }), { status: 400 });

  const now = new Date();
  const starts = new Date(window.starts_at);
  const ends = new Date(window.ends_at);
  if (now < starts || now > ends) {
    return new Response(JSON.stringify({ error: "WINDOW_CLOSED" }), { status: 409 });
  }

  // Unique per (user, window)
  // Generate OTP (TTL 5 minutes)
  const otp_code = randomOtp();
  const otp_expires_at = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  const { data: existing } = await supabase
    .from("checkins")
    .select("id").eq("user_id", user_id).eq("window_id", window_id).maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ error: "ALREADY_CHECKED_IN" }), { status: 409 });
  }

  const { data: created, error: cErr } = await supabase
    .from("checkins")
    .insert({
      user_id, venue_id, window_id,
      method, otp_code, otp_expires_at, status: "started"
    })
    .select()
    .single();

  if (cErr) return new Response(JSON.stringify({ error: cErr.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true, checkin: created }), { headers: { "Content-Type": "application/json" } });
});
