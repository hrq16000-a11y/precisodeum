import { deepFreeze, sigOf, cloneSorted } from './observabilityTypes';

export interface CityServicePair {
  readonly citySlug: string;
  readonly serviceSlug: string;
  readonly providers: number;
}

export interface CityServiceTopology {
  readonly pairs: ReadonlyArray<{ citySlug: string; serviceSlug: string; providers: number }>;
  readonly cityCount: number;
  readonly serviceCount: number;
  readonly signature: string;
}

export function buildCityServiceTopology(
  pairs: ReadonlyArray<CityServicePair>,
): CityServiceTopology {
  const sorted = cloneSorted(pairs.slice(), (a, b) => {
    if (a.citySlug !== b.citySlug) return a.citySlug < b.citySlug ? -1 : 1;
    return a.serviceSlug < b.serviceSlug ? -1 : a.serviceSlug > b.serviceSlug ? 1 : 0;
  });
  const cities = new Set(sorted.map((p) => p.citySlug));
  const services = new Set(sorted.map((p) => p.serviceSlug));
  const out = {
    pairs: sorted,
    cityCount: cities.size,
    serviceCount: services.size,
    signature: sigOf(sorted),
  };
  return deepFreeze(out);
}
