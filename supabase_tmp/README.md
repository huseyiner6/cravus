
# Cravus — Supabase Bootstrap (v0.1 Membership-only)

This package sets up the **membership-only** MVP backend:
- Auth `profiles` with free check-in counter
- `subscriptions` (free/regular/pro) single-row per user
- Public `venues` and `deal_windows`
- `checkins` with OTP (TTL 5m), decrement free quota on redeem
- RLS policies (public read for discovery; user-owned read elsewhere)
- RPC: `can_checkin(user_id)`
- Edge Functions (stubs): `iap-validate`, `checkin-create`, `checkin-redeem`

## 1) Apply DB schema
```bash
supabase start  # if not running
supabase db reset  # or: supabase db push
```

## 2) Seed sample data (optional)
Use SQL editor or `psql`:
```sql
insert into venues (name, geo, cuisine) values
('Sunset Bagels', ST_GeogFromText('SRID=4326;POINT(-77.0423 38.9072)'), 'Bakery');

insert into deal_windows (venue_id, starts_at, ends_at, discount_pct) values
((select id from venues where name='Sunset Bagels'),
 now() + interval '1 hour', now() + interval '3 hour', 25);
```

## 3) Deploy Edge Functions
```bash
# Copy 'functions/*' to your Supabase project
supabase functions deploy iap-validate
supabase functions deploy checkin-create
supabase functions deploy checkin-redeem
```

### Set required env vars for functions
In Supabase dashboard → Functions → Settings → Env vars:
- `SUPABASE_URL` = your project URL
- `SUPABASE_SERVICE_ROLE_KEY` = service role key

(For iap-validate PROD: add App Store / Play credentials and implement real validation.)

## 4) Client calls (examples)
### Create check-in
```http
POST /functions/v1/checkin-create
Authorization: Bearer <user_jwt>
{ "venue_id":"...", "window_id":"...", "method":"qr" }
```

### Redeem (host/server)
```http
POST /functions/v1/checkin-redeem
Authorization: Bearer <service_jwt or server>
{ "checkin_id":"...", "otp_code":"1234" }
```

### Set subscription (DEV stub)
```http
POST /functions/v1/iap-validate
Authorization: Bearer <user_jwt>
{ "platform":"ios", "tier":"regular" }
```

## Notes
- Direct INSERT/UPDATE on `checkins` is blocked by RLS; use the functions above.
- Discovery tables (`venues`, `deal_windows`) are public-read for map listing.
- Free users have **3** total check-ins; 4th attempt must go through the paywall.
