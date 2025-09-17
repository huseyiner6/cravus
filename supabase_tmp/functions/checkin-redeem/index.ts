// supabase/functions/checkin-redeem/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const body = await req.json();
  const { checkin_id, otp_code } = body ?? {};
  if (!checkin_id || !otp_code) return new Response(JSON.stringify({ error: "checkin_id and otp_code required" }), { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch checkin
  const { data: chk, error: chke } = await supabase.from("checkins")
    .select("*").eq("id", checkin_id).single();
  if (chke || !chk) return new Response(JSON.stringify({ error: "CHECKIN_NOT_FOUND" }), { status: 404 });

  const now = new Date();
  if (chk.status === "redeemed") {
    return new Response(JSON.stringify({ error: "ALREADY_REDEEMED" }), { status: 409 });
  }
  if (new Date(chk.otp_expires_at) < now) {
    return new Response(JSON.stringify({ error: "OTP_EXPIRED" }), { status: 410 });
  }
  if (String(chk.otp_code) !== String(otp_code)) {
    return new Response(JSON.stringify({ error: "OTP_INVALID" }), { status: 400 });
  }

  const { data: updated, error: uErr } = await supabase
    .from("checkins")
    .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
    .eq("id", checkin_id)
    .select()
    .single();

  if (uErr) return new Response(JSON.stringify({ error: uErr.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true, checkin: updated }), { headers: { "Content-Type": "application/json" } });
});
