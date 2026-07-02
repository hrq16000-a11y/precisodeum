/**
 * Phase 1.9.18 — Sponsor Consumption Contract · Test Suite.
 * Validates: bit-stable serialization, upstream isolation, version stability,
 * absence of internal leakage, stand-alone consumability.
 */
import { describe, it, expect } from 'vitest';
import {
  buildSponsorMeshSnapshot,
  computeFairnessLedger,
  computeSaturationMap,
  computeGeoMesh,
  allocateAll,
  buildAttributionTraces,
  type SponsorNode,
  type SponsorSlot,
  type SponsorAllocationPolicy,
} from '@/lib/runtimeSponsorMonetizationMesh';
import {
  buildFinalDecision,
  type SponsorDecisionContext,
} from '@/lib/runtimeSponsorDecisionFinalizer';
import { resolveCampaignsFromMesh } from '@/lib/runtimeSponsorCampaignLayer';
import { buildTemporalSnapshot } from '@/lib/runtimeSponsorTemporalEvolutionEngine';
import {
  buildContractSnapshot,
  serializeContractPayload,
  mapToConsumptionPayload,
  validateConsumptionPayload,
  assertNoInternalLeakage,
  assertContractSnapshotLocked,
  SPONSOR_CONTRACT_INTERNALS,
} from '@/lib/runtimeSponsorConsumptionContract';

