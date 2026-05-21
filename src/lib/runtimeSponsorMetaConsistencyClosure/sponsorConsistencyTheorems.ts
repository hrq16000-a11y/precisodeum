/**
 * Phase 1.9.32 — Sponsor Consistency Theorems.
 * Deterministic registry of terminal consistency theorems.
 */
import {
  SPONSOR_CONSISTENCY_THEOREMS,
  deepFreeze,
  signObject,
  type SponsorConsistencyTheoremId,
} from './sponsorClosureInternals';

export interface SponsorConsistencyTheorem {
  readonly id: SponsorConsistencyTheoremId;
  readonly title: string;
  readonly statement: string;
  readonly theoremSignature: string;
}

export interface SponsorConsistencyTheoremRegistry {
  readonly version: 'v1';
  readonly theorems: ReadonlyArray<SponsorConsistencyTheorem>;
  readonly theoremsSignature: string;
}

export function generateConsistencyTheorems(): SponsorConsistencyTheoremRegistry {
  const theorems: SponsorConsistencyTheorem[] = SPONSOR_CONSISTENCY_THEOREMS.map((t) =>
    Object.freeze({
      id: t.id,
      title: t.title,
      statement: t.statement,
      theoremSignature: signObject({ id: t.id, title: t.title, statement: t.statement }),
    }),
  );
  const theoremsSignature = signObject(theorems.map((t) => t.theoremSignature));
  return deepFreeze({
    version: 'v1' as const,
    theorems: Object.freeze(theorems),
    theoremsSignature,
  });
}
