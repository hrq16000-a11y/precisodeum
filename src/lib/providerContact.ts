/**
 * providerContact — revelação sob demanda do contato do profissional.
 *
 * SEGURANÇA: `providers.phone` e `providers.whatsapp` não são mais legíveis por
 * visitantes anônimos (grant de coluna revogado). O número só é entregue pela
 * RPC `get_provider_contact`, que valida se o perfil está aprovado/ativo —
 * ou se quem pede é o dono/admin.
 *
 * UX: o número é buscado apenas quando o usuário demonstra intenção (clique no
 * CTA), o que evita expor a base inteira a scrapers sem adicionar fricção real.
 */
import { supabase } from '@/integrations/supabase/client';

export interface ProviderContact {
  phone: string;
  whatsapp: string;
}

const EMPTY: ProviderContact = { phone: '', whatsapp: '' };

/** Cache por sessão: um mesmo card/perfil não refaz a chamada. */
const cache = new Map<string, ProviderContact>();
const inflight = new Map<string, Promise<ProviderContact>>();

export function getCachedProviderContact(providerId?: string | null): ProviderContact | null {
  if (!providerId) return null;
  return cache.get(providerId) ?? null;
}

export async function fetchProviderContact(providerId?: string | null): Promise<ProviderContact> {
  if (!providerId) return EMPTY;

  const cached = cache.get(providerId);
  if (cached) return cached;

  const pending = inflight.get(providerId);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const { data, error } = await supabase.rpc('get_provider_contact', { _provider_id: providerId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const contact: ProviderContact = {
        phone: (row as ProviderContact | undefined)?.phone?.trim() || '',
        whatsapp: (row as ProviderContact | undefined)?.whatsapp?.trim() || '',
      };
      cache.set(providerId, contact);
      return contact;
    } catch {
      // Falha de rede/permissão não pode quebrar o CTA: devolve vazio e permite retry.
      return EMPTY;
    } finally {
      inflight.delete(providerId);
    }
  })();

  inflight.set(providerId, promise);
  return promise;
}

/** Usado em testes e após atualização do próprio cadastro. */
export function clearProviderContactCache(providerId?: string) {
  if (providerId) cache.delete(providerId);
  else cache.clear();
}
