/**
 * Helpers para o "contexto de exceção" do suporte.
 *
 * Fluxo:
 * 1. Páginas como /dashboard/servicos chamam `saveSupportContext({...})`
 *    quando o usuário clica em "Fale com suporte" (FAQ, helper ou limite).
 * 2. /dashboard/suporte lê esse contexto via `consumeSupportContext()`
 *    (consume = lê + remove) e o envia ao banco junto com o ticket
 *    (campo `support_tickets.context` em JSONB) + assunto automático.
 *
 * Mantemos sessionStorage como buffer entre páginas; a persistência final
 * é no banco para que o time admin enxergue sem depender do navegador.
 */

export type SupportContextSource =
  | 'services_form_category_helper'
  | 'services_faq_exception'
  | 'services_limit_reached';

export type SupportContext = {
  source: SupportContextSource;
  services_count?: number;
  cap?: number;
  attempted_categories?: number;
  ts?: number;
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
