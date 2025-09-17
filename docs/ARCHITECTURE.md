# Architecture

Mobile (Expo RN) → Supabase (Auth, Postgres, RLS, Realtime) → Edge Functions
Automations via n8n (webhooks, schedulers). Anon key only on client; service role stays private.
