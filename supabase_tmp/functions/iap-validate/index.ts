// supabase/functions/iap-validate/index.ts
// DEV STUB: Replace with real App Store / Play API validation in prod.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const { platform, tier, status, renews_at, receipt_ref } = await req.json();
  if (!platform || !tier) {
    return new Response(JSON.stringify({ error: "platform and tier required" }), { status: 400 });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  const { data: user, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !user?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const user_id = user.user.id;

  // Upsert single-row subscription per user
  const { data, error } = await supabase.from("subscriptions").upsert({
    user_id,
    tier,
    platform,
    status: status ?? "active",
    renews_at: renews_at ?? null,
    receipt_ref: receipt_ref ?? null,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id" }).select();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true, subscription: data?.[0] ?? null }), { headers: { "Content-Type": "application/json" } });
});
