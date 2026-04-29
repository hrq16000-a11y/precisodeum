/**
 * leadConversionTelemetry — telemetria de conversão de lead.
 *
 * Conceito do funil:
 *   1. clique de contato (whatsapp/phone) — já capturado em `lead_interactions`
 *      via trackWhatsAppClick / trackPhoneClick (src/lib/tracking.ts).
 *   2. envio de lead — registrado em `public.leads` quando o cliente preenche
 *      o formulário de contato.
 *
 * Esta lib expõe:
 *   - markLeadFormStarted: marca em sessionStorage o início do formulário com
 *     o provider de origem, para correlacionar com o envio bem-sucedido.
 *   - markLeadFormSubmitted: dispara a interação 'click' do tipo formulário e
 *     limpa a marca local.
 *   - fetchLeadConversionStats: consome a RPC `get_lead_conversion_stats` para
 *     dashboards do profissional.
 *
 * Sem PII. Fail-soft: nunca quebra a UI.
 */
import { supabase } from '@/integrations/supabase/client';

const KEY_PREFIX = 'lead_funnel:';

export interface LeadFunnelMark {
  providerId: string;
  serviceId?: string;
  source?: string;
  startedAt: number;
}

export function markLeadFormStarted(mark: Omit<LeadFunnelMark, 'startedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      `${KEY_PREFIX}${mark.providerId}`,
      JSON.stringify({ ...mark, startedAt: Date.now() } satisfies LeadFunnelMark),
    );
  } catch {
    /* fail-soft */
  }
}

export function readLeadFormMark(providerId: string): LeadFunnelMark | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${providerId}`);
    if (!raw) return null;
    return JSON.parse(raw) as LeadFunnelMark;
  } catch {
    return null;
  }
}

export function clearLeadFormMark(providerId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(`${KEY_PREFIX}${providerId}`);
  } catch {
    /* fail-soft */
  }
}

/**
 * Marca que o formulário de lead foi enviado com sucesso.
 * Retorna o tempo (ms) entre clique no contato e envio efetivo, ou null.
 */
export function markLeadFormSubmitted(providerId: string): number | null {
  const mark = readLeadFormMark(providerId);
  clearLeadFormMark(providerId);
  if (!mark) return null;
  return Math.max(0, Date.now() - mark.startedAt);
}

export interface LeadConversionStats {
  provider_id: string;
  contact_clicks: number;
  leads_sent: number;
  conversion_pct: number;
  window_days: number;
}

/**
 * Lê estatísticas de conversão (clique → envio) para o provider logado
 * (ou para um provider específico, se admin).
 */
export async function fetchLeadConversionStats(opts: { providerId?: string; days?: number } = {}): Promise<LeadConversionStats | null> {
  try {
    const { data, error } = await supabase.rpc('get_lead_conversion_stats', {
      _provider_id: opts.providerId ?? null,
      _days: opts.days ?? 30,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return (row as LeadConversionStats) || null;
  } catch {
    return null;
  }
}
