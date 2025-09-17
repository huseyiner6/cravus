// src/lib/supabase/membership.ts
import { supabase } from './client';

export type SubscriptionTier = 'free' | 'regular' | 'pro';

/**
 * Etkin üyelik tier'ını döndürür.
 * Kaynak: user_membership_view.effective_tier
 */
export async function getMembership(): Promise<SubscriptionTier> {
  const { data: u, error: ue } = await supabase.auth.getUser();
  if (ue) throw ue;
  const userId = u.user?.id;
  if (!userId) return 'free';

  const { data, error } = await supabase
    .from('user_membership_view')
    .select('effective_tier')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data as any)?.effective_tier ?? 'free';
}

/**
 * Dev/QA amaçlı yükseltme (stub).
 * RPC: set_membership(p_tier, p_platform)
 */
export async function upgradeMembership(
  tier: Exclude<SubscriptionTier, 'free'>,
  platform: 'ios' | 'android' | 'web' = 'ios'
): Promise<true> {
  const { error } = await supabase.rpc('set_membership', {
    p_tier: tier,
    p_platform: platform,
  });
  if (error) throw error;
  return true;
}

/**
 * Kullanıcı yeni bir check-in başlatabilir mi? (üyelik + ücretsiz limit)
 * Sunucudaki RPC (can_checkin) üzerinden kontrol eder.
 */
export async function canStartCheckinLocal(): Promise<boolean> {
  const { data: u, error: ue } = await supabase.auth.getUser();
  if (ue) throw ue;
  const uid = u.user?.id;
  if (!uid) return false;

  const { data, error } = await supabase.rpc('can_checkin', { target_user: uid });
  if (error) throw error;
  return !!data;
}

/**
 * Ücretsiz check-in hakkı (free tier için gösterim).
 */
export async function getFreeQuota(): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('free_checkins_remaining')
    .maybeSingle();
  if (error) throw error;
  return (data as any)?.free_checkins_remaining ?? 0;
}