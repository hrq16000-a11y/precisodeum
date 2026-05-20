/**
 * Phase 1.9.19 — Sponsor API Product Integration Layer · Test Suite.
 * Bit-stable responses, consumer isolation, no leakage, regression of 1.9.14–1.9.18.
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
  SPONSOR_API_INTERNALS,
  generateCacheKey,
  type SponsorAPIRequest,
} from '@/lib/runtimeSponsorAPIProductIntegrationLayer';

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

describe('Phase 1.9.19 · SponsorAPIProductIntegrationLayer', () => {
  it('internals: read-only / no networking / no billing', () => {
    expect(SPONSOR_API_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(SPONSOR_API_INTERNALS.networkingEnabled).toBe(false);
    expect(SPONSOR_API_INTERNALS.billingEnabled).toBe(false);
    expect(SPONSOR_API_INTERNALS.recalculationAllowed).toBe(false);
    expect(SPONSOR_API_INTERNALS.upstreamMutationAllowed).toBe(false);
  });

  it('bit-stable: same request → same response (etag + cacheKey)', () => {
    const contract = buildContract();
    const layer = new SponsorAPIProductIntegrationLayer(contract);
    const r1 = layer.buildAPIResponse(baseReq());
    const r2 = layer.buildAPIResponse(baseReq());
    expect(r1.headers.etag).toBe(r2.headers.etag);
    expect(r1.headers.cacheKey).toBe(r2.headers.cacheKey);
    expect(r1).toBe(r2); // cache hit returns the same locked instance
  });

  it('bit-stable across independent layer instances over the same contract', () => {
    const contract = buildContract();
    const a = new SponsorAPIProductIntegrationLayer(contract);
    const b = new SponsorAPIProductIntegrationLayer(contract);
    const ra = a.buildAPIResponse(baseReq());
    const rb = b.buildAPIResponse(baseReq());
    expect(ra.headers.etag).toBe(rb.headers.etag);
    expect(ra.body).toEqual(rb.body);
  });

  it('multi-consumer isolation: distinct consumerId → distinct headers, identical body', () => {
    const contract = buildContract();
    const layer = new SponsorAPIProductIntegrationLayer(contract);
    const a = layer.buildAPIResponse(baseReq({ consumerId: 'A' }));
    const b = layer.buildAPIResponse(baseReq({ consumerId: 'B' }));
    expect(a.headers.consumerId).toBe('A');
    expect(b.headers.consumerId).toBe('B');
    expect(a.body).toEqual(b.body);
    expect(a.headers.cacheKey).toBe(b.headers.cacheKey); // cacheKey is consumer-agnostic
  });

  it('responses are immutable (frozen body + headers + locked)', () => {
    const contract = buildContract();
    const layer = new SponsorAPIProductIntegrationLayer(contract);
    const r = layer.buildAPIResponse(baseReq());
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.body)).toBe(true);
    expect(Object.isFrozen(r.headers)).toBe(true);
    expect(r.locked).toBe(true);
  });

  it('contract v1 is not mutated by the API layer', () => {
    const contract = buildContract();
    const sigBefore = contract.signature;
    const layer = new SponsorAPIProductIntegrationLayer(contract);
    layer.buildAPIResponse(baseReq());
    layer.buildAPIResponse(baseReq({ consumerId: 'X' }));
    layer.buildAPIResponse(baseReq({ cityFilter: 'sp', categoryFilter: 'plumber' }));
    expect(contract.signature).toBe(sigBefore);
    expect(Object.isFrozen(contract.payload)).toBe(true);
  });

  it('no internal leakage: response body only exposes contract v1 fields', () => {
    const contract = buildContract();
    const layer = new SponsorAPIProductIntegrationLayer(contract);
    const r = layer.buildAPIResponse(baseReq());
    const forbidden = [
      'rankingScore',
      'frameSignature',
      'derivedCampaignWeight',
      'internalWeight',
      'upstreamSignatures',
      'fairnessLedger',
      'saturationMap',
    ];
    const serialized = JSON.stringify(r.body);
    for (const key of forbidden) {
      expect(serialized.includes(`"${key}"`)).toBe(false);
    }
    for (const slot of r.body.slots) {
      expect(Object.keys(slot).sort()).toEqual(
        ['campaignId', 'outcome', 'priority', 'projectedExposure', 'score', 'slotId', 'sponsorId'].sort(),
      );
    }
    for (const c of r.body.campaigns) {
      expect(Object.keys(c).sort()).toEqual(
        ['aggregatedWeight', 'campaignId', 'categories', 'geographies', 'intensity', 'lifecycle', 'nodeCount'].sort(),
      );
    }
  });

  it('cache key is deterministic and consumer-agnostic', () => {
    const contract = buildContract();
    const k1 = generateCacheKey(contract, baseReq({ consumerId: 'A' }));
    const k2 = generateCacheKey(contract, baseReq({ consumerId: 'B' }));
    const k3 = generateCacheKey(contract, baseReq({ consumerId: 'A', cityFilter: 'sp' }));
    expect(k1).toBe(k2);
    expect(k1).not.toBe(k3);
    expect(k1.startsWith('sponsor-api:v1:')).toBe(true);
  });

  it('payload meta passes through from contract v1 unchanged', () => {
    const contract = buildContract();
    const layer = new SponsorAPIProductIntegrationLayer(contract);
    const r = layer.buildAPIResponse(baseReq());
    expect(r.body.meta).toBe(contract.payload.meta);
    expect(r.body.temporal).toBe(contract.payload.temporal);
  });

  it('pagination (limit/offset) is deterministic and post-ordering', () => {
    const contract = buildContract();
    const layer = new SponsorAPIProductIntegrationLayer(contract);
    const full = layer.buildAPIResponse(baseReq());
    const page = layer.buildAPIResponse(baseReq({ limit: 1, offset: 0 }));
    expect(page.body.slots.length).toBeLessThanOrEqual(1);
    if (full.body.slots.length > 0 && page.body.slots.length > 0) {
      expect(page.body.slots[0]).toEqual(full.body.slots[0]);
    }
  });

  it('city/category filter narrows campaigns deterministically', () => {
    const contract = buildContract();
    const layer = new SponsorAPIProductIntegrationLayer(contract);
    const filtered = layer.buildAPIResponse(baseReq({ cityFilter: 'sp', categoryFilter: 'plumber' }));
    for (const c of filtered.body.campaigns) {
      expect(c.geographies).toContain('sp');
      expect(c.categories).toContain('plumber');
    }
  });

  it('delivery snapshot is signed and locked', () => {
    const contract = buildContract();
    const layer = new SponsorAPIProductIntegrationLayer(contract);
    const d1 = layer.deliver(baseReq());
    const d2 = layer.deliver(baseReq());
    expect(d1.deliverySignature).toBe(d2.deliverySignature);
    expect(d1.contractSignature).toBe(contract.signature);
    expect(Object.isFrozen(d1)).toBe(true);
    expect(d1.locked).toBe(true);
  });

  it('unsupported route/version throws — fail-closed', () => {
    const contract = buildContract();
    const layer = new SponsorAPIProductIntegrationLayer(contract);
    expect(() =>
      layer.dispatch('GET /v2/sponsor/exposure' as never, baseReq()),
    ).toThrow();
    expect(() =>
      layer.buildAPIResponse({ ...baseReq(), apiVersion: 'v2' as never }),
    ).toThrow();
    expect(() => layer.buildAPIResponse({ ...baseReq(), consumerId: '' })).toThrow();
  });
});
