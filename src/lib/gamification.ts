export const DEFAULT_GAMIFICATION_MULTIPLIER = 1;

export const GAMIFICATION_STATIONS = [
  { key: 'gamification_level_bronze', name: 'Bronze', fallback: 0 },
  { key: 'gamification_level_prata', name: 'Prata', fallback: 120 },
  { key: 'gamification_level_ouro', name: 'Ouro', fallback: 260 },
  { key: 'gamification_level_diamante', name: 'Diamante', fallback: 400 },
  { key: 'gamification_level_mestre', name: 'Mestre', fallback: 500 },
] as const;

export function resolveGamificationMultiplier(value?: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GAMIFICATION_MULTIPLIER;
}

export function scaleGamificationPoints(points: number, multiplier: number): number {
  return Math.round((Number(points) || 0) * resolveGamificationMultiplier(String(multiplier)));
}

export function getScaledStationLimit(key: string, rawValue: string | undefined, multiplier: number): number {
  const station = GAMIFICATION_STATIONS.find((item) => item.key === key);
  const base = Number(rawValue ?? station?.fallback ?? 0);
  return scaleGamificationPoints(Number.isFinite(base) ? base : station?.fallback ?? 0, multiplier);
}