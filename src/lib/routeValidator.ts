/**
 * Centraliza a lista de rotas válidas da aplicação para validar links
 * dinâmicos (?next=, redirect_to, navigate("/...")) e impedir que o usuário
 * caia em /404 por culpa de URLs quebradas geradas internamente.
 *
 * A fonte de verdade continua sendo `src/App.tsx` — esta lista deve refletir
 * exatamente as rotas declaradas lá. O teste `route-validator.test.ts` faz
 * a checagem cruzada e quebra o build se algo divergir.
 */

// Padrões aceitos. `:param` representa qualquer segmento `[^/]+`.
// Ordem não importa (matching é regex). Mantenha em sincronia com App.tsx.
const ROUTE_PATTERNS: readonly string[] = [
  "/",
  "/index",
  "/index02",
  "/index02.html",
  "/pg03",
  "/pg03.html",
  "/index03",
  "/buscar",
  "/categoria/:slug",
  "/categoria/:slug/em/:cidade",
  "/categorias",
  "/cidades",
  "/cidade/:slug",
  "/profissional/:slug",
  "/empresa/:slug",
  "/agencia/:slug",
  "/patrocinador/:slug",
  "/login",
  "/cadastro",
  "/cadastro/rh",
  "/cadastro/retomar",
  "/cadastro-inicial",
  "/anuncie",
  "/vagas",
  "/vaga/:slug",
  "/quero-ser-patrocinador",
  "/sponsor/status",
  "/espacos-patrocinio",
  "/contrato-patrocinio",
  "/blog",
  "/blog/:slug",
  "/cookies",
  "/privacidade",
  "/termos",
  "/ajuda",
  "/ajuda/cadastro",
  "/ajuda/online-offline",
  "/ajuda/ordenacao-busca",
  "/como-funciona",
  "/cursos",
  "/onboarding-v2/sucesso",
  "/reset-password",
  "/auth/callback",
  "/404",
  "/500",
  "/error/404",
  "/error/500",
  // Dashboard
  "/dashboard",
  "/dashboard/perfil",
  "/dashboard/servicos",
  "/dashboard/status",
  "/dashboard/portfolio",
  "/dashboard/avaliacoes",
  "/dashboard/leads",
  "/dashboard/leads/:leadId",
  "/dashboard/leads-abertos",
  "/dashboard/notificacoes",
  "/dashboard/notificacoes/preferencias",
  "/dashboard/metricas",
  "/dashboard/plano",
  "/dashboard/minha-pagina",
  "/dashboard/vagas",
  "/dashboard/agencia",
  "/dashboard/empresa",
  "/dashboard/comunidade",
  "/dashboard/privacidade",
  "/dashboard/auditoria-consentimentos",
  "/dashboard/meu-cadastro",
  "/dashboard/cadastro-status",
  "/dashboard/assistente",
  "/dashboard/indicacoes",
  "/dashboard/ranking",
  "/dashboard/sugestoes-identidade",
  "/dashboard/auditoria-bairro",
  "/dashboard/localizacao-guiada",
  "/dashboard/chat",
  "/dashboard/suporte",
] as const;

const PATTERN_REGEXES: RegExp[] = ROUTE_PATTERNS.map((pattern) => {
  // Escapa regex e converte :param em [^/]+
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const withParams = escaped.replace(/:[a-zA-Z][a-zA-Z0-9_]*/g, "[^/]+");
  return new RegExp(`^${withParams}$`);
});

/**
 * Retorna `true` se o caminho corresponde a uma rota declarada no router.
 * Aceita apenas paths internos (sem domínio, sem `//`).
 *
 * Aceita query string (`?...`) e hash (`#...`) — eles não afetam o matching.
 */
export function isValidRoute(path: string | null | undefined): boolean {
  if (!path || typeof path !== "string") return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false; // protocol-relative: bloqueia open redirect
  // Strip query/hash para matching
  const cleanPath = path.replace(/[?#].*$/, "");
  // Admin routes são protegidas no AdminGuard; aqui consideramos qualquer
  // /admin/<segmento> como válido (a guarda decide o acesso).
  if (cleanPath === "/admin" || cleanPath.startsWith("/admin/")) return true;
  return PATTERN_REGEXES.some((re) => re.test(cleanPath));
}

/**
 * Sanitiza um path interno: retorna o próprio path se for válido,
 * ou `fallback` caso contrário. Bloqueia URLs externas, protocol-relative
 * (`//evil.com`), e paths não declarados.
 */
export function safeInternalPath(
  candidate: string | null | undefined,
  fallback: string = "/",
): string {
  if (isValidRoute(candidate)) return candidate as string;
  return fallback;
}

/** Para uso em testes/debug. */
export const __ROUTE_PATTERNS_FOR_TESTS = ROUTE_PATTERNS;
