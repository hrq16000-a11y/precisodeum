/**
 * Phase 1.9.16 — Sponsor Campaign Abstraction Layer · Test Suite.
 * Validates determinism, immutability, non-decisional impact.
 */
import { describe, it, expect } from 'vitest';
import {
  buildSponsorMeshSnapshot,
  type SponsorNode,
  type SponsorSlot,
  type SponsorAllocationPolicy,
} from '@/lib/runtimeSponsorMonetizationMesh';
import {
  buildFinalDecision,
  type SponsorDecisionContext,
} from '@/lib/runtimeSponsorDecisionFinalizer';
import { computeFairnessLedger } from '@/lib/runtimeSponsorMonetizationMesh';
import {
  computeSaturationMap,
} from '@/lib/runtimeSponsorMonetizationMesh';
import { computeGeoMesh } from '@/lib/runtimeSponsorMonetizationMesh';
import { allocateAll } from '@/lib/runtimeSponsorMonetizationMesh';
import { buildAttributionTraces } from '@/lib/runtimeSponsorMonetizationMesh';
import {
  buildCampaigns,
  buildNodeToCampaignMap,
  resolveCampaignsFromMesh,
  correlateDecisionWithCampaigns,
  listCampaignsByLifecycle,
  buildCampaignIndex,
  assertCampaignSnapshotLocked,
  SPONSOR_CAMPAIGN_INTERNALS,
} from '@/lib/runtimeSponsorCampaignLayer';

const NODES: ReadonlyArray<SponsorNode> = Object.freeze([
  { id: 'n1', city: 'sp', category: 'plumber', tier: 'premium', qualityIndex: 0.9, active: true },
  { id: 'n2', city: 'sp', category: 'plumber', tier: 'pro', qualityIndex: 0.7, active: true },
  { id: 'n3', city: 'rj', category: 'plumber', tier: 'basic', qualityIndex: 0.4, active: false },
  { id: 'n4', city: 'sp', category: 'electrician', tier: 'premium', qualityIndex: 0.8, active: true },
  { id: 'n5', city: 'rj', category: 'electrician', tier: 'basic', qualityIndex: 0.3, active: false },
]);

const SLOTS: ReadonlyArray<SponsorSlot> = Object.freeze([
  { id: 's1', city: 'sp', category: 'plumber', capacity: 1, priority: 0.9 },
  { id: 's2', city: 'rj', category: 'plumber', capacity: 1, priority: 0.5 },
]);

const POLICY: SponsorAllocationPolicy = Object.freeze({
  maxExposurePerSponsorPerSlot: 3,
  maxShareDominance: 0.6,
  fairnessFloor: 0.1,
  geoBalanceWeight: 0.3,
});

function buildDecisionContext(): SponsorDecisionContext {
  const mesh = buildSponsorMeshSnapshot(NODES, SLOTS, [], POLICY);
  const fairness = computeFairnessLedger(mesh.nodes, mesh.exposures, POLICY);
  const saturation = computeSaturationMap(mesh.nodes, mesh.exposures, POLICY);
  const geo = computeGeoMesh(mesh.nodes, []);
  const allocations = allocateAll(mesh.nodes, mesh.slots, fairness, saturation, POLICY);
  const attribution = buildAttributionTraces(mesh.nodes, mesh.edges, allocations);
  return {
    nodes: mesh.nodes,
    slots: mesh.slots,
    exposures: mesh.exposures,
    quality: [],
    fairness,
    saturation,
    geo,
    allocations,
    attribution,
    policy: POLICY,
  };
}

