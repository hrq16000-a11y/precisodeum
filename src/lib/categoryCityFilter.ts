/**
 * Regras puras do filtro por cidade em /categorias.
 *
 * Invariante crítica: uma categoria que possui prestadores aprovados NUNCA
 * pode sumir da interface. Quando a cidade digitada não resolve para uma
 * cidade real (texto parcial, cidade sem prestador, carregando), o filtro
 * deixa de restringir e a lista volta ao critério global de contagem.
 */

export type RegionScope = 'city' | 'state' | 'global';

export interface CategoryLike {
  id: string;
  count: number;
}

export interface CityFilterInput {
  /** Texto (já debounced) digitado pelo usuário. */
  cityQuery: string | null | undefined;
  /** Escopo retornado pelo hook regional. */
  scope: RegionScope | undefined;
  /** Consulta regional ainda em andamento. */
  loading: boolean;
  /** Ids de categorias com prestador na cidade resolvida. */
  regionalIds: ReadonlySet<string>;
}

/** Só restringimos quando a cidade foi de fato resolvida e trouxe resultados. */
export function shouldRestrictToCity(input: CityFilterInput): boolean {
  const query = (input.cityQuery || '').trim();
  if (query.length < 3) return false;
  if (input.loading) return false;
  if (input.scope !== 'city') return false;
  return input.regionalIds.size > 0;
}

/**
 * Divide as categorias em "com prestador" e "vaga aberta".
 * Toda categoria de entrada aparece em exatamente uma das listas.
 */
export function partitionCategories<T extends CategoryLike>(
  categories: readonly T[],
  input: CityFilterInput,
): { withProviders: T[]; withoutProviders: T[]; restricted: boolean } {
  const restricted = shouldRestrictToCity(input);
  const withProviders: T[] = [];
  const withoutProviders: T[] = [];

  for (const cat of categories) {
    const hasProviders = restricted ? input.regionalIds.has(cat.id) : cat.count > 0;
    (hasProviders ? withProviders : withoutProviders).push(cat);
  }

  return { withProviders, withoutProviders, restricted };
}

/** Monta o destino do card preservando cidade e intenção de busca na URL. */
export function buildCategoryHref(
  slug: string,
  opts: { city?: string | null; intent?: 'vaga' | 'busca' } = {},
): string {
  const params = new URLSearchParams();
  const city = (opts.city || '').trim();
  if (city) params.set('cidade', city);
  if (opts.intent) params.set('intencao', opts.intent);
  const qs = params.toString();
  return `/categoria/${slug}${qs ? `?${qs}` : ''}`;
}
