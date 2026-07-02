/**
 * Phase 1.9.17 — Sponsor Temporal Evolution Engine · Test Suite.
 * Validates determinism, immutability, non-decisional/non-campaign impact,
 * bit-identical reproducibility, and absence of real-clock dependency.
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
import {
  resolveCampaignsFromMesh,
} from '@/lib/runtimeSponsorCampaignLayer';
import {
  buildTemporalSnapshot,
  projectFutureState,
  applyExposureDecayVector,
  computePacingWindow,
  correlateDecisionWithTemporalFrames,
  listFramesByLifecycle,
  assertTemporalSnapshotLocked,
  SPONSOR_TEMPORAL_INTERNALS,
} from '@/lib/runtimeSponsorTemporalEvolutionEngine';

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

function buildPipeline() {
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
  return { mesh, decision, campaigns };
}

describe('Phase 1.9.17 · SponsorTemporalEvolutionEngine', () => {
  it('invariants: internals are read-only / non-mutational', () => {
    expect(SPONSOR_TEMPORAL_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_TEMPORAL_INTERNALS.realClockAllowed).toBe(false);
    expect(SPONSOR_TEMPORAL_INTERNALS.decisionalImpactAllowed).toBe(false);
    expect(SPONSOR_TEMPORAL_INTERNALS.campaignMutationAllowed).toBe(false);
    expect(SPONSOR_TEMPORAL_INTERNALS.billingEnabled).toBe(false);
    expect(SPONSOR_TEMPORAL_INTERNALS.schedulingEnabled).toBe(false);
    expect(Object.isFrozen(SPONSOR_TEMPORAL_INTERNALS)).toBe(true);
  });

  it('tick=0: projections preserve campaign intensity/weight bit-identically', () => {
    const { campaigns } = buildPipeline();
    const snap = buildTemporalSnapshot(campaigns, 0);
    expect(snap.tick.index).toBe(0);
    expect(snap.frames.length).toBe(campaigns.campaigns.length);

    for (const c of campaigns.campaigns) {
      const frame = snap.frames.find((f) => f.campaignId === c.campaignId)!;
      expect(frame.decay.cumulativeMultiplier).toBe(1);
      expect(frame.pacing.pacingFactor).toBe(1);
      expect(frame.timeSlice.projectedIntensity).toBe(c.exposureIntentVector.intensity);
      expect(frame.timeSlice.projectedWeight).toBe(c.derivedCampaignWeight);
      expect(frame.timeSlice.projectedLifecycle).toBe(c.lifecycleState);
    }
  });

  it('determinism: same tick → same signature (repeated)', () => {
    const { campaigns } = buildPipeline();
    const a = buildTemporalSnapshot(campaigns, 5);
    const b = buildTemporalSnapshot(campaigns, 5);
    const c = buildTemporalSnapshot(campaigns, 5);
    expect(a.signature).toBe(b.signature);
    expect(b.signature).toBe(c.signature);
    for (let i = 0; i < a.frames.length; i++) {
      expect(a.frames[i].frameSignature).toBe(b.frames[i].frameSignature);
    }
  });

  it('different ticks produce different signatures (decay/pacing active)', () => {
    const { campaigns } = buildPipeline();
    const t0 = buildTemporalSnapshot(campaigns, 0);
    const t3 = buildTemporalSnapshot(campaigns, 3);
    expect(t0.signature).not.toBe(t3.signature);
    // Decay must reduce intensity for active campaigns at tick>0.
    for (const f of t3.frames) {
      const orig = campaigns.campaigns.find((c) => c.campaignId === f.campaignId)!;
      if (orig.exposureIntentVector.intensity > 0) {
        expect(f.decay.cumulativeMultiplier).toBeLessThan(1);
        expect(f.timeSlice.projectedIntensity).toBeLessThanOrEqual(
          orig.exposureIntentVector.intensity,
        );
      }
    }
  });

  it('does NOT mutate decision or campaign snapshots (bit-identical signatures)', () => {
    const { decision, campaigns } = buildPipeline();
    const decisionSigBefore = decision.signature;
    const campaignSigBefore = campaigns.signature;

    buildTemporalSnapshot(campaigns, 0, {}, decision);
    buildTemporalSnapshot(campaigns, 12, {}, decision);
    projectFutureState(campaigns, 0, 10);

    expect(decision.signature).toBe(decisionSigBefore);
    expect(campaigns.signature).toBe(campaignSigBefore);
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(campaigns)).toBe(true);
  });

  it('projectFutureState produces N+1 snapshots with stable per-tick signatures', () => {
    const { campaigns } = buildPipeline();
    const series = projectFutureState(campaigns, 0, 4);
    expect(series.length).toBe(5);
    for (let i = 0; i < series.length; i++) {
      expect(series[i].tick.index).toBe(i);
      const repeat = buildTemporalSnapshot(campaigns, i);
      expect(series[i].signature).toBe(repeat.signature);
    }
  });

  it('snapshots are deeply frozen and lockable', () => {
    const { campaigns } = buildPipeline();
    const snap = buildTemporalSnapshot(campaigns, 2);
    assertTemporalSnapshotLocked(snap);
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.frames)).toBe(true);
    expect(() => {
      (snap as unknown as { frames: unknown[] }).frames = [];
    }).toThrow();
  });

  it('decay is reproducible and obeys override', () => {
    const { campaigns } = buildPipeline();
    const c = campaigns.campaigns[0];
    const d1 = applyExposureDecayVector(c, 4);
    const d2 = applyExposureDecayVector(c, 4);
    expect(d1).toEqual(d2);

    const dOverride = applyExposureDecayVector(c, 4, {
      decayOverrides: { [c.campaignId]: 0.5 },
    });
    expect(dOverride.decayPerTick).toBe(0.5);
    expect(dOverride.cumulativeMultiplier).toBeCloseTo(0.0625, 10);
  });

  it('pacing window is triangular, deterministic, and tick=0 is full budget', () => {
    const { campaigns } = buildPipeline();
    const c = campaigns.campaigns[0];
    const p0 = computePacingWindow(c, 0);
    expect(p0.pacingFactor).toBe(1);

    const w = 7;
    const factors: number[] = [];
    for (let t = 0; t < w; t++) {
      factors.push(computePacingWindow(c, t, { defaultPacingWindow: w }).pacingFactor);
    }
    // Repeats next window
    for (let t = 0; t < w; t++) {
      const same = computePacingWindow(c, t + w, { defaultPacingWindow: w }).pacingFactor;
      // tick=0 returns 1 but tick=w follows triangular formula → may differ; check periodicity for t>=1
      if (t >= 1) expect(same).toBeCloseTo(factors[t], 10);
    }
  });

  it('correlation maps decision slots → projected exposures without mutating inputs', () => {
    const { decision, campaigns } = buildPipeline();
    const snap = buildTemporalSnapshot(campaigns, 1);
    const map = correlateDecisionWithTemporalFrames(decision, campaigns, snap);
    for (const entry of decision.entries) {
      expect(Object.prototype.hasOwnProperty.call(map, entry.slotId)).toBe(true);
      const v = map[entry.slotId];
      if (v !== null) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(Object.isFrozen(map)).toBe(true);
  });

  it('listFramesByLifecycle filters without mutating', () => {
    const { campaigns } = buildPipeline();
    const snap = buildTemporalSnapshot(campaigns, 0);
    const active = listFramesByLifecycle(snap, 'ACTIVE');
    for (const f of active) {
      expect(f.timeSlice.projectedLifecycle).toBe('ACTIVE');
    }
    expect(Object.isFrozen(active)).toBe(true);
  });

  it('source code is free of real-clock / live-runtime dependencies (no Date.now / no timers)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.resolve(process.cwd(), 'src/lib/runtimeSponsorTemporalEvolutionEngine');
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
