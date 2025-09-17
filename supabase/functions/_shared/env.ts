// supabase/functions/_shared/env.ts

// ---- helpers
const env = (k: string) => Deno.env.get(k);
const bool = (v: string | undefined, d = false) => {
  if (!v) return d;
  const s = v.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  return d;
};
const int = (v: string | undefined, d: number, min?: number, max?: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  const clamped = Math.floor(n);
  if (min != null && clamped < min) return min;
  if (max != null && clamped > max) return max;
  return clamped;
};

// ---- canonical SB_* (fallback SUPABASE_*)
export const BASE_URL = env('SB_URL') ?? env('SUPABASE_URL');
export const ANON_KEY = env('SB_ANON_KEY') ?? env('SUPABASE_ANON_KEY');

// ---- runtime knobs
export const CFG = {
  FREE_LIMIT:              int(env('CHECKIN_FREE_LIMIT'),            3,    0, 100),
  DISTANCE_METERS:         int(env('CHECKIN_DISTANCE_M'),           75,   10, 10000),
  COOLDOWN_MIN:            int(env('CHECKIN_COOLDOWN_MIN'),        120,    0, 10080),
  OTP_DIGITS:              int(env('CHECKIN_OTP_DIGITS'),            4,    3, 10),
  OTP_MINUTES:             int(env('CHECKIN_OTP_MINUTES'),           5,    1, 120),
  REQUIRE_SINGLE_ACTIVE:   bool(env('CHECKIN_REQUIRE_SINGLE_ACTIVE'), false),
  SELECT_EARLIEST_END:     bool(env('CHECKIN_SELECT_EARLIEST_END'),   true),
  LOG_DEBUG:               bool(env('CHECKIN_LOG_DEBUG'),            false),
} as const;