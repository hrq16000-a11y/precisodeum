/**
 * serviceAreaNormalize — separa cidade-base (município sede) de áreas
 * de atendimento (cidades vizinhas / regiões metropolitanas).
 *
 * Regras:
 *  - A cidade-base nunca pode estar dentro do array de service_area.
 *  - Labels regionais ("Região Metropolitana de Curitiba", "Grande SP")
 *    são mantidas como TAGS de área de atendimento, mas nunca como cidade-base.
 *  - Duplicatas e variações de acentuação são deduplicadas.
 */

import { isRegionalLabel } from '@/lib/geoReverseGeocode';

function normalize(s: string) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export interface NormalizedServiceArea {
  /** Cidades aceitas como áreas de atendimento (formato livre, ex: "Curitiba/PR"). */
  cities: string[];
  /** Tags regionais aceitas (ex: "Região Metropolitana de Curitiba"). */
  regions: string[];
  /** Duplicatas removidas (cidade-base ou repetições). */
  removed: string[];
}

/**
 * Recebe uma lista bruta de áreas e a cidade-base e devolve a lista
 * pronta para gravar em `services.service_area`.
 */
export function normalizeServiceArea(
  rawAreas: string[] | null | undefined,
  baseCity: string | null | undefined,
): NormalizedServiceArea {
  const out: NormalizedServiceArea = { cities: [], regions: [], removed: [] };
  if (!Array.isArray(rawAreas) || rawAreas.length === 0) return out;

  const baseKey = baseCity ? normalize(baseCity) : '';
  const seen = new Set<string>();

  for (const raw of rawAreas) {
    const value = (raw || '').trim();
    if (!value) continue;
    const key = normalize(value);
    if (!key) continue;

    // Remove cidade-base do array de área (não pode duplicar)
    if (baseKey && key.startsWith(baseKey)) {
      out.removed.push(value);
      continue;
    }
    if (seen.has(key)) {
      out.removed.push(value);
      continue;
    }
    seen.add(key);

    if (isRegionalLabel(value)) {
      out.regions.push(value);
    } else {
      out.cities.push(value);
    }
  }
  return out;
}

/** Junta cities + regions em uma única lista limpa para gravar no banco. */
export function flattenServiceArea(area: NormalizedServiceArea): string[] {
  return [...area.cities, ...area.regions];
}
