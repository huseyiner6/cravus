# Architecture

Mobile (Expo RN) → Supabase (Auth, Postgres, RLS, Realtime) → Edge Functions
Automations via n8n (webhooks, schedulers). Client uses anon key; service role stays private.
