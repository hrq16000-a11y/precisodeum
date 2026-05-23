/**
 * FASE 2.6 — CTA Variants (sem framework A/B).
 *
 * Variante controlada por admin via `site_settings`:
 *   - cta_whatsapp_variant
 *   - cta_lead_variant
 *
 * Tracking: o componente que renderiza o CTA chama `recordCtaClick(variant, ...)`
 * para anexar a variante ao funil público (audit_log).
 */

import { supabase } from '@/integrations/supabase/client';

export const WHATSAPP_VARIANTS = {
  falar_no_whatsapp: 'Falar no WhatsApp',
  falar_agora: 'Falar agora',
  atendimento_imediato: 'Atendimento imediato',
  solicitar_atendimento: 'Solicitar atendimento',
} as const;

export const LEAD_VARIANTS = {
  solicitar_orcamento: 'Solicitar orçamento',
  pedir_proposta: 'Pedir proposta',
  enviar_solicitacao: 'Enviar solicitação',
  comecar_agora: 'Começar agora',
} as const;

export type WhatsappVariantKey = keyof typeof WHATSAPP_VARIANTS;
export type LeadVariantKey = keyof typeof LEAD_VARIANTS;

export const DEFAULT_WHATSAPP_VARIANT: WhatsappVariantKey = 'falar_no_whatsapp';
export const DEFAULT_LEAD_VARIANT: LeadVariantKey = 'solicitar_orcamento';

export function resolveWhatsappVariant(raw: unknown): WhatsappVariantKey {
  const k = typeof raw === 'string' ? raw : DEFAULT_WHATSAPP_VARIANT;
  return (k in WHATSAPP_VARIANTS ? k : DEFAULT_WHATSAPP_VARIANT) as WhatsappVariantKey;
}

export function resolveLeadVariant(raw: unknown): LeadVariantKey {
  const k = typeof raw === 'string' ? raw : DEFAULT_LEAD_VARIANT;
  return (k in LEAD_VARIANTS ? k : DEFAULT_LEAD_VARIANT) as LeadVariantKey;
}

export function getWhatsappCtaLabel(variant: WhatsappVariantKey, fallback?: string): string {
  return WHATSAPP_VARIANTS[variant] || fallback || WHATSAPP_VARIANTS[DEFAULT_WHATSAPP_VARIANT];
}

export function getLeadCtaLabel(variant: LeadVariantKey, fallback?: string): string {
  return LEAD_VARIANTS[variant] || fallback || LEAD_VARIANTS[DEFAULT_LEAD_VARIANT];
}

/**
 * Registra clique em CTA (variante) — fire-and-forget.
 * Reusa o canal canônico do funil público via audit_log.
 */
export function recordCtaClick(params: {
  cta: 'whatsapp' | 'lead' | 'phone';
  variant: string;
  providerId?: string | null;
  pathname?: string | null;
}) {
  if (typeof window === 'undefined') return;
  void supabase.rpc('record_audit_event' as any, {
    _action: 'cta_click',
    _resource_type: 'cta_variant',
    _resource_id: `${params.cta}:${params.variant}`,
    _details: {
      cta: params.cta,
      variant: params.variant,
      provider_id: params.providerId || null,
      pathname: params.pathname || (typeof window !== 'undefined' ? window.location.pathname : null),
    },
  } as any).then(() => {}, () => {});
}
