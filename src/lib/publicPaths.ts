/**
 * Fonte única de PUBLIC_PATH_PREFIXES — portado de src/routes/publicRoutes.tsx
 * (migração TanStack Start). Consumido pelo OnboardingGate em __root.tsx.
 */
export const PUBLIC_PATH_PREFIXES = [
  '/buscar', '/categoria', '/profissional', '/empresa', '/agencia',
  '/patrocinador', '/login', '/cadastro', '/anuncie', '/vagas', '/vaga',
  '/quero-ser-patrocinador', '/sponsor', '/espacos-patrocinio',
  '/contrato-patrocinio', '/blog', '/ajuda', '/cursos', '/faq',
  '/especialidade', '/especialidades', '/popular', '/institucional',
  '/forgot-password', '/reset-password', '/cookies', '/privacidade',
  '/termos',
  '/sobre', '/como-funciona', '/marido-de-aluguel',
  '/cidade', '/cidades', '/categorias', '/servico', '/servicos', '/servico-detalhe',
  '/excluir-conta', '/exclusao-de-conta', '/delete-account',
  '/esqueci-senha', '/senha-redefinida', '/password-reset-success',
  '/sitemap', '/p', '/error', '/status', '/preview', '/404', '/500',
] as const;

export const isPublicPath = (pathname: string) => {
  if (pathname === '/' || pathname === '/index') return true;
  // Landings programáticas por cidade usam hífen (ex.: /marido-de-aluguel-curitiba).
  if (pathname.startsWith('/marido-de-aluguel')) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
};
