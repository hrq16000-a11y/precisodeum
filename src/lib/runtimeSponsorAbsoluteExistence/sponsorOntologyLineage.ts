/**
 * Phase 1.9.34 — Sponsor Ontology Lineage.
 */
import { deepFreeze, signObject } from './sponsorExistenceInternals';
import type { SponsorAbsoluteIdentity, SponsorAbsoluteIdentityNode } from './sponsorAbsoluteIdentity';

export interface SponsorOntologyLineageEntry {
  readonly index: number;
  readonly id: SponsorAbsoluteIdentityNode['id'];
  readonly phase: string;
  readonly nodeSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorOntologyLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorOntologyLineageEntry>;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
}

export function computeOntologyLineage(
  identity: SponsorAbsoluteIdentity,
): SponsorOntologyLineage {
  const entries: SponsorOntologyLineageEntry[] = [];
  let cumulative = '';
  identity.nodes.forEach((n, i) => {
    cumulative = signObject({ prev: cumulative, sig: n.nodeSignature, index: i });
    entries.push(
      Object.freeze({
        index: i,
        id: n.id,
        phase: n.phase,
        nodeSignature: n.nodeSignature,
        cumulativeSignature: cumulative,
      }),
    );
  });
  const lineageSignature = signObject(entries.map((e) => e.cumulativeSignature));
  const terminalSignature = entries.length
    ? entries[entries.length - 1].cumulativeSignature
    : signObject({ empty: true });
  return deepFreeze({
    version: 'v1' as const,
    entries: Object.freeze(entries),
    lineageSignature,
    terminalSignature,
  });
}
