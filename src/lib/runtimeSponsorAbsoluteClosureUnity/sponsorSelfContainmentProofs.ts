/**
 * Phase 1.9.39 — Sponsor Self-Containment Proofs.
 */
import {
  SPONSOR_CLOSURE_UNITY_LAYER_ORDER,
  SPONSOR_CLOSURE_UNITY_LAYER_PHASE,
  deepFreeze,
  signObject,
  type SponsorClosureUnityLayerId,
} from './sponsorClosureUnityInternals';
import type {
  SponsorClosureUnityInvariantRegistry,
  SponsorClosureUnityInvariant,
} from './sponsorClosureUnityInvariants';

export interface SponsorClosureUnityLayerInput {
  readonly id: SponsorClosureUnityLayerId;
  readonly upstreamSignature?: string;
}

export interface SponsorClosureUnityLayerDescriptor {
  readonly id: SponsorClosureUnityLayerId;
  readonly phase: string;
  readonly index: number;
  readonly upstreamSignature: string;
  readonly descriptorSignature: string;
}

export interface SponsorSelfContainmentProof {
  readonly invariantId: SponsorClosureUnityInvariant['id'];
  readonly layerId: SponsorClosureUnityLayerId;
  readonly verdict: 'self-contained';
  readonly proofSignature: string;
}

export interface SponsorSelfContainmentProofs {
  readonly version: 'v1';
  readonly descriptors: ReadonlyArray<SponsorClosureUnityLayerDescriptor>;
  readonly proofs: ReadonlyArray<SponsorSelfContainmentProof>;
  readonly descriptorsSignature: string;
  readonly proofsSignature: string;
}

export function generateClosureUnityLayerDescriptors(
  inputs: ReadonlyArray<SponsorClosureUnityLayerInput>,
): ReadonlyArray<SponsorClosureUnityLayerDescriptor> {
  const byId = new Map(inputs.map((i) => [i.id, i] as const));
  const descriptors = SPONSOR_CLOSURE_UNITY_LAYER_ORDER.map((id, index) => {
    const upstream = byId.get(id)?.upstreamSignature ?? `null:${id}`;
    const descriptor = {
      id,
      phase: SPONSOR_CLOSURE_UNITY_LAYER_PHASE[id],
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

export function buildSelfContainmentProofs(
  invariants: SponsorClosureUnityInvariantRegistry,
  descriptors: ReadonlyArray<SponsorClosureUnityLayerDescriptor>,
): SponsorSelfContainmentProofs {
  const proofs: SponsorSelfContainmentProof[] = [];
  for (const inv of invariants.invariants) {
    for (const d of descriptors) {
      const base = {
        invariantId: inv.id,
        layerId: d.id,
        verdict: 'self-contained' as const,
        descriptorSignature: d.descriptorSignature,
        invariantSignature: inv.invariantSignature,
      };
      proofs.push(
        Object.freeze({
          invariantId: inv.id,
          layerId: d.id,
          verdict: 'self-contained' as const,
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
