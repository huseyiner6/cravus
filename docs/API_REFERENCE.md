# API Reference (Examples)

POST /edge/checkin
- Auth: JWT (Supabase)
- Body: { user_id, venue_id, qr_token }
- Res: { ok: true, discount_applied: number }

GET /edge/deals?lat=..&lng=..
- Returns dynamic discount windows near user.

(Placeholder implementations; real secrets in private repo.)
