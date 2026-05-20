/**
 * Phase 1.9.14 — Geographic mesh balancing. Computes city-level representation
 * vs. demand density and signals territory balance deltas.
 */
import type {
  SponsorExposureEvent,
  SponsorGeoMeshNode,
  SponsorNode,
} from './sponsorMeshTypes';
import { clamp01, deepFreeze } from './sponsorMeshInternals';

export interface CityDemandSignal {
  readonly city: string;
  readonly demand: number; // raw demand units
}

export function computeGeoMesh(
  nodes: ReadonlyArray<SponsorNode>,
  exposures: ReadonlyArray<SponsorExposureEvent>,
  demand: ReadonlyArray<CityDemandSignal>,
): ReadonlyArray<SponsorGeoMeshNode> {
  const totalDemand = demand.reduce((acc, d) => acc + Math.max(0, d.demand), 0);
  const totalExposure = exposures.reduce((acc, e) => acc + e.weight, 0);

  const cities = new Set<string>();
  for (const n of nodes) cities.add(n.city);
  for (const d of demand) cities.add(d.city);
  for (const e of exposures) cities.add(e.city);

  const exposureByCity = new Map<string, number>();
  for (const e of exposures) {
    exposureByCity.set(e.city, (exposureByCity.get(e.city) ?? 0) + e.weight);
  }
  const demandByCity = new Map(demand.map((d) => [d.city, Math.max(0, d.demand)]));

  const mesh: SponsorGeoMeshNode[] = [];
  for (const city of cities) {
    const density = totalDemand > 0 ? (demandByCity.get(city) ?? 0) / totalDemand : 0;
    const representation =
      totalExposure > 0 ? (exposureByCity.get(city) ?? 0) / totalExposure : 0;
    mesh.push(
      deepFreeze({
        city,
        density: clamp01(density),
        representation: clamp01(representation),
        balanceDelta: representation - density,
      }),
    );
  }
  mesh.sort((a, b) => a.city.localeCompare(b.city));
  return deepFreeze(mesh);
}
