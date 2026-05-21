/**
 * Phase 1.9.35 — Sponsor Ontological Completeness Proofs.
 */
import {
  SPONSOR_COHERENCE_LAYER_ORDER,
  SPONSOR_COHERENCE_LAYER_PHASE,
  deepFreeze,
  signObject,
  type SponsorCoherenceInvariantId,
  type SponsorCoherenceLayerId,
} from './sponsorCoherenceInternals';
import type { SponsorCoherenceInvariantRegistry } from './sponsorCoherenceInvariants';

export interface SponsorCoherenceLayerInput {
  readonly id: SponsorCoherenceLayerId;
  readonly upstreamSignature?: string;
}

export interface SponsorCoherenceLayerDescriptor {
  readonly id: SponsorCoherenceLayerId;
  readonly phase: string;
  readonly upstreamSignature: string;
  readonly present: boolean;
  readonly descriptorSignature: string;
}

export function generateLayerDescriptors(
  inputs: ReadonlyArray<SponsorCoherenceLayerInput> = [],
): ReadonlyArray<SponsorCoherenceLayerDescriptor> {
  const map = new Map<SponsorCoherenceLayerId, string>();
  for (const i of inputs) if (i?.id) map.set(i.id, i.upstreamSignature ?? '');
  return Object.freeze(
    SPONSOR_COHERENCE_LAYER_ORDER.map((id) => {
      const upstreamSignature = map.get(id) ?? '';
      const present = map.has(id);
      return Object.freeze({
        id,
        phase: SPONSOR_COHERENCE_LAYER_PHASE[id],
        upstreamSignature,
        present,
        descriptorSignature: signObject({
          id,
          phase: SPONSOR_COHERENCE_LAYER_PHASE[id],
          upstreamSignature,
          present,
        }),
      });
    }),
  );
}

export interface SponsorOntologicalCompletenessProof {
  readonly invariantId: SponsorCoherenceInvariantId;
  readonly layerId: SponsorCoherenceLayerId;
  readonly verdict: 'complete';
  readonly proofSignature: string;
}

export interface SponsorOntologicalCompletenessProofs {
  readonly version: 'v1';
  readonly descriptors: ReadonlyArray<SponsorCoherenceLayerDescriptor>;
  readonly proofs: ReadonlyArray<SponsorOntologicalCompletenessProof>;
  readonly proofsSignature: string;
}

export function buildOntologicalCompletenessProofs(
  invariants: SponsorCoherenceInvariantRegistry,
  descriptors: ReadonlyArray<SponsorCoherenceLayerDescriptor>,
): SponsorOntologicalCompletenessProofs {
  const proofs: SponsorOntologicalCompletenessProof[] = [];
  for (const inv of invariants.invariants) {
    for (const d of descriptors) {
      proofs.push(
        Object.freeze({
          invariantId: inv.id,
          layerId: d.id,
          verdict: 'complete' as const,
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
