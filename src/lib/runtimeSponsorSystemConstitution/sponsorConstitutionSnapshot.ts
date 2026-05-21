/**
 * Phase 1.9.31 — Sponsor Deterministic Constitution Snapshot.
 */
import { deepFreeze, signObject } from './sponsorConstitutionInternals';
import type { SponsorConstitutionalAxiomsRegistry } from './sponsorConstitutionalAxioms';
import type { SponsorSupremeInvariantRegistry } from './sponsorSupremeInvariantRegistry';
import type { SponsorConstitutionGraph } from './sponsorConstitutionGraph';
import type { SponsorConstitutionLineage } from './sponsorConstitutionLineage';

export interface SponsorDeterministicConstitutionSnapshot {
  readonly version: 'v1';
  readonly axiomCount: number;
  readonly invariantCount: number;
  readonly layerCount: number;
  readonly presentCount: number;
  readonly axiomsSignature: string;
  readonly invariantsSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly snapshotSignature: string;
}

export function generateConstitutionSnapshot(
  axioms: SponsorConstitutionalAxiomsRegistry,
  invariants: SponsorSupremeInvariantRegistry,
  graph: SponsorConstitutionGraph,
  lineage: SponsorConstitutionLineage,
): SponsorDeterministicConstitutionSnapshot {
  const snapshotSignature = signObject({
    axioms: axioms.axiomsSignature,
    invariants: invariants.invariantsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    axiomCount: axioms.axioms.length,
    invariantCount: invariants.invariants.length,
    layerCount: graph.descriptors.length,
    presentCount: graph.descriptors.filter((d) => d.present).length,
    axiomsSignature: axioms.axiomsSignature,
    invariantsSignature: invariants.invariantsSignature,
    graphSignature: graph.graphSignature,
    lineageSignature: lineage.lineageSignature,
    snapshotSignature,
  });
}
