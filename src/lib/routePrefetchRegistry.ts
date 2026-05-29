import { prefetchImportWithRetry } from '@/lib/lazyWithRetry';

/**
 * Registro de prefetch por rota. Cada entrada possui:
 * - `match`: função que valida se o pathname casa com a rota (prefix ou regex).
 * - `key`: cacheKey único usado pelo `prefetchImportWithRetry` para evitar
 *   carregar o mesmo chunk duas vezes.
 * - `load`: factory de import dinâmico do arquivo da página.
 *
 * Estratégia: cadastramos apenas as rotas de maior peso ou maior frequência
 * de navegação. Rotas não cadastradas degradam graciosamente (sem prefetch,
 * só a navegação normal acontece).
 */
interface PrefetchRule {
  key: string;
  match: (pathname: string) => boolean;
  load: () => Promise<unknown>;
}

const startsWith = (prefix: string) => (pathname: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`);

const RULES: PrefetchRule[] = [
  // Páginas públicas de alto tráfego
  { key: 'route-search',         match: startsWith('/buscar'),         load: () => import('@/pages/SearchPage') },
  { key: 'route-category',       match: (p) => p.startsWith('/categoria/'), load: () => import('@/pages/CategoryPage') },
  { key: 'route-category-city',  match: (p) => /^\/categoria\/[^/]+\/em\/[^/]+/.test(p), load: () => import('@/pages/CategoryCityPage') },
  { key: 'route-provider',       match: (p) => p.startsWith('/profissional/'), load: () => import('@/pages/ProviderProfile') },
  { key: 'route-city',           match: (p) => p.startsWith('/cidade/'), load: () => import('@/pages/CityPage') },
  // Conversão / auth
  { key: 'route-login',          match: startsWith('/login'),          load: () => import('@/pages/LoginPage') },
  { key: 'route-cadastro',       match: startsWith('/cadastro-inicial'), load: () => import('@/pages/CadastroInicialPage') },
  // Painel
  { key: 'route-dashboard',      match: (p) => p === '/dashboard' || p === '/dashboard/', load: () => import('@/pages/DashboardPage') },
  { key: 'route-dashboard-leads',match: startsWith('/dashboard/leads'), load: () => import('@/pages/DashboardLeadsPage') },
  // Conteúdo
  { key: 'route-blog',           match: startsWith('/blog'),           load: () => import('@/pages/BlogPage') },
  { key: 'route-vagas',          match: (p) => p === '/vagas' || p.startsWith('/vagas/'), load: () => import('@/pages/JobsPage') },
  { key: 'route-ajuda',          match: startsWith('/ajuda'),          load: () => import('@/pages/HelpCenterPage') },
];

/**
 * Dispara o prefetch da rota correspondente ao `pathname`, se cadastrada.
 * Idempotente (cacheKey impede duplicação). Falhas são engolidas
 * silenciosamente — prefetch nunca pode quebrar a navegação real.
 */
export function prefetchRoute(pathname: string | null | undefined): void {
  if (!pathname) return;
  const rule = RULES.find((r) => {
    try {
      return r.match(pathname);
    } catch {
      return false;
    }
  });
  if (!rule) return;
  void prefetchImportWithRetry(rule.key, rule.load).catch(() => {
    /* silent — prefetch best-effort */
  });
}

/** Para testes / diagnóstico — não use em runtime. */
export const __routePrefetchRules = RULES;
