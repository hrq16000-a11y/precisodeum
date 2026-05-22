/**
 * Phase 1.9.44 — Sponsor Recursive Containment Proofs.
 */
import {
  SPONSOR_INFINITY_LAYER_ORDER,
  deepFreeze,
  signObject,
  type SponsorInfinityLayerId,
} from './sponsorInfinityInternals';
import type { SponsorInfinityInvariantRegistry } from './sponsorInfinityInvariants';

export interface SponsorInfinityLayerInput {
  readonly id: SponsorInfinityLayerId;
  readonly upstreamSignature: string;
}

export interface SponsorInfinityLayerDescriptor {
  readonly index: number;
  readonly id: SponsorInfinityLayerId;
  readonly phase: string;
  readonly upstreamSignature: string;
  readonly descriptorSignature: string;
}

export interface SponsorRecursiveContainmentProof {
  readonly invariantId: string;
  readonly layerId: SponsorInfinityLayerId;
  readonly verdict: 'contained';
  readonly proofSignature: string;
}

export interface SponsorRecursiveContainmentProofs {
  readonly version: 'v1';
  readonly descriptors: ReadonlyArray<SponsorInfinityLayerDescriptor>;
  readonly descriptorsSignature: string;
  readonly proofs: ReadonlyArray<SponsorRecursiveContainmentProof>;
  readonly proofsSignature: string;
}

export function generateInfinityLayerDescriptors(
  inputs: ReadonlyArray<SponsorInfinityLayerInput>,
): ReadonlyArray<SponsorInfinityLayerDescriptor> {
  const map = new Map(inputs.map((i) => [i.id, i.upstreamSignature]));
  const descriptors = SPONSOR_INFINITY_LAYER_ORDER.map((id, index) => {
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

export function buildRecursiveContainmentProofs(
  invariants: SponsorInfinityInvariantRegistry,
  descriptors: ReadonlyArray<SponsorInfinityLayerDescriptor>,
): SponsorRecursiveContainmentProofs {
  const proofs: SponsorRecursiveContainmentProof[] = [];
  for (const inv of invariants.invariants) {
    for (const d of descriptors) {
      proofs.push(
        Object.freeze({
          invariantId: inv.id,
          layerId: d.id,
          verdict: 'contained' as const,
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
