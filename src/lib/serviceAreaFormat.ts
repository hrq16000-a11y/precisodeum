/**
 * formatServiceArea — apresenta a área de atendimento de um serviço
 * de forma consistente, sem texto livre digitado fora da seleção.
 *
 * Regras:
 *  - Se houver `service_radius` reconhecido, usa rótulo controlado
 *    ("Atendimento no local", "Toda a cidade", "Região metropolitana").
 *  - Quando há cidade do provider, exibimos
 *    "Toda a cidade — Curitiba" (claro e auditável).
 *  - O texto livre legado é higienizado: "Toda Curitiba" -> "Curitiba".
 *  - `isCatalogedCity` valida no front que a cidade veio realmente da
 *    seleção do autocomplete (lista IBGE), nunca de digitação livre.
 */

const RADIUS_LABEL: Record<string, string> = {
  local: 'Atendimento no local',
  city: 'Toda a cidade',
  metro: 'Região metropolitana',
};

/** Remove prefixos legados ("Toda ", "Em toda ", "Todo "). */
export function stripLegacyAreaPrefixes(raw: string): string {
  return raw
    .replace(/^\s*(em\s+)?toda\s+/i, '')
    .replace(/^\s*(em\s+)?todo\s+/i, '')
    .trim();
}

export function formatServiceArea(
  rawArea?: string | null,
  radius?: string | null,
  providerCity?: string | null,
): string {
  const cleanedArea = stripLegacyAreaPrefixes((rawArea ?? '').toString());
  const radiusLabel = radius ? RADIUS_LABEL[radius] : null;
  const city = (providerCity ?? '').trim() || cleanedArea;

  // Estado seguro: sem cidade do provider e sem cidade limpa válida.
  // Evita renderizar texto composto inseguro como "Toda Curitiba".
  const hasProviderCity = !!(providerCity ?? '').trim();

  if (radiusLabel && hasProviderCity) return `${radiusLabel} — ${(providerCity ?? '').trim()}`;
  if (radiusLabel && cleanedArea) return `${radiusLabel} — ${cleanedArea}`;
  if (radiusLabel) return radiusLabel;
  if (hasProviderCity) return (providerCity ?? '').trim();
  if (cleanedArea) return cleanedArea;
  return SAFE_EMPTY_STATE;
}

/** Rótulo seguro quando não há cidade confirmada do provider. */
export const SAFE_EMPTY_STATE = 'Atualize sua cidade';

/**
 * Verifica se o valor `service_area` corresponde exatamente a uma cidade
 * do catálogo (lista de cidades carregadas do IBGE, em `ALL_CITIES`).
 * Aceita match por `value` (nome puro) OU `label` ("Cidade - UF").
 */
export function isCatalogedCity(
  rawArea: string,
  catalog: ReadonlyArray<{ value: string; label?: string }>,
): boolean {
  const candidate = stripLegacyAreaPrefixes(rawArea).toLowerCase();
  if (!candidate) return false;
  return catalog.some(
    (c) =>
      c.value.toLowerCase() === candidate ||
      (c.label ?? '').toLowerCase() === candidate,
  );
}
