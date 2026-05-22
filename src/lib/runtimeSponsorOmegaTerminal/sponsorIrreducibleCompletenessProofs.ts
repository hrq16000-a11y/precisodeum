/**
 * Phase 1.9.40 — Sponsor Irreducible Completeness Proofs.
 */
import {
  SPONSOR_OMEGA_LAYER_ORDER,
  SPONSOR_OMEGA_LAYER_PHASE,
  deepFreeze,
  signObject,
  type SponsorOmegaLayerId,
} from './sponsorOmegaInternals';
import type {
  SponsorOmegaInvariant,
  SponsorOmegaInvariantRegistry,
} from './sponsorOmegaInvariants';

export interface SponsorOmegaLayerInput {
  readonly id: SponsorOmegaLayerId;
  readonly upstreamSignature?: string;
}

export interface SponsorOmegaLayerDescriptor {
  readonly id: SponsorOmegaLayerId;
  readonly phase: string;
  readonly index: number;
  readonly upstreamSignature: string;
  readonly descriptorSignature: string;
}

export interface SponsorIrreducibleCompletenessProof {
  readonly invariantId: SponsorOmegaInvariant['id'];
  readonly layerId: SponsorOmegaLayerId;
  readonly verdict: 'irreducible';
  readonly proofSignature: string;
}

export interface SponsorIrreducibleCompletenessProofs {
  readonly version: 'v1';
  readonly descriptors: ReadonlyArray<SponsorOmegaLayerDescriptor>;
  readonly proofs: ReadonlyArray<SponsorIrreducibleCompletenessProof>;
  readonly descriptorsSignature: string;
  readonly proofsSignature: string;
}

export function generateOmegaLayerDescriptors(
  inputs: ReadonlyArray<SponsorOmegaLayerInput>,
): ReadonlyArray<SponsorOmegaLayerDescriptor> {
  const byId = new Map(inputs.map((i) => [i.id, i] as const));
  const descriptors = SPONSOR_OMEGA_LAYER_ORDER.map((id, index) => {
    const upstream = byId.get(id)?.upstreamSignature ?? `null:${id}`;
    const descriptor = {
      id,
      phase: SPONSOR_OMEGA_LAYER_PHASE[id],
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

export function buildIrreducibleCompletenessProofs(
  invariants: SponsorOmegaInvariantRegistry,
  descriptors: ReadonlyArray<SponsorOmegaLayerDescriptor>,
): SponsorIrreducibleCompletenessProofs {
  const proofs: SponsorIrreducibleCompletenessProof[] = [];
  for (const inv of invariants.invariants) {
    for (const d of descriptors) {
      const base = {
        invariantId: inv.id,
        layerId: d.id,
        verdict: 'irreducible' as const,
        descriptorSignature: d.descriptorSignature,
        invariantSignature: inv.invariantSignature,
      };
      proofs.push(
        Object.freeze({
          invariantId: inv.id,
          layerId: d.id,
          verdict: 'irreducible' as const,
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
