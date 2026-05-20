/**
 * Phase 1.9.15 — Decision input normalization layer.
 * Consumes Mesh outputs as-is; never mutates them.
 */
import type {
  SponsorAllocationResult,
  SponsorExposureEvent,
  SponsorFairnessLedger,
  SponsorGeoMeshNode,
  SponsorSaturationMap,
  SponsorSlot,
} from '@/lib/runtimeSponsorMonetizationMesh';
import type { NormalizedDecisionInput } from './sponsorDecisionModel';

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function fairnessFor(
  ledger: SponsorFairnessLedger,
  sponsorId: string,
  city: string,
  category: string,
): number {
  for (const e of ledger.entries) {
    if (e.sponsorId === sponsorId && e.city === city && e.category === category) {
      return e.fairnessScore;
    }
  }
  return 1;
}

function saturationFor(
  map: SponsorSaturationMap,
  sponsorId: string,
  city: string,
  category: string,
): number {
  for (const e of map.entries) {
    if (e.sponsorId === sponsorId && e.city === city && e.category === category) {
      return clamp01(e.saturation + (e.capped ? 0.5 : 0));
    }
  }
  return 0;
}

function geoFactorFor(geo: ReadonlyArray<SponsorGeoMeshNode>, city: string): number {
  for (const n of geo) {
    if (n.city === city) {
      // penalize over-represented cities (positive delta), favor under-represented
      return clamp01(0.5 - n.balanceDelta * 0.5 + 0.5);
    }
  }
  return 0.5;
}

function exposureDecayFor(
  exposures: ReadonlyArray<SponsorExposureEvent>,
  sponsorId: string,
  slotId: string,
): number {
  let count = 0;
  for (const e of exposures) {
    if (e.sponsorId === sponsorId && e.slotId === slotId) count++;
  }
  // decay: 1 with no history; -> 0 as history accumulates
  return clamp01(1 / (1 + count * 0.25));
}

export function normalizeDecisionInputs(
  allocations: ReadonlyArray<SponsorAllocationResult>,
  slots: ReadonlyArray<SponsorSlot>,
  fairness: SponsorFairnessLedger,
  saturation: SponsorSaturationMap,
  geo: ReadonlyArray<SponsorGeoMeshNode>,
  exposures: ReadonlyArray<SponsorExposureEvent>,
): ReadonlyArray<NormalizedDecisionInput> {
  const slotMap = new Map(slots.map((s) => [s.id, s]));
  const result: NormalizedDecisionInput[] = allocations.map((a) => {
    const slot = slotMap.get(a.slotId);
    const city = slot?.city ?? '';
    const category = slot?.category ?? '';
    const sid = a.sponsorId;
    return Object.freeze({
      slotId: a.slotId,
      sponsorId: sid,
      rankingScore: clamp01(a.score),
      fairnessWeight: sid ? fairnessFor(fairness, sid, city, category) : 0,
      saturationPenalty: sid ? saturationFor(saturation, sid, city, category) : 0,
      geoBalanceFactor: geoFactorFor(geo, city),
      exposureDecayFactor: sid ? exposureDecayFor(exposures, sid, a.slotId) : 0,
    });
  });
  return Object.freeze(result);
}
