/**
 * Phase 1.9.46 — Lineage runtime (shared, read-only).
 */
import { deepFreeze } from './metaPlaneDeepFreeze';
import { signObject } from './metaPlaneFNV';

export interface CanonicalLineageEntry {
  readonly index: number;
  readonly key: string;
  readonly entrySignature: string;
  readonly cumulativeSignature: string;
}

export interface CanonicalLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<CanonicalLineageEntry>;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
}

export interface LineageInput {
  readonly key: string;
  readonly signature: string;
}

export function buildCanonicalLineage(inputs: ReadonlyArray<LineageInput>): CanonicalLineage {
  let cumulative = '';
  const entries: CanonicalLineageEntry[] = inputs.map((input, index) => {
    cumulative = signObject({ prev: cumulative, sig: input.signature, index });
    return Object.freeze({
      index,
      key: input.key,
      entrySignature: input.signature,
      cumulativeSignature: cumulative,
    });
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

export function resolveLineageGraph(lineage: CanonicalLineage): ReadonlyArray<{ from: string; to: string }> {
  const edges: { from: string; to: string }[] = [];
  for (let i = 1; i < lineage.entries.length; i++) {
    edges.push(Object.freeze({
      from: lineage.entries[i - 1].key,
      to: lineage.entries[i].key,
    }));
  }
  return Object.freeze(edges);
}

export function signLineagePayload(lineage: CanonicalLineage): string {
  return lineage.lineageSignature;
}
