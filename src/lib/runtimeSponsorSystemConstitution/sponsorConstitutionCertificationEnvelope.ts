/**
 * Phase 1.9.31 — Sponsor Constitution Certification Envelope.
 * Locked, deeply frozen, deterministic artifact certifying the system constitution.
 */
import {
  SPONSOR_CONSTITUTION_INTERNALS,
  SponsorConstitutionMutationError,
  deepFreeze,
  signObject,
} from './sponsorConstitutionInternals';
import type { SponsorConstitutionalAxiomsRegistry } from './sponsorConstitutionalAxioms';
import type { SponsorSupremeInvariantRegistry } from './sponsorSupremeInvariantRegistry';
import type { SponsorConstitutionGraph } from './sponsorConstitutionGraph';
import type { SponsorConstitutionLineage } from './sponsorConstitutionLineage';
import type { SponsorDeterministicConstitutionSnapshot } from './sponsorConstitutionSnapshot';

export interface SponsorSystemConstitution {
  readonly version: 'v1';
  readonly axiomsSignature: string;
  readonly invariantsSignature: string;
  readonly graphSignature: string;
  readonly constitutionSignature: string;
}

export function buildSystemConstitution(
  axioms: SponsorConstitutionalAxiomsRegistry,
  invariants: SponsorSupremeInvariantRegistry,
  graph: SponsorConstitutionGraph,
): SponsorSystemConstitution {
  const constitutionSignature = signObject({
    axioms: axioms.axiomsSignature,
    invariants: invariants.invariantsSignature,
    graph: graph.graphSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    axiomsSignature: axioms.axiomsSignature,
    invariantsSignature: invariants.invariantsSignature,
    graphSignature: graph.graphSignature,
    constitutionSignature,
  });
}

export interface SponsorConstitutionCertificationEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly axioms: SponsorConstitutionalAxiomsRegistry;
  readonly invariants: SponsorSupremeInvariantRegistry;
  readonly graph: SponsorConstitutionGraph;
  readonly constitution: SponsorSystemConstitution;
  readonly lineage: SponsorConstitutionLineage;
  readonly snapshot: SponsorDeterministicConstitutionSnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildConstitutionCertificationEnvelope(
  axioms: SponsorConstitutionalAxiomsRegistry,
  invariants: SponsorSupremeInvariantRegistry,
  graph: SponsorConstitutionGraph,
  constitution: SponsorSystemConstitution,
  lineage: SponsorConstitutionLineage,
  snapshot: SponsorDeterministicConstitutionSnapshot,
): SponsorConstitutionCertificationEnvelope {
  const envelopeSignature = signObject({
    axioms: axioms.axiomsSignature,
    invariants: invariants.invariantsSignature,
    graph: graph.graphSignature,
    constitution: constitution.constitutionSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_CONSTITUTION_INTERNALS.stage,
    axioms,
    invariants,
    graph,
    constitution,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockConstitutionEnvelope(
  env: SponsorConstitutionCertificationEnvelope,
): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorConstitutionMutationError('envelope must be frozen and locked');
  }
}
