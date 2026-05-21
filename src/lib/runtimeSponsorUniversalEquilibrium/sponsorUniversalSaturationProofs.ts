/**
 * Phase 1.9.36 — Sponsor Universal Saturation Proofs.
 */
import {
  SPONSOR_EQUILIBRIUM_LAYER_ORDER,
  SPONSOR_EQUILIBRIUM_LAYER_PHASE,
  deepFreeze,
  signObject,
  type SponsorEquilibriumInvariantId,
  type SponsorEquilibriumLayerId,
} from './sponsorEquilibriumInternals';
import type { SponsorEquilibriumInvariantRegistry } from './sponsorEquilibriumInvariants';

export interface SponsorEquilibriumLayerInput {
  readonly id: SponsorEquilibriumLayerId;
  readonly upstreamSignature?: string;
}

export interface SponsorEquilibriumLayerDescriptor {
  readonly id: SponsorEquilibriumLayerId;
  readonly phase: string;
  readonly upstreamSignature: string;
  readonly present: boolean;
  readonly descriptorSignature: string;
}

export function generateLayerDescriptors(
  inputs: ReadonlyArray<SponsorEquilibriumLayerInput> = [],
): ReadonlyArray<SponsorEquilibriumLayerDescriptor> {
  const map = new Map<SponsorEquilibriumLayerId, string>();
  for (const i of inputs) if (i?.id) map.set(i.id, i.upstreamSignature ?? '');
  return Object.freeze(
    SPONSOR_EQUILIBRIUM_LAYER_ORDER.map((id) => {
      const upstreamSignature = map.get(id) ?? '';
      const present = map.has(id);
      return Object.freeze({
        id,
        phase: SPONSOR_EQUILIBRIUM_LAYER_PHASE[id],
        upstreamSignature,
        present,
        descriptorSignature: signObject({
          id,
          phase: SPONSOR_EQUILIBRIUM_LAYER_PHASE[id],
          upstreamSignature,
          present,
        }),
      });
    }),
  );
}

export interface SponsorUniversalSaturationProof {
  readonly invariantId: SponsorEquilibriumInvariantId;
  readonly layerId: SponsorEquilibriumLayerId;
  readonly verdict: 'saturated';
  readonly proofSignature: string;
}

export interface SponsorUniversalSaturationProofs {
  readonly version: 'v1';
  readonly descriptors: ReadonlyArray<SponsorEquilibriumLayerDescriptor>;
  readonly proofs: ReadonlyArray<SponsorUniversalSaturationProof>;
  readonly proofsSignature: string;
}

export function buildUniversalSaturationProofs(
  invariants: SponsorEquilibriumInvariantRegistry,
  descriptors: ReadonlyArray<SponsorEquilibriumLayerDescriptor>,
): SponsorUniversalSaturationProofs {
  const proofs: SponsorUniversalSaturationProof[] = [];
  for (const inv of invariants.invariants) {
    for (const d of descriptors) {
      proofs.push(
        Object.freeze({
          invariantId: inv.id,
          layerId: d.id,
          verdict: 'saturated' as const,
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
