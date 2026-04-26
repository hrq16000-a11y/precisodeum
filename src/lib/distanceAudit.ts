/**
 * Distance Audit — origem do cálculo de distância para auditoria visual e métricas.
 *
 * Cada provider exibido em busca/feed pode carregar um `_distanceAudit` opcional
 * para que a UI mostre de onde veio a distância (coords diretas vs centro de cidade)
 * e quando o cálculo foi considerado suspeito por inconsistência geográfica.
 */
import { calculateDistanceKm, hasCoordinates } from '@/lib/geoDistance';
import { getCityCoords } from '@/lib/cityCoords';
import { normalizeSearchText } from '@/lib/searchNormalization';

export type DistanceSource = 'direct' | 'city-center' | 'unavailable';

export interface DistanceAudit {
  /** Distância exibida (km) */
  distanceKm: number;
  /** Fonte do cálculo */
  source: DistanceSource;
  /** True se as coordenadas do provider divergem fortemente do centro da cidade declarada */
  suspicious: boolean;
  /** Distância "direta" original em km (mesmo quando corrigida) */
  rawDirectKm: number | null;
  /** Distância via centro da cidade do provider (quando disponível) */
  cityCenterKm: number | null;
  /** Cidade do provider (para logs) */
  providerCity: string;
  /** Cidade do usuário (para logs) */
  userCity: string;
  /** Distância entre centros das cidades do usuário e do provider */
  cityToCityKm: number | null;
  /** Divergência das coords do provider para o centro da cidade declarada */
  providerToOwnCenterKm: number | null;
}

/**
 * Calcula a distância "confiável" entre usuário e provider, anexando metadata de auditoria.
 *
 * Heurística:
 *  - Se as coords do provider estão a >8km do centro da SUA cidade declarada
 *    E ficaram suspeitamente perto do usuário (em outra cidade),
 *    consideramos as coordenadas suspeitas e usamos centro-cidade como referência.
 */
export function calculateAuditedDistanceKm(
  userLat: number | null | undefined,
  userLon: number | null | undefined,
  provider: { latitude: number | null; longitude: number | null; city?: string | null },
  userCity?: string | null,
): DistanceAudit {
  const providerCity = provider.city || '';
  const userCityStr = userCity || '';
  const baseAudit: DistanceAudit = {
    distanceKm: Infinity,
    source: 'unavailable',
    suspicious: false,
    rawDirectKm: null,
    cityCenterKm: null,
    providerCity,
    userCity: userCityStr,
    cityToCityKm: null,
    providerToOwnCenterKm: null,
  };

  if (!Number.isFinite(userLat) || !Number.isFinite(userLon)) return baseAudit;
  if (!hasCoordinates(provider.latitude, provider.longitude)) return baseAudit;

  const directKm = calculateDistanceKm(
    { latitude: userLat as number, longitude: userLon as number },
    { latitude: provider.latitude, longitude: provider.longitude },
  );
  baseAudit.rawDirectKm = directKm;

  const providerCityNorm = normalizeSearchText(providerCity);
  const userCityNorm = normalizeSearchText(userCityStr);

  if (!providerCityNorm || !userCityNorm || providerCityNorm === userCityNorm) {
    return { ...baseAudit, distanceKm: directKm, source: 'direct' };
  }

  const providerCityCenter = getCityCoords(providerCity);
  const userCityCenter = getCityCoords(userCityStr);
  if (!providerCityCenter || !userCityCenter) {
    return { ...baseAudit, distanceKm: directKm, source: 'direct' };
  }

  const providerToOwnCenterKm = calculateDistanceKm(
    { latitude: provider.latitude, longitude: provider.longitude },
    { latitude: providerCityCenter.lat, longitude: providerCityCenter.lon },
  );
  baseAudit.providerToOwnCenterKm = providerToOwnCenterKm;
  const providerToUserCenterKm = calculateDistanceKm(
    { latitude: provider.latitude, longitude: provider.longitude },
    { latitude: userCityCenter.lat, longitude: userCityCenter.lon },
  );
  baseAudit.cityToCityKm = calculateDistanceKm(
    { latitude: userCityCenter.lat, longitude: userCityCenter.lon },
    { latitude: providerCityCenter.lat, longitude: providerCityCenter.lon },
  );
  baseAudit.cityCenterKm = calculateDistanceKm(
    { latitude: userLat as number, longitude: userLon as number },
    { latitude: providerCityCenter.lat, longitude: providerCityCenter.lon },
  );

  const suspiciousCrossCityCoords =
    providerToOwnCenterKm > 8 && providerToUserCenterKm + 2 < providerToOwnCenterKm;

  if (!suspiciousCrossCityCoords) {
    return { ...baseAudit, distanceKm: directKm, source: 'direct' };
  }

  const corrected = Math.max(
    directKm,
    baseAudit.cityCenterKm ?? directKm,
    baseAudit.cityToCityKm ?? directKm,
  );

  // Telemetria leve: registra discrepâncias para detectar piora por cidade/CEP.
  recordGeoDiscrepancy({
    providerCity,
    userCity: userCityStr,
    directKm,
    cityCenterKm: baseAudit.cityCenterKm ?? null,
    providerToOwnCenterKm,
  });

  return {
    ...baseAudit,
    distanceKm: corrected,
    source: 'city-center',
    suspicious: true,
  };
}

// ───────────────────────────────────────────────────────────────────────
// Telemetria de discrepâncias geográficas (in-memory + console em DEV)
// ───────────────────────────────────────────────────────────────────────
interface DiscrepancyEntry {
  providerCity: string;
  userCity: string;
  directKm: number;
  cityCenterKm: number | null;
  providerToOwnCenterKm: number;
}

const _discrepancyCounters = new Map<string, number>();
const _discrepancyHistory: DiscrepancyEntry[] = [];
const HISTORY_LIMIT = 200;

export function recordGeoDiscrepancy(entry: DiscrepancyEntry) {
  const key = `${normalizeSearchText(entry.providerCity)}__${normalizeSearchText(entry.userCity)}`;
  _discrepancyCounters.set(key, (_discrepancyCounters.get(key) || 0) + 1);
  _discrepancyHistory.push(entry);
  if (_discrepancyHistory.length > HISTORY_LIMIT) _discrepancyHistory.shift();

  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn('[GeoDiscrepancy]', {
      providerCity: entry.providerCity,
      userCity: entry.userCity,
      directKm: Number(entry.directKm.toFixed(1)),
      cityCenterKm: entry.cityCenterKm != null ? Number(entry.cityCenterKm.toFixed(1)) : null,
      providerToOwnCenterKm: Number(entry.providerToOwnCenterKm.toFixed(1)),
      occurrencesForPair: _discrepancyCounters.get(key),
    });
  }
}

export function getGeoDiscrepancyStats() {
  return {
    counters: Object.fromEntries(_discrepancyCounters),
    recent: [..._discrepancyHistory],
  };
}

export function resetGeoDiscrepancyStats() {
  _discrepancyCounters.clear();
  _discrepancyHistory.length = 0;
}
