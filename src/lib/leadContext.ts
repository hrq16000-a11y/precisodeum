import type { LeadContext } from '@/hooks/useLeadFollowup';

/**
 * Mapeia o valor cru de `lead_context.origin` (gerado pelo formulário ou
 * pelo trigger backend) para um rótulo legível e neutro de UI. Garantimos
 * que NUNCA exibimos "Orçamento" — sempre tratamos como contato/solicitação.
 */
export function formatLeadOrigin(origin?: string | null): string {
  if (!origin) return 'Origem desconhecida';
  const key = origin.trim().toLowerCase();
  switch (key) {
    case 'search':
    case 'organic':
    case 'busca':
      return 'Busca Orgânica';
    case 'profile':
    case 'provider_profile':
    case 'perfil':
      return 'Perfil Direto';
    case 'category':
    case 'categoria':
      return 'Página da Categoria';
    case 'city':
    case 'cidade':
      return 'Página da Cidade';
    case 'home':
    case 'landing':
      return 'Página Inicial';
    case 'referral':
    case 'indicacao':
      return 'Indicação';
    case 'unknown':
    case '':
      return 'Origem desconhecida';
    default:
      // Capitaliza qualquer outro valor desconhecido sem quebrar a UI.
      return origin.charAt(0).toUpperCase() + origin.slice(1);
  }
}

/** Formata Cidade - UF a partir do contexto, sem quebrar quando faltar UF. */
export function formatLeadLocation(ctx?: LeadContext | null): string | null {
  const city = ctx?.city?.trim();
  const state = ctx?.state?.trim();
  if (city && state) return `${city} - ${state}`;
  if (city) return city;
  return null;
}

/**
 * Indica se o contexto possui qualquer informação útil para exibição (evita
 * renderizar pílulas vazias para leads antigos sem contexto).
 */
export function hasLeadContext(ctx?: LeadContext | null): boolean {
  if (!ctx) return false;
  return !!(
    formatLeadLocation(ctx) ||
    ctx.category ||
    (ctx.origin && ctx.origin !== 'unknown')
  );
}

/** Bairro do lead (quando capturado pelo formulário/página de origem). */
export function formatLeadNeighborhood(ctx?: LeadContext | null): string | null {
  const hood = typeof ctx?.neighborhood === 'string' ? ctx.neighborhood.trim() : '';
  return hood || null;
}
