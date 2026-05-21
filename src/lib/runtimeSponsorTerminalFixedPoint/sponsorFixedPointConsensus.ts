/**
 * Phase 1.9.33 — Sponsor Fixed-Point Consensus.
 * Deterministic registry of terminal convergence consensus statements.
 */
import {
  SPONSOR_FIXED_POINT_CONSENSUS,
  deepFreeze,
  signObject,
  type SponsorFixedPointConsensusId,
} from './sponsorFixedPointInternals';

export interface SponsorFixedPointConsensus {
  readonly id: SponsorFixedPointConsensusId;
  readonly title: string;
  readonly statement: string;
  readonly consensusSignature: string;
}

export interface SponsorFixedPointConsensusRegistry {
  readonly version: 'v1';
  readonly consensus: ReadonlyArray<SponsorFixedPointConsensus>;
  readonly consensusSignature: string;
}

export function generateFixedPointConsensus(): SponsorFixedPointConsensusRegistry {
  const consensus: SponsorFixedPointConsensus[] = SPONSOR_FIXED_POINT_CONSENSUS.map((c) =>
    Object.freeze({
      id: c.id,
      title: c.title,
      statement: c.statement,
      consensusSignature: signObject({ id: c.id, title: c.title, statement: c.statement }),
    }),
  );
  const consensusSignature = signObject(consensus.map((c) => c.consensusSignature));
  return deepFreeze({
    version: 'v1' as const,
    consensus: Object.freeze(consensus),
    consensusSignature,
  });
}
