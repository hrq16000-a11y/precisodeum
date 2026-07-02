/**
 * Phase 1.9.20 — Sponsor Product Surface Stabilization · Test Suite.
 * Cross-node determinism, cache parity, structural locking, regression 1.9.14–1.9.19.
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
import {
  SponsorAPIProductIntegrationLayer,
  type SponsorAPIRequest,
} from '@/lib/runtimeSponsorAPIProductIntegrationLayer';
import {
  SponsorProductSurfaceStabilizationLayer,
  SPONSOR_SURFACE_INTERNALS,
  SponsorSurfaceStabilityError,
  fingerprintsMatch,
  computeEdgeFingerprint,
} from '@/lib/runtimeSponsorProductSurfaceStabilization';

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

const baseReq = (overrides: Partial<SponsorAPIRequest> = {}): SponsorAPIRequest => ({
  apiVersion: 'v1',
  consumerId: 'consumer-A',
  consumerKind: 'frontend',
  ...overrides,
});

describe('Phase 1.9.20 · SponsorProductSurfaceStabilizationLayer', () => {
  it('internals: stateless / read-only / no global mutable state', () => {
    expect(SPONSOR_SURFACE_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_SURFACE_INTERNALS.globalMutableStateAllowed).toBe(false);
    expect(SPONSOR_SURFACE_INTERNALS.payloadDriftAllowed).toBe(false);
    expect(SPONSOR_SURFACE_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_SURFACE_INTERNALS.recalculationAllowed).toBe(false);
  });

  it('envelope is fully locked and fingerprint-validated', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const env = surface.enforceIdempotentResponse(baseReq());
    expect(env.locked).toBe(true);
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.fingerprint)).toBe(true);
    expect(Object.isFrozen(env.idempotencyKey)).toBe(true);
    expect(env.stabilityToken.startsWith('stab:v1:')).toBe(true);
    expect(env.idempotencyKey.digest.startsWith('idem:v1:')).toBe(true);
    // Validation is fail-closed and idempotent
    expect(() => surface.lockResponseStability(env)).not.toThrow();
  });

  it('cross-node determinism: same request from different nodes → bit-identical envelope', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const envNA = surface.enforceIdempotentResponse(baseReq(), {
      nodeId: 'edge-na-1',
      nodeRegion: 'edge-na',
      invocationIndex: 17,
      cachedHit: false,
    });
    const envSA = surface.enforceIdempotentResponse(baseReq(), {
      nodeId: 'edge-sa-9',
      nodeRegion: 'edge-sa',
      invocationIndex: 8421,
      cachedHit: true,
    });
    expect(() => surface.assertCrossNodeDeterminism(envNA, envSA)).not.toThrow();
    expect(envNA.fingerprint.compositeFingerprint).toBe(envSA.fingerprint.compositeFingerprint);
    expect(envNA.stabilityToken).toBe(envSA.stabilityToken);
    expect(envNA.idempotencyKey.digest).toBe(envSA.idempotencyKey.digest);
  });

  it('cache hit vs miss: structural parity holds', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const hit = surface.enforceIdempotentResponse(baseReq(), { cachedHit: true });
    const miss = surface.enforceIdempotentResponse(baseReq(), { cachedHit: false });
    expect(() => surface.resolveDistributedCacheParity(hit, miss)).not.toThrow();
    expect(hit.fingerprint.compositeFingerprint).toBe(miss.fingerprint.compositeFingerprint);
  });

  it('concurrent invocations (parallel) yield identical fingerprints', async () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const N = 50;
    const envelopes = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        Promise.resolve(
          surface.enforceIdempotentResponse(baseReq(), {
            nodeId: `edge-${i}`,
            invocationIndex: i,
            cachedHit: i % 2 === 0,
          }),
        ),
      ),
    );
    const reference = envelopes[0].fingerprint.compositeFingerprint;
    for (const env of envelopes) {
      expect(env.fingerprint.compositeFingerprint).toBe(reference);
      expect(env.stabilityToken).toBe(envelopes[0].stabilityToken);
    }
  });

  it('execution context is informational only — never embedded in fingerprint', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const a = surface.enforceIdempotentResponse(baseReq(), {
      nodeId: 'edge-A',
      nodeRegion: 'edge-na',
      invocationIndex: 1,
    });
    const b = surface.enforceIdempotentResponse(baseReq(), {
      nodeId: 'edge-Z',
      nodeRegion: 'edge-ap',
      invocationIndex: 999_999,
    });
    expect(a.fingerprint).toEqual(b.fingerprint);
    expect(JSON.stringify(a.response.body)).toBe(JSON.stringify(b.response.body));
  });

  it('distinct requests produce distinct idempotency keys and fingerprints', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const a = surface.enforceIdempotentResponse(baseReq());
    const b = surface.enforceIdempotentResponse(baseReq({ cityFilter: 'sp' }));
    expect(a.idempotencyKey.digest).not.toBe(b.idempotencyKey.digest);
    expect(fingerprintsMatch(a.fingerprint, b.fingerprint)).toBe(false);
  });

  it('contract v1 (1.9.18) is not mutated by the stabilization layer', () => {
    const contract = buildContract();
    const sigBefore = contract.signature;
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    surface.enforceIdempotentResponse(baseReq());
    surface.enforceIdempotentResponse(baseReq({ consumerId: 'X' }));
    surface.enforceIdempotentResponse(baseReq({ cityFilter: 'sp', categoryFilter: 'plumber' }));
    expect(contract.signature).toBe(sigBefore);
    expect(Object.isFrozen(contract.payload)).toBe(true);
  });

  it('1.9.19 API surface remains functional and consistent under stabilization', () => {
    const contract = buildContract();
    const api = new SponsorAPIProductIntegrationLayer(contract);
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const direct = api.buildAPIResponse(baseReq());
    const env = surface.enforceIdempotentResponse(baseReq());
    expect(env.response.headers.etag).toBe(direct.headers.etag);
    expect(env.response.body).toEqual(direct.body);
    expect(env.fingerprint.etag).toBe(direct.headers.etag);
  });

  it('fingerprint integrity: tampered envelope fails validation', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const env = surface.enforceIdempotentResponse(baseReq());
    // Fabricate a drifted envelope by swapping the fingerprint with another request's.
    const other = surface.enforceIdempotentResponse(baseReq({ cityFilter: 'sp' }));
    const tampered = { ...env, fingerprint: other.fingerprint } as typeof env;
    expect(() => surface.lockResponseStability(tampered)).toThrow(SponsorSurfaceStabilityError);
  });

  it('cache parity violation throws (synthetic divergence)', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const a = surface.enforceIdempotentResponse(baseReq());
    const b = surface.enforceIdempotentResponse(baseReq({ cityFilter: 'sp' }));
    // a and b are structurally different — parity must fail.
    expect(() => surface.resolveDistributedCacheParity(a, b)).toThrow(SponsorSurfaceStabilityError);
  });

  it('computeEdgeFingerprint is pure and deterministic', () => {
    const contract = buildContract();
    const api = new SponsorAPIProductIntegrationLayer(contract);
    const r = api.buildAPIResponse(baseReq());
    const f1 = computeEdgeFingerprint(r);
    const f2 = computeEdgeFingerprint(r);
    expect(f1).toEqual(f2);
    expect(f1.compositeFingerprint).toBe(f2.compositeFingerprint);
  });

  it('multi-consumer cross-node: body parity + idempotency partitioned per consumer', () => {
    const contract = buildContract();
    const surface = new SponsorProductSurfaceStabilizationLayer(contract);
    const a1 = surface.enforceIdempotentResponse(baseReq({ consumerId: 'A' }), {
      nodeId: 'edge-na-1',
    });
    const a2 = surface.enforceIdempotentResponse(baseReq({ consumerId: 'A' }), {
      nodeId: 'edge-sa-5',
    });
    const b1 = surface.enforceIdempotentResponse(baseReq({ consumerId: 'B' }), {
      nodeId: 'edge-eu-3',
    });
    // Same consumer → identical idempotency + stability across nodes.
    expect(a1.idempotencyKey.digest).toBe(a2.idempotencyKey.digest);
    expect(a1.stabilityToken).toBe(a2.stabilityToken);
    // Different consumer → distinct idempotency key, but body fingerprint identical
    // (consumerId is in headers only — body is consumer-agnostic).
    expect(a1.idempotencyKey.digest).not.toBe(b1.idempotencyKey.digest);
    expect(a1.fingerprint.bodyFingerprint).toBe(b1.fingerprint.bodyFingerprint);
  });
});
