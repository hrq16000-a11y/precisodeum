/**
 * Phase 1.9.34 — Sponsor Deterministic Existence Snapshot.
 */
import { deepFreeze, signObject } from './sponsorExistenceInternals';
import type { SponsorAbsoluteIdentity } from './sponsorAbsoluteIdentity';
import type { SponsorExistenceInvariantRegistry } from './sponsorExistenceInvariants';
import type { SponsorOntologyGraph } from './sponsorOntologyGraph';
import type { SponsorOntologyLineage } from './sponsorOntologyLineage';

export interface SponsorDeterministicExistenceSnapshot {
  readonly version: 'v1';
  readonly layerCount: number;
  readonly invariantCount: number;
  readonly identitySignature: string;
  readonly absoluteIdentity: string;
  readonly invariantsSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
  readonly snapshotSignature: string;
}

export function generateExistenceSnapshot(
  identity: SponsorAbsoluteIdentity,
  invariants: SponsorExistenceInvariantRegistry,
  graph: SponsorOntologyGraph,
  lineage: SponsorOntologyLineage,
): SponsorDeterministicExistenceSnapshot {
  const snapshotSignature = signObject({
    identity: identity.identitySignature,
    absolute: identity.absoluteIdentity,
    invariants: invariants.invariantsSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    terminal: lineage.terminalSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    layerCount: identity.nodes.length,
    invariantCount: invariants.invariants.length,
    identitySignature: identity.identitySignature,
    absoluteIdentity: identity.absoluteIdentity,
    invariantsSignature: invariants.invariantsSignature,
    graphSignature: graph.graphSignature,
    lineageSignature: lineage.lineageSignature,
    terminalSignature: lineage.terminalSignature,
    snapshotSignature,
  });
}
