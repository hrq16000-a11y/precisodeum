type LocalityInfoEntry = {
  name?: string;
  description?: string;
  adminLevel?: number;
};

type ReverseGeocodeResponse = {
  city?: string | null;
  locality?: string | null;
  principalSubdivision?: string | null;
  localityInfo?: {
    administrative?: LocalityInfoEntry[];
    informative?: LocalityInfoEntry[];
  } | null;
};

function normalize(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function isRegionalLabel(value?: string | null) {
  const text = normalize(value);
  return Boolean(text) && [
    'regiao metropolitana',
    'regiao geografica',
    'regiao imediata',
    'regiao intermediaria',
    'microregiao',
    'microrregiao',
    'mesorregiao',
    'mesoregiao',
    'area metropolitana',
  ].some((token) => text.includes(token));
}

function firstNamed(entries: LocalityInfoEntry[] | undefined, matcher: (entry: LocalityInfoEntry) => boolean) {
  return entries?.find((entry) => matcher(entry) && typeof entry.name === 'string' && entry.name.trim())?.name ?? null;
}

export function normalizeGeoLabel(value?: string | null) {
  return normalize(value);
}

export function parseReverseGeocodeLocation(data: ReverseGeocodeResponse) {
  const administrative = data?.localityInfo?.administrative ?? [];
  const informative = data?.localityInfo?.informative ?? [];

  const municipality =
    firstNamed(administrative, (entry) => normalize(entry.description).includes('municipio') || entry.adminLevel === 8) ||
    (!isRegionalLabel(data?.city) ? data?.city ?? null : null) ||
    (!isRegionalLabel(data?.locality) ? data?.locality ?? null : null);

  const explicitNeighborhood =
    firstNamed(administrative, (entry) => {
      const desc = normalize(entry.description);
      return desc.includes('bairro') || desc.includes('suburb') || desc.includes('district') || desc.includes('neighborhood');
    }) ||
    firstNamed(informative, (entry) => {
      const desc = normalize(entry.description);
      return desc.includes('bairro') || desc.includes('suburb') || desc.includes('district') || desc.includes('neighborhood');
    });

  const locality = data?.locality ?? null;
  const candidateNeighborhood =
    explicitNeighborhood ||
    (locality && municipality && normalize(locality) !== normalize(municipality) && !isRegionalLabel(locality)
      ? locality
      : null);

  // Garantia final: bairro nunca pode ser igual à cidade nem label regional.
  const neighborhood =
    candidateNeighborhood &&
    municipality &&
    normalize(candidateNeighborhood) !== normalize(municipality) &&
    !isRegionalLabel(candidateNeighborhood)
      ? candidateNeighborhood
      : null;

  return {
    city: municipality || null,
    state: data?.principalSubdivision || null,
    neighborhood,
  };
}

/**
 * Sanitiza um valor de bairro: rejeita se for igual à cidade (acento-insensitive)
 * ou se for label regional (Região Metropolitana, Microrregião etc.).
 * Retorna a string limpa ou null.
 */
export function sanitizeNeighborhood(neighborhood?: string | null, city?: string | null): string | null {
  const trimmed = (neighborhood || '').trim();
  if (!trimmed) return null;
  if (isRegionalLabel(trimmed)) return null;
  if (city && normalize(trimmed) === normalize(city)) return null;
  return trimmed;
}