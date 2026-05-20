/**
 * Phase 1.9.20 — Sponsor Product Surface Stabilization Layer.
 *
 * Stateless enforcement wrapper over the 1.9.19 API Product Integration Layer.
 * - Idempotent response keys
 * - Edge-distributed cache fingerprints
 * - Consistency envelope per invocation (cache-hit/miss agnostic)
 * - Cross-node determinism assertions
 *
 * NEVER mutates the upstream response. NEVER recalculates the contract.
 * NEVER holds global mutable state.
 */
import type {
  SponsorAPIRequest,
  SponsorAPIResponse,
} from '@/lib/runtimeSponsorAPIProductIntegrationLayer';
import { SponsorAPIProductIntegrationLayer } from '@/lib/runtimeSponsorAPIProductIntegrationLayer';
import type { SponsorContractSnapshot } from '@/lib/runtimeSponsorConsumptionContract';
import {
  computeEdgeFingerprint,
  type SponsorDistributedCacheFingerprint,
} from './sponsorDistributedCacheFingerprint';
import type { SponsorEdgeConsistencyEnvelope } from './sponsorEdgeConsistencyEnvelope';
import {
  computeIdempotencyKey,
  type SponsorResponseIdempotencyKey,
} from './sponsorResponseIdempotencyKey';
import {
  createExecutionContext,
  type SponsorSurfaceExecutionContext,
} from './sponsorSurfaceExecutionContext';
import { deepFreeze, fnv1a, stableStringify, SPONSOR_SURFACE_INTERNALS } from './sponsorSurfaceInternals';
import {
  validateConsistencyEnvelope,
  resolveDistributedCacheParity,
} from './sponsorSurfaceConsistencyGuard';
import {
  assertCrossNodeDeterminism,
  assertResponseStructurallyLocked,
} from './sponsorResponseStabilityValidator';

function computeStabilityToken(
  fingerprint: SponsorDistributedCacheFingerprint,
  idempotencyKey: SponsorResponseIdempotencyKey,
): string {
  return `stab:v1:${fnv1a(
    stableStringify({
      composite: fingerprint.compositeFingerprint,
      digest: idempotencyKey.digest,
    }),
  )}`;
}

export class SponsorProductSurfaceStabilizationLayer {
  private readonly api: SponsorAPIProductIntegrationLayer;

  constructor(private readonly contract: SponsorContractSnapshot) {
    if (contract.contractVersion !== 'v1') {
      throw new Error(
        `[sponsor-surface] unsupported contract version: ${contract.contractVersion}`,
      );
    }
    this.api = new SponsorAPIProductIntegrationLayer(contract);
  }

  get internals() {
    return SPONSOR_SURFACE_INTERNALS;
  }

  /** Build a fully locked, fingerprinted consistency envelope. */
  enforceIdempotentResponse(
    request: SponsorAPIRequest,
    executionContext: Partial<SponsorSurfaceExecutionContext> = {},
  ): SponsorEdgeConsistencyEnvelope {
    const response: SponsorAPIResponse = this.api.buildAPIResponse(request);
    assertResponseStructurallyLocked(response);

    const fingerprint = computeEdgeFingerprint(response);
    const idempotencyKey = computeIdempotencyKey(request, this.contract.signature);
    const stabilityToken = computeStabilityToken(fingerprint, idempotencyKey);
    const ctx = createExecutionContext(executionContext);

    const envelope: SponsorEdgeConsistencyEnvelope = deepFreeze({
      response,
      fingerprint,
      idempotencyKey,
      stabilityToken,
      executionContext: ctx,
      locked: true as const,
    });

    validateConsistencyEnvelope(envelope);
    return envelope;
  }

  /** Convenience: compute fingerprint without building a full envelope. */
  computeEdgeFingerprint(request: SponsorAPIRequest): SponsorDistributedCacheFingerprint {
    return computeEdgeFingerprint(this.api.buildAPIResponse(request));
  }

  /** Convenience: stable idempotency key for a request. */
  computeIdempotencyKey(request: SponsorAPIRequest): SponsorResponseIdempotencyKey {
    return computeIdempotencyKey(request, this.contract.signature);
  }

  /** Fail-closed integrity check. */
  lockResponseStability(env: SponsorEdgeConsistencyEnvelope): SponsorEdgeConsistencyEnvelope {
    validateConsistencyEnvelope(env);
    return env;
  }

  /** Asserts two envelopes (from different nodes) describe the same response. */
  assertCrossNodeDeterminism(
    a: SponsorEdgeConsistencyEnvelope,
    b: SponsorEdgeConsistencyEnvelope,
  ): void {
    assertCrossNodeDeterminism(a, b);
  }

  /** Asserts cache-hit and cache-miss invocations produce parity. */
  resolveDistributedCacheParity(
    hit: SponsorEdgeConsistencyEnvelope,
    miss: SponsorEdgeConsistencyEnvelope,
  ): void {
    resolveDistributedCacheParity(hit, miss);
  }
}
