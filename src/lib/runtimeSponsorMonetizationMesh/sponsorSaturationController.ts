/**
 * Phase 1.9.14 — Saturation controller. Caps per-sponsor frequency on each (city, category).
 */
import type {
  SponsorExposureEvent,
  SponsorSaturationMap,
  SponsorSaturationMapEntry,
  SponsorAllocationPolicy,
  SponsorNode,
} from './sponsorMeshTypes';
import { clamp01, deepFreeze } from './sponsorMeshInternals';

export function computeSaturationMap(
  nodes: ReadonlyArray<SponsorNode>,
  exposures: ReadonlyArray<SponsorExposureEvent>,
  policy: SponsorAllocationPolicy,
): SponsorSaturationMap {
  const cap = Math.max(1, policy.maxExposurePerSponsorPerSlot);
  const counts = new Map<string, number>();
  for (const e of exposures) {
    const k = `${e.sponsorId}::${e.city}::${e.category}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const entries: SponsorSaturationMapEntry[] = [];
  for (const node of nodes) {
    if (!node.active) continue;
    const k = `${node.id}::${node.city}::${node.category}`;
    const count = counts.get(k) ?? 0;
    const saturation = clamp01(count / (cap * 5));
    entries.push(
      deepFreeze({
        sponsorId: node.id,
        city: node.city,
        category: node.category,
        saturation,
        capped: count >= cap,
      }),
    );
  }
  entries.sort((a, b) =>
    a.city.localeCompare(b.city) ||
    a.category.localeCompare(b.category) ||
    a.sponsorId.localeCompare(b.sponsorId),
  );
  return deepFreeze({ entries });
}

export function isSponsorSaturated(
  map: SponsorSaturationMap,
  sponsorId: string,
  city: string,
  category: string,
): boolean {
  for (const e of map.entries) {
    if (e.sponsorId === sponsorId && e.city === city && e.category === category) {
      return e.capped;
    }
  }
  return false;
}
