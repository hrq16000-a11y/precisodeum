/**
 * Phase 1.9.42 — Sponsor Permanent Invariance Graph.
 */
import { deepFreeze, signObject } from './sponsorEternalInternals';
import type { SponsorEternalInvariantRegistry } from './sponsorEternalInvariants';
import type { SponsorPermanentStabilityProofs } from './sponsorPermanentStabilityProofs';

export type SponsorEternalEdgeKind = 'sequence' | 'certifies' | 'eternalizes';

export interface SponsorEternalNode {
  readonly id: string;
  readonly kind: 'layer' | 'invariant' | 'eternity';
}

export interface SponsorEternalEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SponsorEternalEdgeKind;
}

export interface SponsorPermanentInvarianceGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorEternalNode>;
  readonly edges: ReadonlyArray<SponsorEternalEdge>;
  readonly graphSignature: string;
}

const ETERNITY = 'eternity:permanent';

export function resolvePermanentInvarianceGraph(
  invariants: SponsorEternalInvariantRegistry,
  proofs: SponsorPermanentStabilityProofs,
): SponsorPermanentInvarianceGraph {
  const nodes: SponsorEternalNode[] = [];
  const edges: SponsorEternalEdge[] = [];

  for (const d of proofs.descriptors) {
    nodes.push(Object.freeze({ id: `layer:${d.id}`, kind: 'layer' as const }));
  }
  for (const inv of invariants.invariants) {
    nodes.push(Object.freeze({ id: `invariant:${inv.id}`, kind: 'invariant' as const }));
  }
  nodes.push(Object.freeze({ id: ETERNITY, kind: 'eternity' as const }));

  for (let i = 0; i < proofs.descriptors.length - 1; i++) {
    edges.push(
      Object.freeze({
        from: `layer:${proofs.descriptors[i].id}`,
        to: `layer:${proofs.descriptors[i + 1].id}`,
        kind: 'sequence' as const,
      }),
    );
  }
  for (const p of proofs.proofs) {
    edges.push(
      Object.freeze({
        from: `invariant:${p.invariantId}`,
        to: `layer:${p.layerId}`,
        kind: 'certifies' as const,
      }),
    );
  }
  for (const d of proofs.descriptors) {
    edges.push(
      Object.freeze({ from: `layer:${d.id}`, to: ETERNITY, kind: 'eternalizes' as const }),
    );
  }

  const graphSignature = signObject({
    nodes: nodes.map((n) => `${n.kind}:${n.id}`),
    edges: edges.map((e) => `${e.kind}:${e.from}->${e.to}`),
  });

  return deepFreeze({
    version: 'v1' as const,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    graphSignature,
  });
}
