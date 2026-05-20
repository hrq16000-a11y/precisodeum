import { describe, it, expect } from 'vitest';
import {
  allocateAll,
  buildAttributionTraces,
  buildSponsorMeshSnapshot,
  computeFairnessLedger,
  computeGeoMesh,
  computeSaturationMap,
  projectExposures,
  type SponsorAllocationPolicy,
  type SponsorExposureEvent,
  type SponsorNode,
  type SponsorQualityIndex,
  type SponsorSlot,
} from '@/lib/runtimeSponsorMonetizationMesh';
import {
  SPONSOR_DECISION_INTERNALS,
  buildFinalDecision,
  composeFinalScore,
  emitDecisionTrace,
  normalizeDecisionInputs,
  resolveSlotAssignments,
  computeFinalRankingVector,
  assertSnapshotLocked,
  SponsorDecisionMutationError,
} from '@/lib/runtimeSponsorDecisionFinalizer';

const policy: SponsorAllocationPolicy = {
  maxExposurePerSponsorPerSlot: 3,
  maxShareDominance: 0.6,
  fairnessFloor: 0.1,
  geoBalanceWeight: 0.5,
};

const nodes: SponsorNode[] = [
  { id: 's1', city: 'curitiba', category: 'eletricista', tier: 'premium', qualityIndex: 0.9, active: true },
  { id: 's2', city: 'curitiba', category: 'eletricista', tier: 'pro', qualityIndex: 0.6, active: true },
  { id: 's3', city: 'sao_paulo', category: 'pintor', tier: 'pro', qualityIndex: 0.7, active: true },
];
const slots: SponsorSlot[] = [
  { id: 'a', city: 'curitiba', category: 'eletricista', capacity: 1, priority: 1 },
  { id: 'b', city: 'curitiba', category: 'eletricista', capacity: 1, priority: 0.5 },
  { id: 'c', city: 'sao_paulo', category: 'pintor', capacity: 1, priority: 0.8 },
];
const quality: SponsorQualityIndex[] = nodes.map((n) => ({
  sponsorId: n.id,
  score: n.qualityIndex,
  components: { base: n.qualityIndex },
}));

function buildContext(prior: ReadonlyArray<SponsorExposureEvent> = []) {
  const fairness = computeFairnessLedger(nodes, prior, policy);
  const saturation = computeSaturationMap(nodes, prior, policy);
  const allocations = allocateAll(slots, nodes, prior, quality, fairness, saturation, policy);
  const exposures = projectExposures(allocations, slots, 0);
  const snap = buildSponsorMeshSnapshot(nodes, slots, exposures, policy);
  const attribution = buildAttributionTraces(exposures, snap.edges);
  const geo = computeGeoMesh(nodes, exposures, [
    { city: 'curitiba', demand: 4 },
    { city: 'sao_paulo', demand: 6 },
  ]);
  return {
    nodes,
    slots,
    exposures,
    quality,
    fairness,
    saturation,
    geo,
    allocations,
    attribution,
    policy,
  };
}

