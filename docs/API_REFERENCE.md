# API Reference (Examples)

POST /edge/checkin
- Auth: Supabase JWT
- Body: { user_id, venue_id, qr_token }
- Res: { ok: true, discount_applied: number }

GET /edge/deals?lat=..&lng=..
- Returns dynamic discount windows near the user.

(Placeholder implementations; real secrets remain private.)
