/**
 * formatServiceArea — apresenta a área de atendimento de um serviço
 * de forma consistente, sem texto livre digitado fora da seleção.
 *
 * Estratégia:
 *  - Se houver `service_radius` reconhecido, usa rótulo controlado
 *    ("Atendimento no local", "Toda a cidade", "Região metropolitana").
 *  - Caso contrário, usa o texto bruto removendo prefixos espúrios
 *    como "Toda " que vinham de wizards antigos.
 *  - Quando combinamos rádio "city" + cidade do provider, exibimos
 *    "Toda a cidade — Curitiba" (claro e auditável).
 */

const RADIUS_LABEL: Record<string, string> = {
  local: 'Atendimento no local',
  city: 'Toda a cidade',
  metro: 'Região metropolitana',
};

/** Remove prefixos legados ("Toda ", "Em toda ") sem perder a cidade. */
function stripLegacyPrefixes(raw: string): string {
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
  const cleanedArea = stripLegacyPrefixes((rawArea ?? '').toString());
  const radiusLabel = radius ? RADIUS_LABEL[radius] : null;
  const city = (providerCity ?? '').trim() || cleanedArea;

  if (radiusLabel && city) return `${radiusLabel} — ${city}`;
  if (radiusLabel) return radiusLabel;
  if (cleanedArea) return cleanedArea;
  if (city) return city;
  return '';
}