describe('Phase 1.9.15 — Sponsor Decision Finalizer', () => {
  it('preserves read-only internals incl. postDecisionMutationAllowed=false', () => {
    expect(SPONSOR_DECISION_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_DECISION_INTERNALS.liveExecutionEnabled).toBe(false);
    expect(SPONSOR_DECISION_INTERNALS.billingEnabled).toBe(false);
    expect(SPONSOR_DECISION_INTERNALS.chargesEnabled).toBe(false);
    expect(SPONSOR_DECISION_INTERNALS.postDecisionMutationAllowed).toBe(false);
    expect(Object.isFrozen(SPONSOR_DECISION_INTERNALS)).toBe(true);
  });

  it('normalizes mesh inputs into bounded [0,1] vectors', () => {
    const ctx = buildContext();
    const inputs = normalizeDecisionInputs(
      ctx.allocations,
      ctx.slots,
      ctx.fairness,
      ctx.saturation,
      ctx.geo,
      ctx.exposures,
    );
    expect(inputs.length).toBe(ctx.allocations.length);
    for (const i of inputs) {
      for (const v of [i.rankingScore, i.fairnessWeight, i.saturationPenalty, i.geoBalanceFactor, i.exposureDecayFactor]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('composes a deterministic final score from 5 normalized signals', () => {
    const s1 = composeFinalScore({
      slotId: 'x', sponsorId: 's', rankingScore: 1, fairnessWeight: 1,
      saturationPenalty: 0, geoBalanceFactor: 1, exposureDecayFactor: 1,
    });
    const s2 = composeFinalScore({
      slotId: 'x', sponsorId: 's', rankingScore: 0, fairnessWeight: 0,
      saturationPenalty: 1, geoBalanceFactor: 0, exposureDecayFactor: 0,
    });
    expect(s1).toBeGreaterThan(s2);
    expect(composeFinalScore({
      slotId: 'x', sponsorId: null, rankingScore: 1, fairnessWeight: 1,
      saturationPenalty: 0, geoBalanceFactor: 1, exposureDecayFactor: 1,
    })).toBe(0);
  });

  it('buildFinalDecision is bit-stable across repeated runs (same signature)', () => {
    const ctx = buildContext();
    const a = buildFinalDecision(ctx);
    const b = buildFinalDecision(ctx);
    expect(a.signature).toBe(b.signature);
    expect(a.assignments).toEqual(b.assignments);
    expect(a.orderedSlots).toEqual(b.orderedSlots);
  });

  it('produces a single snapshot that IS locked and frozen end-to-end', () => {
    const ctx = buildContext();
    const snap = buildFinalDecision(ctx);
    expect(snap.locked).toBe(true);
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.entries)).toBe(true);
    expect(Object.isFrozen(snap.assignments)).toBe(true);
    expect(() => assertSnapshotLocked(snap)).not.toThrow();
    expect(() => {
      (snap.entries as unknown as unknown[]).push({} as never);
    }).toThrow();
  });

  it('snapshot assignments cover every slot (1:1)', () => {
    const ctx = buildContext();
    const snap = buildFinalDecision(ctx);
    expect(Object.keys(snap.assignments).sort()).toEqual(['a', 'b', 'c']);
    const fromEntries = resolveSlotAssignments(snap.entries);
    expect(fromEntries).toEqual(snap.assignments);
  });

  it('entries are ordered by finalScore desc then slotId asc (priority=index)', () => {
    const ctx = buildContext();
    const snap = buildFinalDecision(ctx);
    for (let i = 1; i < snap.entries.length; i++) {
      const prev = snap.entries[i - 1];
      const cur = snap.entries[i];
      expect(prev.priority).toBe(i - 1);
      expect(cur.priority).toBe(i);
      if (prev.finalScore === cur.finalScore) {
        expect(prev.slotId.localeCompare(cur.slotId)).toBeLessThanOrEqual(0);
      } else {
        expect(prev.finalScore).toBeGreaterThanOrEqual(cur.finalScore);
      }
    }
  });

  it('rejects attempts to bypass the locked contract', () => {
    const ctx = buildContext();
    const snap = buildFinalDecision(ctx);
    const broken = { ...snap, locked: false } as unknown as typeof snap;
    expect(() => assertSnapshotLocked(broken)).toThrow(SponsorDecisionMutationError);
  });

  it('decision trace bridges attribution lineage from 1.9.14 without modifying it', () => {
    const ctx = buildContext();
    const snap = buildFinalDecision(ctx);
    const trace = emitDecisionTrace(snap, ctx.attribution);
    expect(trace.length).toBe(snap.entries.length);
    expect(Object.isFrozen(trace)).toBe(true);
    for (const t of trace) {
      expect(typeof t.priority).toBe('number');
      if (t.sponsorId) {
        expect(t.attributionSignature === null || /^[0-9a-f]{8}$/.test(t.attributionSignature)).toBe(true);
      }
    }
  });

  it('computeFinalRankingVector matches entries one-to-one when paired with same inputs', () => {
    const ctx = buildContext();
    const inputs = normalizeDecisionInputs(
      ctx.allocations, ctx.slots, ctx.fairness, ctx.saturation, ctx.geo, ctx.exposures,
    );
    const vector = computeFinalRankingVector(inputs);
    expect(vector.length).toBe(inputs.length);
    expect(Object.isFrozen(vector)).toBe(true);
  });

  it('does NOT mutate mesh inputs (single source of truth, downstream-only)', () => {
    const ctx = buildContext();
    const allocationsBefore = JSON.stringify(ctx.allocations);
    const fairnessBefore = JSON.stringify(ctx.fairness);
    const saturationBefore = JSON.stringify(ctx.saturation);
    buildFinalDecision(ctx);
    expect(JSON.stringify(ctx.allocations)).toBe(allocationsBefore);
    expect(JSON.stringify(ctx.fairness)).toBe(fairnessBefore);
    expect(JSON.stringify(ctx.saturation)).toBe(saturationBefore);
  });
});
