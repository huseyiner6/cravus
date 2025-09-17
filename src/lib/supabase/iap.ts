// src/lib/supabase/iap.ts
import { supabase } from './client';

/**
 * Dev ortamında UI butonlarını tek noktadan RPC'ye yönlendirmek için
 * saklı tutuyoruz. Prod'da IAP doğrulaması edge function ile yazacaktır.
 */
export async function setTierDev(
  platform: 'ios' | 'android',
  tier: 'regular' | 'pro'
): Promise<true> {
  const { error } = await supabase.rpc('set_membership', {
    p_tier: tier,
    p_platform: platform,
  });
  if (error) throw error;
  return true;
}