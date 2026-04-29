/**
 * recoverProviderId — fallback unificado para obter o `providerId` quando a
 * sessão expira, o draft local perde a referência ou o componente é montado
 * sem prop.
 *
 * Compartilhado entre `ServiceWizard` (dashboard / Step20) e `OnboardingV2Shell`
 * para garantir comportamento idêntico.
 */
import { supabase } from '@/integrations/supabase/client';

export interface RecoverProviderIdOptions {
  userId?: string | null;
  hint?: string | null; // já conhecido (vindo de prop/state)
}

export async function recoverProviderId(
  opts: RecoverProviderIdOptions,
): Promise<string | null> {
  const { userId, hint } = opts;
  if (hint) return hint;
  if (!userId) return null;
  try {
    const { data } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    return (data?.id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Conta exata de serviços ativos do provider — usado para validar a contagem
 * expressa do wizard contra o banco em real-time. */
export async function fetchProviderServiceCount(
  providerId: string | null | undefined,
): Promise<number> {
  if (!providerId) return 0;
  try {
    const { count } = await supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('provider_id', providerId);
    return count ?? 0;
  } catch {
    return 0;
  }
}
