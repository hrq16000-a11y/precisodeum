/**
 * Phase 1.9.38 — Sponsor Recursive Completeness Proofs.
 */
import {
  SPONSOR_REFLEXIVITY_LAYER_ORDER,
  SPONSOR_REFLEXIVITY_LAYER_PHASE,
  deepFreeze,
  signObject,
  type SponsorReflexivityLayerId,
} from './sponsorReflexivityInternals';
import type {
  SponsorReflexivityInvariantRegistry,
  SponsorReflexivityInvariant,
} from './sponsorReflexivityInvariants';

export interface SponsorReflexivityLayerInput {
  readonly id: SponsorReflexivityLayerId;
  readonly upstreamSignature?: string;
}

export interface SponsorReflexivityLayerDescriptor {
  readonly id: SponsorReflexivityLayerId;
  readonly phase: string;
  readonly index: number;
  readonly upstreamSignature: string;
  readonly descriptorSignature: string;
}

export interface SponsorRecursiveCompletenessProof {
  readonly invariantId: SponsorReflexivityInvariant['id'];
  readonly layerId: SponsorReflexivityLayerId;
  readonly verdict: 'self-described';
  readonly proofSignature: string;
}

export interface SponsorRecursiveCompletenessProofs {
  readonly version: 'v1';
  readonly descriptors: ReadonlyArray<SponsorReflexivityLayerDescriptor>;
  readonly proofs: ReadonlyArray<SponsorRecursiveCompletenessProof>;
  readonly descriptorsSignature: string;
  readonly proofsSignature: string;
}

export function generateReflexivityLayerDescriptors(
  inputs: ReadonlyArray<SponsorReflexivityLayerInput>,
): ReadonlyArray<SponsorReflexivityLayerDescriptor> {
  const byId = new Map(inputs.map((i) => [i.id, i] as const));
  const descriptors = SPONSOR_REFLEXIVITY_LAYER_ORDER.map((id, index) => {
    const upstream = byId.get(id)?.upstreamSignature ?? `null:${id}`;
    const descriptor = {
      id,
      phase: SPONSOR_REFLEXIVITY_LAYER_PHASE[id],
      index,
      upstreamSignature: upstream,
    };
    return Object.freeze({
      ...descriptor,
      descriptorSignature: signObject(descriptor),
    });
  });
  return Object.freeze(descriptors);
}

export function buildRecursiveCompletenessProofs(
  invariants: SponsorReflexivityInvariantRegistry,
  descriptors: ReadonlyArray<SponsorReflexivityLayerDescriptor>,
): SponsorRecursiveCompletenessProofs {
  const proofs: SponsorRecursiveCompletenessProof[] = [];
  for (const inv of invariants.invariants) {
    for (const d of descriptors) {
      const base = {
        invariantId: inv.id,
        layerId: d.id,
        verdict: 'self-described' as const,
        descriptorSignature: d.descriptorSignature,
        invariantSignature: inv.invariantSignature,
      };
      proofs.push(
        Object.freeze({
          invariantId: inv.id,
          layerId: d.id,
          verdict: 'self-described' as const,
          proofSignature: signObject(base),
        }),
      );
    }
  }
  const descriptorsSignature = signObject(descriptors.map((d) => d.descriptorSignature));
  const proofsSignature = signObject(proofs.map((p) => p.proofSignature));
  return deepFreeze({
    version: 'v1' as const,
    descriptors,
    proofs: Object.freeze(proofs),
    descriptorsSignature,
    proofsSignature,
  });
}
