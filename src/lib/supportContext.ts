/**
 * Helpers para o "contexto de exceção" do suporte.
 *
 * Fluxo:
 * 1. Páginas como /dashboard/servicos chamam `saveSupportContext({...})`
 *    quando o usuário clica em "Fale com suporte" (FAQ, helper ou limite).
 * 2. /dashboard/suporte lê esse contexto via `consumeSupportContext()` e
 *    chama `enrichSupportContext()` para anexar o snapshot do perfil
 *    (slug, plano, nível) — gravado no banco em `support_tickets.context`.
 *
 * Mantemos sessionStorage como buffer entre páginas; a persistência final
 * é no banco para que o time admin enxergue sem depender do navegador.
 */

import { supabase } from '@/integrations/supabase/client';

export type SupportContextSource =
  | 'services_form_category_helper'
  | 'services_faq_exception'
  | 'services_limit_reached';

/**
 * Tipo do solicitante (regra de negócio):
 * - "sponsor"  → patrocinador (pagante por definição).
 * - "provider" → prestador (100% gratuito; priorização SOMENTE por nível Ouro+).
 * - "client"   → cliente final.
 * - "other"    → fallback quando não foi possível classificar.
 */
export type SupportRequesterKind = 'sponsor' | 'provider' | 'client' | 'other';

/** Extras isolados ao fluxo de patrocinador. Nunca preenchidos para prestadores. */
export type SupportSponsorExtras = {
  sponsor_tier?: string | null;       // basic | pro | premium | etc. (sponsor_plans.slug ou sponsor_leads.plan)
  sponsor_status?: string | null;     // active | trialing | canceled | sem_assinatura
};

export type SupportProfileSnapshot = {
  /** Slug público do prestador (link do perfil), quando existir. */
  profile_slug?: string | null;
  /**
   * @deprecated NÃO usar para priorização visual de prestadores.
   * Mantido apenas para auditoria histórica em support_context_snapshot_log.
   * Prestadores são 100% gratuitos — priorização deve usar `account_level` (Ouro+).
   * Para patrocinadores, usar `sponsor.sponsor_tier`.
   */
  current_plan?: string | null;
  /** Nome do nível de gamificação (ex.: "Ouro", "Diamante"). */
  account_level?: string | null;
  /** Pontos de engajamento acumulados. */
  engagement_points?: number | null;
  /** Tipo de perfil bruto vindo de profiles.profile_type. */
  profile_type?: string | null;
  /** Classificação canônica para roteamento/priorização do painel admin. */
  requester_kind?: SupportRequesterKind;
  /** Bloco isolado: só preenchido quando requester_kind === 'sponsor'. */
  sponsor?: SupportSponsorExtras;
};

export type SupportContext = {
  source: SupportContextSource;
  services_count?: number;
  cap?: number;
  attempted_categories?: number;
  ts?: number;
  /** Snapshot leve do perfil no momento da abertura do ticket. */
  profile_snapshot?: SupportProfileSnapshot;
};

const KEY = 'support_request_context';

export function saveSupportContext(ctx: SupportContext): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...ctx, ts: ctx.ts ?? Date.now() }));
  } catch {
    /* noop */
  }
}

export function consumeSupportContext(): SupportContext | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as SupportContext;
  } catch {
    return null;
  }
}

/**
 * Anexa um snapshot do perfil ao contexto. Best-effort: qualquer falha
 * (rede/RLS) cai silenciosamente e devolve o contexto original.
 */
export async function enrichSupportContext(
  ctx: SupportContext,
  userId: string | null | undefined,
): Promise<SupportContext> {
  if (!userId) return ctx;
  try {
    const [{ data: prof }, { data: prov }, { data: sponsorLead }] = await Promise.all([
      supabase
        .from('profiles')
        .select('profile_type, commercial_plan, engagement_points, level_id')
        .eq('id', userId)
        .maybeSingle() as any,
      supabase
        .from('providers')
        .select('slug, plan')
        .eq('user_id', userId)
        .maybeSingle() as any,
      supabase
        .from('sponsor_leads' as any)
        .select('id, plan')
        .eq('user_id', userId)
        .maybeSingle() as any,
    ]);

    let levelName: string | null = null;
    if (prof?.level_id) {
      const { data: lvl } = await (supabase
        .from('gamification_levels')
        .select('name')
        .eq('id', prof.level_id)
        .maybeSingle() as any);
      levelName = lvl?.name ?? null;
    }

    // Classifica o solicitante. Sponsor tem prioridade absoluta na detecção,
    // pois `profiles.profile_type` pode estar genérico ('user').
    let requester_kind: SupportRequesterKind = 'other';
    if (sponsorLead?.id) requester_kind = 'sponsor';
    else if (prov?.slug || prof?.profile_type === 'provider' || prof?.profile_type === 'agency')
      requester_kind = 'provider';
    else if (prof?.profile_type === 'client') requester_kind = 'client';

    const snapshot: SupportProfileSnapshot = {
      profile_slug: prov?.slug ?? null,
      // Mantido para auditoria histórica; UI NÃO deve usar para prestadores.
      current_plan: prof?.commercial_plan ?? prov?.plan ?? null,
      account_level: levelName,
      engagement_points: prof?.engagement_points ?? null,
      profile_type: prof?.profile_type ?? null,
      requester_kind,
    };

    if (requester_kind === 'sponsor') {
      snapshot.sponsor = {
        sponsor_tier: sponsorLead?.plan ?? null,
        sponsor_status: sponsorLead?.id ? 'active' : 'sem_assinatura',
      };
    }

    return { ...ctx, profile_snapshot: snapshot };
  } catch {
    return ctx;
  }
}

/** Assunto automático para triagem rápida no /admin. */
export function buildAutoSubject(ctx: SupportContext | null | undefined): string {
  if (!ctx?.source) return 'Suporte';
  switch (ctx.source) {
    case 'services_limit_reached':
      return `Exceção: liberar serviços (${ctx.services_count ?? '?'}/${ctx.cap ?? 5})`;
    case 'services_faq_exception':
      return `Exceção: cadastrar mais serviços (FAQ)`;
    case 'services_form_category_helper':
      return `Exceção: serviços/categorias (formulário)`;
    default:
      return 'Suporte';
  }
}

/** Mensagem inicial pré-preenchida para o composer. */
export function buildAutoMessage(ctx: SupportContext): string {
  const lines = [
    'Olá! Gostaria de solicitar liberação para cadastrar mais serviços.',
    '',
    'Contexto automático:',
    `- Serviços atuais: ${ctx.services_count ?? 0} de ${ctx.cap ?? 5}`,
  ];
  if (ctx.attempted_categories != null) {
    lines.push(`- Categorias tentadas: ${ctx.attempted_categories}`);
  }
  lines.push(`- Origem: ${ctx.source}`, '', 'Posso explicar meu caso a seguir.');
  return lines.join('\n');
}
