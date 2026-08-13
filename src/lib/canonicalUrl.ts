/**
 * Helper único para gerar URLs canônicas absolutas e consistentes em todas as páginas.
 *
 * Regras:
 *   - Sempre retorna URL absoluta (`https://...`).
 *   - Se SITE_BASE_URL não estiver definido (variável de ambiente ausente), usa o
 *     fallback fixo `https://precisodeum.com.br` (domínio canônico de produção).
 *   - Normaliza barras duplicadas e remove trailing slash (exceto raiz).
 *   - Aceita tanto path relativo (`/categoria/eletricista`) quanto URL absoluta
 *     (devolvida sem alteração se já apontar para o mesmo domínio).
 */

import { BRAND_BASE_URL } from '@/config/brand';

const FALLBACK_BASE = BRAND_BASE_URL;

export function getSiteBaseUrl(): string {
  // Vite expõe variáveis em import.meta.env; em testes node usamos process.env.
  const fromVite =
    typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SITE_BASE_URL;
  const fromNode =
    typeof process !== 'undefined' && process.env ? process.env.SITE_BASE_URL : undefined;
  const raw = (fromVite || fromNode || FALLBACK_BASE).trim();
  // Garante protocolo e remove trailing slash.
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProto.replace(/\/+$/, '');
}

export function buildCanonicalUrl(pathOrUrl: string | null | undefined): string {
  const base = getSiteBaseUrl();
  const value = String(pathOrUrl || '').trim();

  // URL absoluta já no domínio canônico → devolve normalizada.
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      const baseHost = new URL(base).host;
      if (parsed.host === baseHost) {
        const path = parsed.pathname.replace(/\/+$/, '') || '/';
        return `${base}${path === '/' ? '' : path}${parsed.search}`;
      }
      return value; // outro domínio → preserva
    } catch {
      return base;
    }
  }

  if (!value) return base;

  // Normaliza path: garante barra inicial, remove duplicadas e trailing.
  const path = `/${value}`.replace(/\/+/g, '/').replace(/\/+$/, '');
  return `${base}${path || ''}`;
}

export const CANONICAL_FALLBACK_BASE = FALLBACK_BASE;
