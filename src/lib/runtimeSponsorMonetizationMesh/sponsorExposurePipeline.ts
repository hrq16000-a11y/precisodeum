/**
 * Phase 1.9.14 — Exposure pipeline. Pure projection of allocation outcomes
 * into normalized exposure events. No persistence, no IO.
 */
import type {
  SponsorAllocationResult,
  SponsorExposureEvent,
  SponsorSlot,
} from './sponsorMeshTypes';
import { deepFreeze } from './sponsorMeshInternals';

export function projectExposures(
  results: ReadonlyArray<SponsorAllocationResult>,
  slots: ReadonlyArray<SponsorSlot>,
  baseTick: number,
): ReadonlyArray<SponsorExposureEvent> {
  const slotMap = new Map(slots.map((s) => [s.id, s]));
  const events: SponsorExposureEvent[] = [];
  let tick = Math.max(0, Math.floor(baseTick));
  for (const r of results) {
    if (!r.sponsorId) continue;
    const slot = slotMap.get(r.slotId);
    if (!slot) continue;
    events.push(
      deepFreeze({
        sponsorId: r.sponsorId,
        slotId: r.slotId,
        city: slot.city,
        category: slot.category,
        tick: tick++,
        weight: Math.max(0, r.score),
      }),
    );
  }
  return deepFreeze(events);
}

export function mergeExposures(
  prior: ReadonlyArray<SponsorExposureEvent>,
  next: ReadonlyArray<SponsorExposureEvent>,
): ReadonlyArray<SponsorExposureEvent> {
  const merged = [...prior, ...next];
  merged.sort((a, b) =>
    a.tick - b.tick ||
    a.slotId.localeCompare(b.slotId) ||
    a.sponsorId.localeCompare(b.sponsorId),
  );
  return deepFreeze(merged);
}
