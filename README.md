# Cravus — Off-peak Dining & Social Tables

Cross-platform app (Expo React Native + Supabase + n8n) enabling dynamic off-peak discounts and micro social dining events.

## Tech
- Mobile: Expo/React Native (TS)
- Backend: Supabase Postgres + RLS, Edge Functions
- Automations: n8n
- Infra: GitHub Actions (lint/test), Docker dev utils

## Quickstart
1) Copy \`.env.example\` to \`.env\` and fill placeholders.
2) \`cd apps/mobile && npm i && npx expo start\`
3) Supabase schema: \`db/schema.sql\`
4) Example n8n flows: \`automations/n8n_flows/\` (secrets redacted).

## Security
- **No real secrets** in this repo.
- Use a *private* repo or secret manager for production keys.

## License
MIT