describe('Phase 1.9.16 · Sponsor Campaign Abstraction Layer', () => {
  it('groups nodes deterministically by (category, city)', () => {
    const c1 = buildCampaigns({ nodes: NODES });
    const c2 = buildCampaigns({ nodes: [...NODES].reverse() });
    expect(c1.map((c) => c.campaignId)).toEqual(c2.map((c) => c.campaignId));
    // 4 distinct buckets: plumber/sp, plumber/rj, electrician/sp, electrician/rj
    expect(c1.length).toBe(4);
  });

  it('produces stable campaignId across runs', () => {
    const a = buildCampaigns({ nodes: NODES });
    const b = buildCampaigns({ nodes: NODES });
    expect(a.map((c) => c.snapshotSignature)).toEqual(b.map((c) => c.snapshotSignature));
  });

  it('node→campaign map is exhaustive and deterministic', () => {
    const c = buildCampaigns({ nodes: NODES });
    const map = buildNodeToCampaignMap(c);
    for (const n of NODES) expect(map[n.id]).toBeDefined();
    expect(Object.isFrozen(map)).toBe(true);
  });

  it('snapshot is locked, frozen, and signed', () => {
    const mesh = buildSponsorMeshSnapshot(NODES, SLOTS, [], POLICY);
    const snap = resolveCampaignsFromMesh(mesh);
    expect(snap.locked).toBe(true);
    expect(snap.version).toBe('1.9.16');
    expect(snap.signature).toMatch(/^[0-9a-f]{8}$/);
    expect(() => assertCampaignSnapshotLocked(snap)).not.toThrow();
    expect(Object.isFrozen(snap.campaigns)).toBe(true);
    expect(Object.isFrozen(snap.nodeToCampaign)).toBe(true);
  });

  it('internals forbid decisional impact, billing, scheduling', () => {
    expect(SPONSOR_CAMPAIGN_INTERNALS.decisionalImpactAllowed).toBe(false);
    expect(SPONSOR_CAMPAIGN_INTERNALS.billingEnabled).toBe(false);
    expect(SPONSOR_CAMPAIGN_INTERNALS.pricingEnabled).toBe(false);
    expect(SPONSOR_CAMPAIGN_INTERNALS.schedulingEnabled).toBe(false);
    expect(SPONSOR_CAMPAIGN_INTERNALS.liveExecutionEnabled).toBe(false);
  });

  it('lifecycle reflects active flag aggregate', () => {
    const c = buildCampaigns({ nodes: NODES });
    const byKey = new Map(c.map((x) => [x.geoScope.join(',') + '|' + x.categoryScope.join(','), x]));
    expect(byKey.get('sp|plumber')!.lifecycleState).toBe('ACTIVE');
    expect(byKey.get('rj|plumber')!.lifecycleState).toBe('PAUSED');
  });

  it('exposureIntentVector shares sum to 1', () => {
    const c = buildCampaigns({ nodes: NODES });
    for (const camp of c) {
      const sum = camp.exposureIntentVector.premiumShare +
        camp.exposureIntentVector.proShare +
        camp.exposureIntentVector.basicShare;
      expect(Math.abs(sum - 1) < 1e-9).toBe(true);
    }
  });

  it('campaign index is deterministic and sorted', () => {
    const c = buildCampaigns({ nodes: NODES });
    const idx1 = buildCampaignIndex(c);
    const idx2 = buildCampaignIndex([...c].reverse());
    expect(idx1.byNodeDensity).toEqual(idx2.byNodeDensity);
    expect(idx1.byAggregatedWeight).toEqual(idx2.byAggregatedWeight);
    expect(idx1.byCategory).toEqual(idx2.byCategory);
    expect(idx1.byGeo).toEqual(idx2.byGeo);
  });

  it('does NOT alter Decision Finalizer output (bit-equivalent)', () => {
    const ctxA = buildDecisionContext();
    const decisionBefore = buildFinalDecision(ctxA);

    // Build campaigns from the same nodes — must not touch anything.
    const mesh = buildSponsorMeshSnapshot(NODES, SLOTS, [], POLICY);
    const campaignSnap = resolveCampaignsFromMesh(mesh);

    const ctxB = buildDecisionContext();
    const decisionAfter = buildFinalDecision(ctxB);

    expect(decisionAfter.signature).toBe(decisionBefore.signature);
    expect(decisionAfter.assignments).toEqual(decisionBefore.assignments);
    expect(decisionAfter.orderedSlots).toEqual(decisionBefore.orderedSlots);

    // Correlation is purely projective.
    const corr = correlateDecisionWithCampaigns(decisionAfter, campaignSnap);
    expect(Object.isFrozen(corr)).toBe(true);
    for (const slotId of decisionAfter.orderedSlots) {
      expect(slotId in corr).toBe(true);
    }
  });

  it('listCampaignsByLifecycle returns a frozen filtered slice', () => {
    const c = buildCampaigns({ nodes: NODES });
    const active = listCampaignsByLifecycle(c, 'ACTIVE');
    expect(Object.isFrozen(active)).toBe(true);
    expect(active.every((x) => x.lifecycleState === 'ACTIVE')).toBe(true);
  });

  it('handles empty nodes set without throwing', () => {
    const empty = buildCampaigns({ nodes: [] });
    expect(empty.length).toBe(0);
    const map = buildNodeToCampaignMap(empty);
    expect(Object.keys(map).length).toBe(0);
  });

  it('derived weight is bounded in [0,1]', () => {
    const c = buildCampaigns({ nodes: NODES });
    for (const camp of c) {
      expect(camp.derivedCampaignWeight).toBeGreaterThanOrEqual(0);
      expect(camp.derivedCampaignWeight).toBeLessThanOrEqual(1);
    }
  });
});
