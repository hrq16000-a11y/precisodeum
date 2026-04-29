/**
 * Catálogo de aliases conhecidos no roteamento SEO. Usado pelos testes para
 * garantir que sitemaps NÃO emitem URLs que entrem em loop entre rotas
 * equivalentes (ex.: /cidade ↔ /cidades).
 *
 * Cada entrada define o path canônico e seus aliases. Se o sitemap (ou um
 * redirect) gerar um alias, o teste exige que o destino final seja o canônico
 * e que NÃO exista nova rota apontando de volta.
 */
export interface RouteAlias {
  canonical: string; // ex.: "/cidades"
  aliases: string[]; // ex.: ["/cidade"]
}

export const ROUTE_ALIASES: RouteAlias[] = [
  { canonical: '/cidades', aliases: ['/cidade'] },
  { canonical: '/categorias', aliases: ['/categoria-list', '/categories'] },
  { canonical: '/profissionais', aliases: ['/profissional-list', '/prestadores'] },
  { canonical: '/especialidades', aliases: ['/especialidade'] },
];

/**
 * Resolve um path através da cadeia de redirects (alias → canônico).
 * Retorna `{ finalPath, hops }`. Detecta loops (mesmo path visitado 2x).
 */
export function resolveRedirectChain(
  path: string,
  redirects: Array<{ from: string; to: string }>,
): { finalPath: string; hops: string[]; loop: boolean } {
  const hops: string[] = [path];
  const seen = new Set<string>([path]);
  let current = path;
  let safety = 0;

  while (safety++ < 10) {
    const rule = redirects.find((r) => r.from === current);
    if (!rule) break;
    if (seen.has(rule.to)) {
      hops.push(rule.to);
      return { finalPath: rule.to, hops, loop: true };
    }
    current = rule.to;
    seen.add(current);
    hops.push(current);
  }

  return { finalPath: current, hops, loop: false };
}

/**
 * Para um conjunto de URLs canônicas + um conjunto de redirects, valida que:
 *  - Nenhum alias conhecido aparece como URL final (deve redirecionar para o canônico).
 *  - Nenhum redirect cria loop entre páginas equivalentes.
 */
export function detectAliasLoops(
  urls: string[],
  redirects: Array<{ from: string; to: string }>,
): string[] {
  const issues: string[] = [];
  const aliasMap = new Map<string, string>();
  for (const r of ROUTE_ALIASES) {
    for (const a of r.aliases) aliasMap.set(a, r.canonical);
  }

  for (const url of urls) {
    const path = url.startsWith('http') ? new URL(url).pathname : url;
    const segment = '/' + path.split('/').filter(Boolean)[0];
    if (aliasMap.has(segment)) {
      issues.push(`URL final usa alias "${segment}", deveria ser "${aliasMap.get(segment)}": ${url}`);
    }
    const chain = resolveRedirectChain(path, redirects);
    if (chain.loop) {
      issues.push(`Loop de redirect detectado em ${path} → ${chain.hops.join(' → ')}`);
    }
  }
  return issues;
}
