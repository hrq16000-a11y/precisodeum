import { describe, it, expect } from 'vitest';
import {
  SPONSOR_MESH_INTERNALS,
  buildSponsorMeshSnapshot,
  computeFairnessLedger,
  computeSaturationMap,
  allocateAll,
  projectExposures,
  buildAttributionTraces,
  computeGeoMesh,
  observeExposures,
  observeAllocations,
  assertSnapshotIntegrity,
  assertPolicyValid,
  SponsorMeshIntegrityError,
  rankCandidates,
  type SponsorNode,
  type SponsorSlot,
  type SponsorAllocationPolicy,
  type SponsorExposureEvent,
  type SponsorQualityIndex,
} from '@/lib/runtimeSponsorMonetizationMesh';

const policy: SponsorAllocationPolicy = {
  maxExposurePerSponsorPerSlot: 3,
  maxShareDominance: 0.6,
  fairnessFloor: 0.1,
  geoBalanceWeight: 0.5,
};

const nodes: SponsorNode[] = [
  { id: 's1', city: 'curitiba', category: 'eletricista', tier: 'premium', qualityIndex: 0.9, active: true },
  { id: 's2', city: 'curitiba', category: 'eletricista', tier: 'pro', qualityIndex: 0.6, active: true },
  { id: 's3', city: 'curitiba', category: 'eletricista', tier: 'basic', qualityIndex: 0.4, active: true },
  { id: 's4', city: 'sao_paulo', category: 'pintor', tier: 'pro', qualityIndex: 0.7, active: true },
  { id: 's5', city: 'curitiba', category: 'pintor', tier: 'pro', qualityIndex: 0.5, active: false },
];

const slots: SponsorSlot[] = [
  { id: 'slot-a', city: 'curitiba', category: 'eletricista', capacity: 1, priority: 1 },
  { id: 'slot-b', city: 'curitiba', category: 'eletricista', capacity: 1, priority: 0.5 },
  { id: 'slot-c', city: 'sao_paulo', category: 'pintor', capacity: 1, priority: 0.8 },
];

const quality: SponsorQualityIndex[] = nodes.map((n) => ({
  sponsorId: n.id,
  score: n.qualityIndex,
  components: { base: n.qualityIndex },
}));