const NODES: ReadonlyArray<SponsorNode> = Object.freeze([
  { id: 'n1', city: 'sp', category: 'plumber', tier: 'premium', qualityIndex: 0.9, active: true },
  { id: 'n2', city: 'sp', category: 'plumber', tier: 'pro', qualityIndex: 0.7, active: true },
  { id: 'n3', city: 'rj', category: 'plumber', tier: 'basic', qualityIndex: 0.4, active: false },
  { id: 'n4', city: 'sp', category: 'electrician', tier: 'premium', qualityIndex: 0.8, active: true },
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

function buildPipeline(tick = 0) {
  const mesh = buildSponsorMeshSnapshot(NODES, SLOTS, [], POLICY);
  const fairness = computeFairnessLedger(mesh.nodes, mesh.exposures, POLICY);
  const saturation = computeSaturationMap(mesh.nodes, mesh.exposures, POLICY);
  const geo = computeGeoMesh(mesh.nodes, mesh.exposures, []);
  const allocations = allocateAll(mesh.slots, mesh.nodes, mesh.exposures, [], fairness, saturation, POLICY);
  const attribution = buildAttributionTraces(mesh.exposures, mesh.edges);
  const ctx: SponsorDecisionContext = {
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
  const decision = buildFinalDecision(ctx);
  const campaigns = resolveCampaignsFromMesh(mesh);
  const temporal = buildTemporalSnapshot(campaigns, tick);
  return { decision, campaigns, temporal };
}

describe('Phase 1.9.18 · SponsorConsumptionContract', () => {
  it('internals: read-only / non-mutational / non-leaking', () => {
    expect(SPONSOR_CONTRACT_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_CONTRACT_INTERNALS.recalculationAllowed).toBe(false);
    expect(SPONSOR_CONTRACT_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_CONTRACT_INTERNALS.internalLeakageAllowed).toBe(false);
    expect(SPONSOR_CONTRACT_INTERNALS.billingEnabled).toBe(false);
    expect(Object.isFrozen(SPONSOR_CONTRACT_INTERNALS)).toBe(true);
  });

  it('contract version is v1 and meta is consistent', () => {
    const { decision, campaigns, temporal } = buildPipeline(0);
    const snap = buildContractSnapshot(decision, campaigns, temporal);
    expect(snap.contractVersion).toBe('v1');
    expect(snap.payload.meta.version).toBe('v1');
    expect(snap.payload.meta.slotCount).toBe(snap.payload.slots.length);
    expect(snap.payload.meta.campaignCount).toBe(snap.payload.campaigns.length);
    expect(snap.payload.meta.tickIndex).toBe(0);
    expect(snap.payload.temporal.tickIndex).toBe(0);
  });

  it('determinism: same inputs → bit-identical signature and serialization', () => {
    const a = buildPipeline(3);
    const b = buildPipeline(3);
    const snapA = buildContractSnapshot(a.decision, a.campaigns, a.temporal);
    const snapB = buildContractSnapshot(b.decision, b.campaigns, b.temporal);
    expect(snapA.signature).toBe(snapB.signature);
    expect(serializeContractPayload(snapA)).toBe(serializeContractPayload(snapB));
  });

  it('different ticks produce different external signatures (temporal flows through)', () => {
    const { decision, campaigns, temporal: t0 } = buildPipeline(0);
    const { temporal: t5 } = buildPipeline(5);
    const snap0 = buildContractSnapshot(decision, campaigns, t0);
    const snap5 = buildContractSnapshot(decision, campaigns, t5);
    expect(snap0.signature).not.toBe(snap5.signature);
  });

  it('does NOT mutate upstream decision / campaign / temporal snapshots', () => {
    const { decision, campaigns, temporal } = buildPipeline(2);
    const dSig = decision.signature;
    const cSig = campaigns.signature;
    const tSig = temporal.signature;
    const snap = buildContractSnapshot(decision, campaigns, temporal);
    expect(decision.signature).toBe(dSig);
    expect(campaigns.signature).toBe(cSig);
    expect(temporal.signature).toBe(tSig);
    expect(snap.upstreamSignatures.decision).toBe(dSig);
    expect(snap.upstreamSignatures.campaign).toBe(cSig);
    expect(snap.upstreamSignatures.temporal).toBe(tSig);
  });

  it('payload is deeply frozen and lockable', () => {
    const { decision, campaigns, temporal } = buildPipeline(1);
    const snap = buildContractSnapshot(decision, campaigns, temporal);
    assertContractSnapshotLocked(snap);
    expect(Object.isFrozen(snap.payload)).toBe(true);
    expect(Object.isFrozen(snap.payload.slots)).toBe(true);
    expect(Object.isFrozen(snap.payload.campaigns)).toBe(true);
    expect(() => {
      (snap.payload as unknown as { slots: unknown[] }).slots = [];
    }).toThrow();
  });

  it('no internal-shape leakage in payload (validator + explicit assertion)', () => {
    const { decision, campaigns, temporal } = buildPipeline(0);
    const payload = mapToConsumptionPayload(decision, campaigns, temporal);
    validateConsumptionPayload(payload);
    assertNoInternalLeakage(payload);
    // Specifically verify forbidden internal keys are absent
    const json = JSON.stringify(payload);
    for (const forbidden of [
      'sponsorNodeIds',
      'exposureIntentVector',
      'snapshotSignature',
      'allocationEligibilityWindow',
      'derivedCampaignWeight',
      'rankingScore',
      'fairnessWeight',
      'saturationPenalty',
      'frameSignature',
    ]) {
      expect(json.includes(`"${forbidden}"`)).toBe(false);
    }
  });

  it('slot entries are stably ordered by priority then slotId', () => {
    const { decision, campaigns, temporal } = buildPipeline(0);
    const snap = buildContractSnapshot(decision, campaigns, temporal);
    for (let i = 1; i < snap.payload.slots.length; i++) {
      const a = snap.payload.slots[i - 1];
      const b = snap.payload.slots[i];
      expect(a.priority).toBeLessThanOrEqual(b.priority);
      if (a.priority === b.priority) {
        expect(a.slotId.localeCompare(b.slotId)).toBeLessThanOrEqual(0);
      }
    }
  });

  it('campaigns are stably ordered by campaignId', () => {
    const { decision, campaigns, temporal } = buildPipeline(0);
    const snap = buildContractSnapshot(decision, campaigns, temporal);
    for (let i = 1; i < snap.payload.campaigns.length; i++) {
      expect(
        snap.payload.campaigns[i - 1].campaignId.localeCompare(
          snap.payload.campaigns[i].campaignId,
        ),
      ).toBeLessThanOrEqual(0);
    }
  });

  it('serialization is byte-stable across calls', () => {
    const { decision, campaigns, temporal } = buildPipeline(7);
    const snap = buildContractSnapshot(decision, campaigns, temporal);
    const s1 = serializeContractPayload(snap);
    const s2 = serializeContractPayload(snap);
    const s3 = serializeContractPayload(snap);
    expect(s1).toBe(s2);
    expect(s2).toBe(s3);
  });

  it('contract layer can be consumed without importing upstream types', () => {
    // Simulating an external consumer that knows only the contract surface.
    const { decision, campaigns, temporal } = buildPipeline(0);
    const snap = buildContractSnapshot(decision, campaigns, temporal);
    const payload = snap.payload;
    // External consumer sees only: contractVersion, meta, slots, campaigns, temporal
    expect(Object.keys(payload).sort()).toEqual(
      ['campaigns', 'contractVersion', 'meta', 'slots', 'temporal'].sort(),
    );
  });

  it('source code is free of real-clock / live-runtime dependencies', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.resolve(process.cwd(), 'src/lib/runtimeSponsorConsumptionContract');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
    const forbidden = [
      'Date.now',
      'setTimeout',
      'setInterval',
      'queueMicrotask',
      'Math.random',
      'performance.now',
      'fetch(',
      'XMLHttpRequest',
      'WebSocket',
      'localStorage',
      'sessionStorage',
    ];
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const token of forbidden) {
        expect(src.includes(token), `${f} contains forbidden token: ${token}`).toBe(false);
      }
    }
  });
});
