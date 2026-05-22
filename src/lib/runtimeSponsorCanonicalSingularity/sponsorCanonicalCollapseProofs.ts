/**
 * Phase 1.9.41 — Sponsor Canonical Collapse Proofs.
 */
import {
  SPONSOR_SINGULARITY_LAYER_ORDER,
  SPONSOR_SINGULARITY_LAYER_PHASE,
  deepFreeze,
  signObject,
  type SponsorSingularityLayerId,
} from './sponsorSingularityInternals';
import type {
  SponsorSingularityInvariant,
  SponsorSingularityInvariantRegistry,
} from './sponsorSingularityInvariants';

export interface SponsorSingularityLayerInput {
  readonly id: SponsorSingularityLayerId;
  readonly upstreamSignature?: string;
}

export interface SponsorSingularityLayerDescriptor {
  readonly id: SponsorSingularityLayerId;
  readonly phase: string;
  readonly index: number;
  readonly upstreamSignature: string;
  readonly descriptorSignature: string;
}

export interface SponsorCanonicalCollapseProof {
  readonly invariantId: SponsorSingularityInvariant['id'];
  readonly layerId: SponsorSingularityLayerId;
  readonly verdict: 'collapsed';
  readonly proofSignature: string;
}

export interface SponsorCanonicalCollapseProofs {
  readonly version: 'v1';
  readonly descriptors: ReadonlyArray<SponsorSingularityLayerDescriptor>;
  readonly proofs: ReadonlyArray<SponsorCanonicalCollapseProof>;
  readonly descriptorsSignature: string;
  readonly proofsSignature: string;
}

export function generateSingularityLayerDescriptors(
  inputs: ReadonlyArray<SponsorSingularityLayerInput>,
): ReadonlyArray<SponsorSingularityLayerDescriptor> {
  const byId = new Map(inputs.map((i) => [i.id, i] as const));
  const descriptors = SPONSOR_SINGULARITY_LAYER_ORDER.map((id, index) => {
    const upstream = byId.get(id)?.upstreamSignature ?? `null:${id}`;
    const descriptor = {
      id,
      phase: SPONSOR_SINGULARITY_LAYER_PHASE[id],
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

export function buildCanonicalCollapseProofs(
  invariants: SponsorSingularityInvariantRegistry,
  descriptors: ReadonlyArray<SponsorSingularityLayerDescriptor>,
): SponsorCanonicalCollapseProofs {
  const proofs: SponsorCanonicalCollapseProof[] = [];
  for (const inv of invariants.invariants) {
    for (const d of descriptors) {
      const base = {
        invariantId: inv.id,
        layerId: d.id,
        verdict: 'collapsed' as const,
        descriptorSignature: d.descriptorSignature,
        invariantSignature: inv.invariantSignature,
      };
      proofs.push(
        Object.freeze({
          invariantId: inv.id,
          layerId: d.id,
          verdict: 'collapsed' as const,
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
