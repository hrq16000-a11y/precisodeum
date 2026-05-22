import { ACTIVATION_INVARIANTS, type SponsorActivationInvariant } from './sponsorActivationInvariants';
import { UPSTREAM_LAYERS, type SponsorUpstreamLayerId, djb2 } from './sponsorActivationInternals';

export interface SponsorOperationalReadinessProof {
  readonly layer: SponsorUpstreamLayerId;
  readonly invariant: SponsorActivationInvariant;
  readonly proofId: string;
  readonly status: 'READY';
}

export function buildOperationalReadinessProofs(): ReadonlyArray<SponsorOperationalReadinessProof> {
  const proofs: SponsorOperationalReadinessProof[] = [];
  for (const layer of UPSTREAM_LAYERS) {
    for (const invariant of ACTIVATION_INVARIANTS) {
      proofs.push(Object.freeze({
        layer,
        invariant,
        proofId: `proof:${layer}:${invariant}:${djb2(`${layer}|${invariant}`)}`,
        status: 'READY' as const,
      }));
    }
  }
  return Object.freeze(proofs);
}
