import { SPONSOR_ACTIVATION_INTERNALS, canonicalize, djb2 } from './sponsorActivationInternals';
import { ACTIVATION_GATES, type SponsorActivationGate } from './sponsorActivationGates';
import { ACTIVATION_PREREQUISITES, type SponsorActivationPrerequisite } from './sponsorActivationPrerequisites';
import { buildRolloutGovernanceMatrix, type SponsorRolloutGovernanceMatrix } from './sponsorRolloutGovernanceMatrix';
import { generateActivationInvariants, type SponsorActivationInvariant } from './sponsorActivationInvariants';
import { computeActivationLineage, type SponsorActivationLineage } from './sponsorActivationLineage';
import { resolveActivationGraph, type SponsorActivationReadinessGraph } from './sponsorActivationReadinessGraph';
import { buildOperationalReadinessProofs, type SponsorOperationalReadinessProof } from './sponsorOperationalReadinessProofs';
import { generateActivationSnapshot, type SponsorDeterministicActivationSnapshot } from './sponsorActivationSnapshot';

export interface SponsorActivationGovernanceEnvelope {
  readonly version: '1.9.45';
  readonly plane: 'SponsorActivationGovernancePlane';
  readonly internals: typeof SPONSOR_ACTIVATION_INTERNALS;
  readonly gates: ReadonlyArray<SponsorActivationGate>;
  readonly prerequisites: ReadonlyArray<SponsorActivationPrerequisite>;
  readonly rolloutGovernance: SponsorRolloutGovernanceMatrix;
  readonly invariants: ReadonlyArray<SponsorActivationInvariant>;
  readonly lineage: SponsorActivationLineage;
  readonly graph: SponsorActivationReadinessGraph;
  readonly proofs: ReadonlyArray<SponsorOperationalReadinessProof>;
  readonly snapshot: SponsorDeterministicActivationSnapshot;
  readonly envelopeSignature: string;
}

export function lockActivationEnvelope(): SponsorActivationGovernanceEnvelope {
  const envelope = {
    version: '1.9.45' as const,
    plane: 'SponsorActivationGovernancePlane' as const,
    internals: SPONSOR_ACTIVATION_INTERNALS,
    gates: ACTIVATION_GATES,
    prerequisites: ACTIVATION_PREREQUISITES,
    rolloutGovernance: buildRolloutGovernanceMatrix(),
    invariants: generateActivationInvariants(),
    lineage: computeActivationLineage(),
    graph: resolveActivationGraph(),
    proofs: buildOperationalReadinessProofs(),
    snapshot: generateActivationSnapshot(),
  };
  const envelopeSignature = `sig:envelope:activation:${djb2(canonicalize(envelope))}`;
  return Object.freeze({ ...envelope, envelopeSignature });
}