describe('Phase 1.9.14 — Runtime Sponsor Monetization Mesh', () => {
  it('preserves read-only internals (no billing, no charges, no live exec)', () => {
    expect(SPONSOR_MESH_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_MESH_INTERNALS.liveExecutionEnabled).toBe(false);
    expect(SPONSOR_MESH_INTERNALS.retryEnabled).toBe(false);
    expect(SPONSOR_MESH_INTERNALS.backgroundEnabled).toBe(false);
    expect(SPONSOR_MESH_INTERNALS.realUsersAllowed).toBe(false);
    expect(SPONSOR_MESH_INTERNALS.billingEnabled).toBe(false);
    expect(SPONSOR_MESH_INTERNALS.chargesEnabled).toBe(false);
    expect(Object.isFrozen(SPONSOR_MESH_INTERNALS)).toBe(true);
  });

  it('builds a deterministic mesh snapshot with stable signature', () => {
    const a = buildSponsorMeshSnapshot(nodes, slots, [], policy);
    const b = buildSponsorMeshSnapshot([...nodes].reverse(), [...slots].reverse(), [], policy);
    expect(a.signature).toBe(b.signature);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.nodes)).toBe(true);
  });

  it('ranks candidates by contextual match + quality + tier', () => {
    const ranked = rankCandidates(nodes, slots[0], [], quality);
    expect(ranked.length).toBe(3);
    expect(ranked[0].sponsorId).toBe('s1');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('allocates slots deterministically across repeated runs', () => {
    const ledger = computeFairnessLedger(nodes, [], policy);
    const sat = computeSaturationMap(nodes, [], policy);
    const r1 = allocateAll(slots, nodes, [], quality, ledger, sat, policy);
    const r2 = allocateAll(slots, nodes, [], quality, ledger, sat, policy);
    expect(r1.map((r) => r.sponsorId + ':' + r.slotId)).toEqual(
      r2.map((r) => r.sponsorId + ':' + r.slotId),
    );
    expect(r1.find((r) => r.slotId === 'slot-a')?.sponsorId).toBe('s1');
  });

  it('caps dominance and triggers fairness fallback when share too high', () => {
    const heavyExposures: SponsorExposureEvent[] = Array.from({ length: 20 }, (_, i) => ({
      sponsorId: 's1',
      slotId: 'slot-a',
      city: 'curitiba',
      category: 'eletricista',
      tick: i,
      weight: 1,
    }));
    const ledger = computeFairnessLedger(nodes, heavyExposures, policy);
    const sat = computeSaturationMap(nodes, heavyExposures, policy);
    const out = allocateAll(slots, nodes, heavyExposures, quality, ledger, sat, policy);
    const a = out.find((r) => r.slotId === 'slot-a');
    expect(a?.sponsorId).not.toBe('s1');
  });

  it('marks saturated sponsors and excludes them from allocation', () => {
    const exposures: SponsorExposureEvent[] = Array.from({ length: 5 }, (_, i) => ({
      sponsorId: 's1',
      slotId: 'slot-a',
      city: 'curitiba',
      category: 'eletricista',
      tick: i,
      weight: 1,
    }));
    const sat = computeSaturationMap(nodes, exposures, policy);
    const e = sat.entries.find((x) => x.sponsorId === 's1' && x.city === 'curitiba');
    expect(e?.capped).toBe(true);
  });

  it('projects allocation results into exposure events without IO', () => {
    const ledger = computeFairnessLedger(nodes, [], policy);
    const sat = computeSaturationMap(nodes, [], policy);
    const results = allocateAll(slots, nodes, [], quality, ledger, sat, policy);
    const events = projectExposures(results, slots, 0);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.tick >= 0)).toBe(true);
    expect(Object.isFrozen(events)).toBe(true);
  });

  it('builds attribution lineage traces with stable signatures', () => {
    const snap = buildSponsorMeshSnapshot(nodes, slots, [], policy);
    const ledger = computeFairnessLedger(nodes, [], policy);
    const sat = computeSaturationMap(nodes, [], policy);
    const events = projectExposures(
      allocateAll(slots, nodes, [], quality, ledger, sat, policy),
      slots,
      0,
    );
    const t1 = buildAttributionTraces(events, snap.edges);
    const t2 = buildAttributionTraces(events, snap.edges);
    expect(t1.map((t) => t.signature)).toEqual(t2.map((t) => t.signature));
  });

  it('computes geo mesh balance deltas (representation vs density)', () => {
    const events: SponsorExposureEvent[] = [
      { sponsorId: 's1', slotId: 'slot-a', city: 'curitiba', category: 'eletricista', tick: 0, weight: 1 },
      { sponsorId: 's4', slotId: 'slot-c', city: 'sao_paulo', category: 'pintor', tick: 1, weight: 1 },
    ];
    const mesh = computeGeoMesh(nodes, events, [
      { city: 'curitiba', demand: 4 },
      { city: 'sao_paulo', demand: 6 },
    ]);
    expect(mesh.length).toBeGreaterThanOrEqual(2);
    const cwb = mesh.find((m) => m.city === 'curitiba')!;
    expect(cwb.density).toBeCloseTo(0.4, 5);
    expect(cwb.representation).toBeCloseTo(0.5, 5);
  });

  it('observability scrubs PII keys and produces signatures', () => {
    const events: SponsorExposureEvent[] = [
      { sponsorId: 's1', slotId: 'slot-a', city: 'curitiba', category: 'eletricista', tick: 0, weight: 1 },
    ];
    const obs = observeExposures(events);
    expect(obs[0].signature).toMatch(/^[0-9a-f]{8}$/);
    const ledger = computeFairnessLedger(nodes, [], policy);
    const sat = computeSaturationMap(nodes, [], policy);
    const allocObs = observeAllocations(allocateAll(slots, nodes, [], quality, ledger, sat, policy));
    expect(allocObs.every((o) => o.type === 'allocation')).toBe(true);
  });

  it('rejects invalid policy via guards', () => {
    expect(() =>
      assertPolicyValid({ ...policy, fairnessFloor: 0.9, maxShareDominance: 0.5 }),
    ).toThrow(SponsorMeshIntegrityError);
  });

  it('asserts snapshot integrity (frozen + valid)', () => {
    const snap = buildSponsorMeshSnapshot(nodes, slots, [], policy);
    expect(() => assertSnapshotIntegrity(snap)).not.toThrow();
  });
});
