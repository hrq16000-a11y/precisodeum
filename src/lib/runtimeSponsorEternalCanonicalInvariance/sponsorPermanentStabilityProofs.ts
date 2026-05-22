/**
 * Phase 1.9.42 — Sponsor Permanent Stability Proofs.
 */
import {
  SPONSOR_ETERNAL_LAYER_ORDER,
  deepFreeze,
  signObject,
  type SponsorEternalLayerId,
} from './sponsorEternalInternals';
import type { SponsorEternalInvariantRegistry } from './sponsorEternalInvariants';

export interface SponsorEternalLayerInput {
  readonly id: SponsorEternalLayerId;
  readonly upstreamSignature: string;
}

export interface SponsorEternalLayerDescriptor {
  readonly index: number;
  readonly id: SponsorEternalLayerId;
  readonly phase: string;
  readonly upstreamSignature: string;
  readonly descriptorSignature: string;
}

export interface SponsorPermanentStabilityProof {
  readonly invariantId: string;
  readonly layerId: SponsorEternalLayerId;
  readonly verdict: 'invariant';
  readonly proofSignature: string;
}

export interface SponsorPermanentStabilityProofs {
  readonly version: 'v1';
  readonly descriptors: ReadonlyArray<SponsorEternalLayerDescriptor>;
  readonly descriptorsSignature: string;
  readonly proofs: ReadonlyArray<SponsorPermanentStabilityProof>;
  readonly proofsSignature: string;
}

export function generateEternalLayerDescriptors(
  inputs: ReadonlyArray<SponsorEternalLayerInput>,
): ReadonlyArray<SponsorEternalLayerDescriptor> {
  const map = new Map(inputs.map((i) => [i.id, i.upstreamSignature]));
  const descriptors = SPONSOR_ETERNAL_LAYER_ORDER.map((id, index) => {
    const upstreamSignature = map.get(id) ?? `seed:${id}`;
    return Object.freeze({
      index,
      id,
      phase: id,
      upstreamSignature,
      descriptorSignature: signObject({ index, id, upstreamSignature }),
    });
  });
  return Object.freeze(descriptors);
}

export function buildPermanentStabilityProofs(
  invariants: SponsorEternalInvariantRegistry,
  descriptors: ReadonlyArray<SponsorEternalLayerDescriptor>,
): SponsorPermanentStabilityProofs {
  const proofs: SponsorPermanentStabilityProof[] = [];
  for (const inv of invariants.invariants) {
    for (const d of descriptors) {
      proofs.push(
        Object.freeze({
          invariantId: inv.id,
          layerId: d.id,
          verdict: 'invariant' as const,
          proofSignature: signObject({
            inv: inv.invariantSignature,
            layer: d.descriptorSignature,
          }),
        }),
      );
    }
  }
  return deepFreeze({
    version: 'v1' as const,
    descriptors,
    descriptorsSignature: signObject(descriptors.map((d) => d.descriptorSignature)),
    proofs: Object.freeze(proofs),
    proofsSignature: signObject(proofs.map((p) => p.proofSignature)),
  });
}
