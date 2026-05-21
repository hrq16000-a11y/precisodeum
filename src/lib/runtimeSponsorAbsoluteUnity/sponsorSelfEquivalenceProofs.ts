/**
 * Phase 1.9.37 — Sponsor Self-Equivalence Proofs.
 */
import {
  SPONSOR_UNITY_LAYER_ORDER,
  SPONSOR_UNITY_LAYER_PHASE,
  deepFreeze,
  signObject,
  type SponsorUnityInvariantId,
  type SponsorUnityLayerId,
} from './sponsorUnityInternals';
import type { SponsorUnityInvariantRegistry } from './sponsorUnityInvariants';

export interface SponsorUnityLayerInput {
  readonly id: SponsorUnityLayerId;
  readonly upstreamSignature?: string;
}

export interface SponsorUnityLayerDescriptor {
  readonly id: SponsorUnityLayerId;
  readonly phase: string;
  readonly upstreamSignature: string;
  readonly present: boolean;
  readonly descriptorSignature: string;
}

export function generateUnityLayerDescriptors(
  inputs: ReadonlyArray<SponsorUnityLayerInput> = [],
): ReadonlyArray<SponsorUnityLayerDescriptor> {
  const map = new Map<SponsorUnityLayerId, string>();
  for (const i of inputs) if (i?.id) map.set(i.id, i.upstreamSignature ?? '');
  return Object.freeze(
    SPONSOR_UNITY_LAYER_ORDER.map((id) => {
      const upstreamSignature = map.get(id) ?? '';
      const present = map.has(id);
      return Object.freeze({
        id,
        phase: SPONSOR_UNITY_LAYER_PHASE[id],
        upstreamSignature,
        present,
        descriptorSignature: signObject({
          id,
          phase: SPONSOR_UNITY_LAYER_PHASE[id],
          upstreamSignature,
          present,
        }),
      });
    }),
  );
}

export interface SponsorSelfEquivalenceProof {
  readonly invariantId: SponsorUnityInvariantId;
  readonly layerId: SponsorUnityLayerId;
  readonly verdict: 'self-equivalent';
  readonly proofSignature: string;
}

export interface SponsorSelfEquivalenceProofs {
  readonly version: 'v1';
  readonly descriptors: ReadonlyArray<SponsorUnityLayerDescriptor>;
  readonly proofs: ReadonlyArray<SponsorSelfEquivalenceProof>;
  readonly proofsSignature: string;
}

export function buildSelfEquivalenceProofs(
  invariants: SponsorUnityInvariantRegistry,
  descriptors: ReadonlyArray<SponsorUnityLayerDescriptor>,
): SponsorSelfEquivalenceProofs {
  const proofs: SponsorSelfEquivalenceProof[] = [];
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
  const proofsSignature = signObject(proofs.map((p) => p.proofSignature));
  return deepFreeze({
    version: 'v1' as const,
    descriptors,
    proofs: Object.freeze(proofs),
    proofsSignature,
  });
}
