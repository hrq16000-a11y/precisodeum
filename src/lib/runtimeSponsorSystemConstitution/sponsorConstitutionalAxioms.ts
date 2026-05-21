/**
 * Phase 1.9.31 — Sponsor Constitutional Axioms.
 * Deterministic registry of the system's fundamental axioms.
 */
import {
  SPONSOR_CONSTITUTIONAL_AXIOMS,
  deepFreeze,
  signObject,
  type SponsorConstitutionalAxiomId,
} from './sponsorConstitutionInternals';

export interface SponsorConstitutionalAxiom {
  readonly id: SponsorConstitutionalAxiomId;
  readonly title: string;
  readonly statement: string;
  readonly axiomSignature: string;
}

export interface SponsorConstitutionalAxiomsRegistry {
  readonly version: 'v1';
  readonly axioms: ReadonlyArray<SponsorConstitutionalAxiom>;
  readonly axiomsSignature: string;
}

export function generateConstitutionalAxioms(): SponsorConstitutionalAxiomsRegistry {
  const axioms: SponsorConstitutionalAxiom[] = SPONSOR_CONSTITUTIONAL_AXIOMS.map((a) =>
    Object.freeze({
      id: a.id,
      title: a.title,
      statement: a.statement,
      axiomSignature: signObject({ id: a.id, title: a.title, statement: a.statement }),
    }),
  );
  const axiomsSignature = signObject(axioms.map((a) => a.axiomSignature));
  return deepFreeze({
    version: 'v1' as const,
    axioms: Object.freeze(axioms),
    axiomsSignature,
  });
}
