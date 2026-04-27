/**
 * findExistingService — anti-duplicação.
 *
 * Antes de criar um novo serviço via RPC, verifica se o provider já tem
 * um serviço ativo dessa mesma categoria. Se tiver, retorna o ID existente
 * para reuso — evita duplicar registros e estouro de capacidade do plano.
 *
 * Estratégia:
 *  1. Match exato por (provider_id, category_id) ativo.
 *  2. Fallback: match por nome normalizado (provider_id, lower(service_name)).
 */
import { supabase } from '@/integrations/supabase/client';

interface ExistingServiceRecord {
  id: string;
  service_name: string | null;
  description: string | null;
  category_id: string | null;
  service_area: string | null;
  address: string | null;
  working_hours: string | null;
  price: string | null;
  created_at?: string | null;
}

function scoreExistingService(service: ExistingServiceRecord, preferredCategoryId?: string | null) {
  let score = 0;
  if (service.category_id) score += 4;
  if ((service.description || '').trim().length >= 10) score += 4;
  if ((service.service_area || '').trim()) score += 2;
  if ((service.working_hours || '').trim()) score += 1;
  if ((service.address || '').trim()) score += 1;
  if ((service.service_name || '').trim().length >= 3) score += 1;
  if (preferredCategoryId && service.category_id === preferredCategoryId) score += 6;
  return score;
}

export async function findExistingFirstService(
  providerId: string,
  categoryId: string,
  serviceName: string,
): Promise<string | null> {
  if (!providerId) return null;

  try {
    // 1) Match por categoria principal
    if (categoryId) {
      const { data: byCategory } = await supabase
        .from('services')
        .select('id, deleted_at')
        .eq('provider_id', providerId)
        .eq('category_id', categoryId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1);
      if (byCategory && byCategory[0]?.id) return byCategory[0].id;
    }

    // 2) Match por nome normalizado
    const normalizedName = (serviceName || '').trim();
    if (normalizedName) {
      const { data: byName } = await supabase
        .from('services')
        .select('id, deleted_at')
        .eq('provider_id', providerId)
        .ilike('service_name', normalizedName)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1);
      if (byName && byName[0]?.id) return byName[0].id;
    }
  } catch {
    /* fail-soft: se falhar, seguimos para criação normal */
  }
  return null;
}

/**
 * fetchExistingFirstService — retorna o registro completo do 1º serviço
 * ativo do provider (mais antigo), para hidratar o Wizard em modo revisão.
 */
export async function fetchExistingFirstService(
  providerId: string,
  preferredCategoryId?: string | null,
): Promise<ExistingServiceRecord | null> {
  if (!providerId) return null;
  try {
    const { data } = await supabase
      .from('services')
      .select('id, service_name, description, category_id, service_area, address, working_hours, price, created_at')
      .eq('provider_id', providerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(12);

    const rows = ((data as ExistingServiceRecord[] | null) ?? []).slice();
    if (!rows.length) return null;

    rows.sort((a, b) => {
      const scoreDiff = scoreExistingService(b, preferredCategoryId) - scoreExistingService(a, preferredCategoryId);
      if (scoreDiff !== 0) return scoreDiff;
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * findExistingProvider — verifica se o usuário já tem provider criado
 * (mesmo que o estado local tenha perdido o ID).
 */
export async function findExistingProvider(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1);
    return data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}
