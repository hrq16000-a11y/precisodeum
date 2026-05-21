/**
 * Phase 1.9.21 — Sponsor Distributed Consistency · Test Suite.
 * Global parity, drift detection, reconciliation, regression 1.9.14–1.9.20.
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
import { buildContractSnapshot } from '@/lib/runtimeSponsorConsumptionContract';
import type { SponsorAPIRequest } from '@/lib/runtimeSponsorAPIProductIntegrationLayer';
import {
  SponsorProductSurfaceStabilizationLayer,
  type SponsorEdgeConsistencyEnvelope,
} from '@/lib/runtimeSponsorProductSurfaceStabilization';
import {
  SponsorDistributedConsistencyOrchestrator,
  SPONSOR_CONSISTENCY_INTERNALS,
  SponsorConsistencyDriftError,
  type SponsorGlobalConsistencyNode,
} from '@/lib/runtimeSponsorDistributedConsistency';

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

function buildContract(tick = 0) {
  const mesh = buildSponsorMeshSnapshot(NODES, SLOTS, [], POLICY);
  const fairness = computeFairnessLedger(mesh.nodes, mesh.exposures, POLICY);
  const saturation = computeSaturationMap(mesh.nodes, mesh.exposures, POLICY);
  const geo = computeGeoMesh(mesh.nodes, mesh.exposures, []);
  const allocations = allocateAll(
    mesh.slots,
    mesh.nodes,
    mesh.exposures,
    [],
    fairness,
    saturation,
    POLICY,
  );
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
  return buildContractSnapshot(decision, campaigns, temporal);
}

const REQ: SponsorAPIRequest = Object.freeze({
  apiVersion: 'v1',
  consumerId: 'consumer-A',
  consumerKind: 'frontend',
});

const NODE_NA: SponsorGlobalConsistencyNode = Object.freeze({
  nodeId: 'edge-na-1',
  nodeRegion: 'edge-na',
  orderingIndex: 0,
});
const NODE_SA: SponsorGlobalConsistencyNode = Object.freeze({
  nodeId: 'edge-sa-9',
  nodeRegion: 'edge-sa',
  orderingIndex: 1,
});
const NODE_EU: SponsorGlobalConsistencyNode = Object.freeze({
  nodeId: 'edge-eu-2',
  nodeRegion: 'edge-eu',
  orderingIndex: 2,
});
const NODE_AP: SponsorGlobalConsistencyNode = Object.freeze({
  nodeId: 'edge-ap-7',
  nodeRegion: 'edge-ap',
  orderingIndex: 3,
});

function envelopeFromNode(
  surface: SponsorProductSurfaceStabilizationLayer,
  node: SponsorGlobalConsistencyNode,
  req: SponsorAPIRequest = REQ,
  cachedHit = false,
): SponsorEdgeConsistencyEnvelope {
  return surface.enforceIdempotentResponse(req, {
    nodeId: node.nodeId,
    nodeRegion: node.nodeRegion,
    invocationIndex: node.orderingIndex * 1000 + 7,
    cachedHit,
  });
}

describe('Phase 1.9.21 · SponsorDistributedConsistencyOrchestrator', () => {
  it('internals: stateless, read-only, no real infra, no heuristic reconciliation', () => {
    expect(SPONSOR_CONSISTENCY_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_CONSISTENCY_INTERNALS.statelessOrchestration).toBe(true);
    expect(SPONSOR_CONSISTENCY_INTERNALS.readOnlyUpstream).toBe(true);
    expect(SPONSOR_CONSISTENCY_INTERNALS.payloadMutationAllowed).toBe(false);
    expect(SPONSOR_CONSISTENCY_INTERNALS.recalculationAllowed).toBe(false);
    expect(SPONSOR_CONSISTENCY_INTERNALS.realInfrastructureAllowed).toBe(false);
    expect(SPONSOR_CONSISTENCY_INTERNALS.probabilisticReconciliationAllowed).toBe(false);
    expect(SPONSOR_CONSISTENCY_INTERNALS.heuristicTieBreakingAllowed).toBe(false);
  });

  it('multiple simulated nodes → bit-identical equivalence matrix (no drift)', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const orchestrator = new SponsorDistributedConsistencyOrchestrator();
    const ctx = orchestrator.buildContext({
      orchestrationId: 'orch-1',
      entries: [
        { node: NODE_NA, envelope: envelopeFromNode(surface, NODE_NA, REQ, false) },
        { node: NODE_SA, envelope: envelopeFromNode(surface, NODE_SA, REQ, true) },
        { node: NODE_EU, envelope: envelopeFromNode(surface, NODE_EU, REQ, false) },
        { node: NODE_AP, envelope: envelopeFromNode(surface, NODE_AP, REQ, true) },
      ],
    });
    const matrix = orchestrator.computeNodeEquivalenceMatrix(ctx);
    expect(matrix.equivalent).toBe(true);
    expect(matrix.divergences.length).toBe(0);
    expect(new Set(matrix.frames.map((f) => f.compositeFingerprint)).size).toBe(1);
    expect(new Set(matrix.frames.map((f) => f.stabilityToken)).size).toBe(1);
    expect(new Set(matrix.frames.map((f) => f.idempotencyDigest)).size).toBe(1);
  });

  it('validateCrossNodeParity does not throw when inputs are identical', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const orchestrator = new SponsorDistributedConsistencyOrchestrator();
    const ctx = orchestrator.buildContext({
      orchestrationId: 'orch-parity',
      entries: [
        { node: NODE_NA, envelope: envelopeFromNode(surface, NODE_NA) },
        { node: NODE_SA, envelope: envelopeFromNode(surface, NODE_SA) },
      ],
    });
    expect(() => orchestrator.validateCrossNodeParity(ctx)).not.toThrow();
  });

  it('drift detection fires ONLY when underlying input changes (different request)', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const orchestrator = new SponsorDistributedConsistencyOrchestrator();
    const reqA = REQ;
    const reqB: SponsorAPIRequest = { ...REQ, cityFilter: 'sp' };
    const ctx = orchestrator.buildContext({
      orchestrationId: 'orch-drift',
      entries: [
        { node: NODE_NA, envelope: envelopeFromNode(surface, NODE_NA, reqA) },
        { node: NODE_SA, envelope: envelopeFromNode(surface, NODE_SA, reqB) },
      ],
    });
    const matrix = orchestrator.computeNodeEquivalenceMatrix(ctx);
    const report = orchestrator.detectDeterministicDrift(matrix);
    expect(report.hasDrift).toBe(true);
    expect(report.divergentNodes).toContain(NODE_SA.nodeId);
    expect(() => orchestrator.validateCrossNodeParity(ctx)).toThrow(SponsorConsistencyDriftError);
  });

  it('reconciliation never mutates payload — canonical envelope is the input envelope (lexicographic tie-break)', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const orchestrator = new SponsorDistributedConsistencyOrchestrator();
    const eNA = envelopeFromNode(surface, NODE_NA);
    const eSA = envelopeFromNode(surface, NODE_SA);
    const ctx = orchestrator.buildContext({
      orchestrationId: 'orch-recon',
      entries: [
        { node: NODE_SA, envelope: eSA },
        { node: NODE_NA, envelope: eNA },
      ],
    });
    const vec = orchestrator.reconcileExecutionFrames(ctx);
    // Lexicographic tie-break across equivalent nodes
    expect(vec.canonicalNodeId).toBe('edge-na-1');
    expect(vec.canonicalEnvelope).toBe(eNA);
    // Payload reference preserved (identity), zero mutation
    expect(vec.canonicalEnvelope.response).toBe(eNA.response);
  });

  it('global envelope is locked, deterministic, and auditable', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const orchestrator = new SponsorDistributedConsistencyOrchestrator();
    const ctx = orchestrator.buildContext({
      orchestrationId: 'orch-env',
      entries: [
        { node: NODE_NA, envelope: envelopeFromNode(surface, NODE_NA) },
        { node: NODE_SA, envelope: envelopeFromNode(surface, NODE_SA) },
        { node: NODE_EU, envelope: envelopeFromNode(surface, NODE_EU) },
      ],
    });
    const env = orchestrator.buildGlobalConsistencyEnvelope(ctx);
    expect(env.envelopeVersion).toBe('v1');
    expect(env.locked).toBe(true);
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.equivalence)).toBe(true);
    expect(Object.isFrozen(env.reconciliation)).toBe(true);
    expect(env.nodeCount).toBe(3);
    expect(env.globalConsistencyToken.startsWith('gct:v1:')).toBe(true);
    expect(() => orchestrator.assertGlobalDeterministicEquivalence(env)).not.toThrow();
  });

  it('global envelope is bit-stable across repeated orchestrations of the same input', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const orchestrator = new SponsorDistributedConsistencyOrchestrator();
    const build = () =>
      orchestrator.buildGlobalConsistencyEnvelope(
        orchestrator.buildContext({
          orchestrationId: 'orch-stable',
          entries: [
            { node: NODE_NA, envelope: envelopeFromNode(surface, NODE_NA) },
            { node: NODE_SA, envelope: envelopeFromNode(surface, NODE_SA) },
            { node: NODE_EU, envelope: envelopeFromNode(surface, NODE_EU) },
          ],
        }),
      );
    const a = build();
    const b = build();
    expect(a.globalFingerprint).toBe(b.globalFingerprint);
    expect(a.globalConsistencyToken).toBe(b.globalConsistencyToken);
    expect(a.reconciliation.canonicalFingerprint).toBe(b.reconciliation.canonicalFingerprint);
  });

  it('buildGlobalConsistencyEnvelope throws on drift (different requests across nodes)', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const orchestrator = new SponsorDistributedConsistencyOrchestrator();
    const ctx = orchestrator.buildContext({
      orchestrationId: 'orch-fail',
      entries: [
        { node: NODE_NA, envelope: envelopeFromNode(surface, NODE_NA, REQ) },
        {
          node: NODE_SA,
          envelope: envelopeFromNode(surface, NODE_SA, { ...REQ, categoryFilter: 'plumber' }),
        },
      ],
    });
    expect(() => orchestrator.buildGlobalConsistencyEnvelope(ctx)).toThrow(
      SponsorConsistencyDriftError,
    );
  });

  it('regression: contract v1 and underlying API surface remain untouched', () => {
    const contract = buildContract();
    expect(contract.contractVersion).toBe('v1');
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const envBefore = envelopeFromNode(surface, NODE_NA);
    const orchestrator = new SponsorDistributedConsistencyOrchestrator();
    orchestrator.buildGlobalConsistencyEnvelope(
      orchestrator.buildContext({
        orchestrationId: 'orch-regression',
        entries: [
          { node: NODE_NA, envelope: envBefore },
          { node: NODE_SA, envelope: envelopeFromNode(surface, NODE_SA) },
        ],
      }),
    );
    // Frozen, unchanged
    expect(Object.isFrozen(envBefore)).toBe(true);
    expect(Object.isFrozen(envBefore.response)).toBe(true);
    expect(envBefore.response.headers.contractVersion).toBe('v1');
    expect(envBefore.response.locked).toBe(true);
  });

  it('orchestration ordering is deterministic regardless of input order', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const orchestrator = new SponsorDistributedConsistencyOrchestrator();
    const eNA = envelopeFromNode(surface, NODE_NA);
    const eSA = envelopeFromNode(surface, NODE_SA);
    const eEU = envelopeFromNode(surface, NODE_EU);
    const ctxA = orchestrator.buildContext({
      orchestrationId: 'o',
      entries: [
        { node: NODE_EU, envelope: eEU },
        { node: NODE_NA, envelope: eNA },
        { node: NODE_SA, envelope: eSA },
      ],
    });
    const ctxB = orchestrator.buildContext({
      orchestrationId: 'o',
      entries: [
        { node: NODE_SA, envelope: eSA },
        { node: NODE_EU, envelope: eEU },
        { node: NODE_NA, envelope: eNA },
      ],
    });
    const envA = orchestrator.buildGlobalConsistencyEnvelope(ctxA);
    const envB = orchestrator.buildGlobalConsistencyEnvelope(ctxB);
    expect(envA.globalFingerprint).toBe(envB.globalFingerprint);
    expect(envA.globalConsistencyToken).toBe(envB.globalConsistencyToken);
    expect(envA.nodeIds).toEqual(envB.nodeIds);
  });

  it('many simulated nodes (50) all produce equivalent global envelope', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const orchestrator = new SponsorDistributedConsistencyOrchestrator();
    const regions: Array<SponsorGlobalConsistencyNode['nodeRegion']> = [
      'edge-na',
      'edge-sa',
      'edge-eu',
      'edge-ap',
      'edge-local',
    ];
    const entries = Array.from({ length: 50 }, (_, i) => {
      const node: SponsorGlobalConsistencyNode = Object.freeze({
        nodeId: `edge-${regions[i % regions.length]}-${i}`,
        nodeRegion: regions[i % regions.length],
        orderingIndex: i,
      });
      return { node, envelope: envelopeFromNode(surface, node, REQ, i % 2 === 0) };
    });
    const ctx = orchestrator.buildContext({ orchestrationId: 'orch-scale', entries });
    const env = orchestrator.buildGlobalConsistencyEnvelope(ctx);
    expect(env.equivalence.equivalent).toBe(true);
    expect(env.nodeCount).toBe(50);
    expect(new Set(env.equivalence.frames.map((f) => f.compositeFingerprint)).size).toBe(1);
  });

  it('no false positives: same request, mixed cachedHit values, no drift', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const orchestrator = new SponsorDistributedConsistencyOrchestrator();
    const ctx = orchestrator.buildContext({
      orchestrationId: 'orch-no-fp',
      entries: [
        { node: NODE_NA, envelope: envelopeFromNode(surface, NODE_NA, REQ, true) },
        { node: NODE_SA, envelope: envelopeFromNode(surface, NODE_SA, REQ, false) },
        { node: NODE_EU, envelope: envelopeFromNode(surface, NODE_EU, REQ, true) },
        { node: NODE_AP, envelope: envelopeFromNode(surface, NODE_AP, REQ, false) },
      ],
    });
    const matrix = orchestrator.computeNodeEquivalenceMatrix(ctx);
    const report = orchestrator.detectDeterministicDrift(matrix);
    expect(report.hasDrift).toBe(false);
    expect(report.driftCount).toBe(0);
  });

  it('buildContext rejects empty entries and missing orchestrationId', () => {
    const orchestrator = new SponsorDistributedConsistencyOrchestrator();
    expect(() =>
      orchestrator.buildContext({ orchestrationId: '', entries: [] }),
    ).toThrow();
    expect(() =>
      orchestrator.buildContext({ orchestrationId: 'x', entries: [] }),
    ).toThrow();
  });
});
