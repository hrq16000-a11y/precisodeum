/**
 * Gera a URL pública da Edge Function `og-profile` para compartilhamento.
 *
 * Por que esta URL e não `/profissional/:slug` direto?
 *   - Crawlers (WhatsApp, Facebook, Telegram, etc.) NÃO executam JS,
 *     então não veem as meta tags renderizadas no client.
 *   - A edge function detecta o User-Agent: crawlers recebem HTML com
 *     OpenGraph dinâmico (avatar, nome, categoria); humanos são
 *     redirecionados via 302 para `/profissional/:slug` na SPA.
 *
 * O resultado é a mesma experiência para o usuário, mas com preview
 * rico no WhatsApp/redes sociais.
 *
 * @param slug    - slug público do profissional (ex: "joao-eletricista")
 * @param options - opções de overrides (raros — testes, staging)
 * @returns URL absoluta pronta para colar em mensagens / botões "Compartilhar"
 */
export interface BuildShareUrlOptions {
  /** Override do project ref do Supabase (default: VITE_SUPABASE_PROJECT_ID). */
  projectRef?: string;
  /** Parâmetros UTM opcionais para tracking de origem do compartilhamento. */
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
}

const DEFAULT_PROJECT_REF =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID) ||
  'qaftogrqeyymewoofexc';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

/**
 * Sanitiza um slug para o formato aceito pela edge function.
 * Mantém apenas a-z, 0-9, hífen; corta em 80 chars.
 */
export function sanitizeSlug(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function buildShareUrl(slug: string | null | undefined, options: BuildShareUrlOptions = {}): string {
  const safe = sanitizeSlug(slug);
  const ref = options.projectRef || DEFAULT_PROJECT_REF;
  const base = `https://${ref}.supabase.co/functions/v1/og-profile`;

  // Sem slug → fallback para a base. A edge devolve OG do site institucional.
  if (!safe) return base;

  const params = new URLSearchParams({ slug: safe });
  if (options.utm?.source) params.set('utm_source', options.utm.source);
  if (options.utm?.medium) params.set('utm_medium', options.utm.medium);
  if (options.utm?.campaign) params.set('utm_campaign', options.utm.campaign);

  return `${base}?${params.toString()}`;
}

/**
 * Valida se um slug está no formato esperado (sem sanitizar).
 * Útil para validações de formulário.
 */
export function isValidShareSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return SLUG_RE.test(String(slug));
}
