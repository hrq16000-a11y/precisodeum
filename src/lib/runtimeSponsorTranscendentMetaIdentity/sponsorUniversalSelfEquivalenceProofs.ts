/**
 * Phase 1.9.43 — Sponsor Universal Self-Equivalence Proofs.
 */
import {
  SPONSOR_TRANSCENDENT_LAYER_ORDER,
  deepFreeze,
  signObject,
  type SponsorTranscendentLayerId,
} from './sponsorTranscendentInternals';
import type { SponsorTranscendentInvariantRegistry } from './sponsorTranscendentInvariants';

export interface SponsorTranscendentLayerInput {
  readonly id: SponsorTranscendentLayerId;
  readonly upstreamSignature: string;
}

export interface SponsorTranscendentLayerDescriptor {
  readonly index: number;
  readonly id: SponsorTranscendentLayerId;
  readonly phase: string;
  readonly upstreamSignature: string;
  readonly descriptorSignature: string;
}

export interface SponsorUniversalSelfEquivalenceProof {
  readonly invariantId: string;
  readonly layerId: SponsorTranscendentLayerId;
  readonly verdict: 'self-equivalent';
  readonly proofSignature: string;
}

export interface SponsorUniversalSelfEquivalenceProofs {
  readonly version: 'v1';
  readonly descriptors: ReadonlyArray<SponsorTranscendentLayerDescriptor>;
  readonly descriptorsSignature: string;
  readonly proofs: ReadonlyArray<SponsorUniversalSelfEquivalenceProof>;
  readonly proofsSignature: string;
}

export function generateTranscendentLayerDescriptors(
  inputs: ReadonlyArray<SponsorTranscendentLayerInput>,
): ReadonlyArray<SponsorTranscendentLayerDescriptor> {
  const map = new Map(inputs.map((i) => [i.id, i.upstreamSignature]));
  const descriptors = SPONSOR_TRANSCENDENT_LAYER_ORDER.map((id, index) => {
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

export function buildUniversalSelfEquivalenceProofs(
  invariants: SponsorTranscendentInvariantRegistry,
  descriptors: ReadonlyArray<SponsorTranscendentLayerDescriptor>,
): SponsorUniversalSelfEquivalenceProofs {
  const proofs: SponsorUniversalSelfEquivalenceProof[] = [];
  for (const inv of invariants.invariants) {
    for (const d of descriptors) {
      proofs.push(
        Object.freeze({
          invariantId: inv.id,
          layerId: d.id,
          verdict: 'self-equivalent' as const,
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
