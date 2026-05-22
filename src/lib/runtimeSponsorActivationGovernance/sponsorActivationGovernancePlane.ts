import { lockActivationEnvelope, type SponsorActivationGovernanceEnvelope } from './sponsorActivationGovernanceEnvelope';
import { generateActivationInvariants } from './sponsorActivationInvariants';
import { resolveActivationGraph } from './sponsorActivationReadinessGraph';
import { generateActivationSnapshot } from './sponsorActivationSnapshot';
import { evaluateActivationPrerequisites } from './sponsorActivationPrerequisites';
import { buildRolloutGovernanceMatrix } from './sponsorRolloutGovernanceMatrix';
import { canonicalize } from './sponsorActivationInternals';

export const SponsorActivationGovernancePlane = Object.freeze({
  buildActivationReadinessState: () => lockActivationEnvelope(),
  generateActivationInvariants,
  resolveActivationGraph,
  generateActivationSnapshot,
  evaluateActivationPrerequisites,
  buildRolloutGovernanceMatrix,
  lockActivationEnvelope,
  assertActivationDeterminism(): boolean {
    const a = canonicalize(lockActivationEnvelope());
    const b = canonicalize(lockActivationEnvelope());
    return a === b;
  },
});

export type { SponsorActivationGovernanceEnvelope };
