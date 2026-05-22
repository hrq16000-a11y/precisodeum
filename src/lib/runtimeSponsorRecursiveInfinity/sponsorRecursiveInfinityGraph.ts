/**
 * Phase 1.9.44 — Sponsor Recursive Infinity Graph.
 */
import { deepFreeze, signObject } from './sponsorInfinityInternals';
import type { SponsorInfinityInvariantRegistry } from './sponsorInfinityInvariants';
import type { SponsorRecursiveContainmentProofs } from './sponsorRecursiveContainmentProofs';

export type SponsorInfinityEdgeKind = 'sequence' | 'certifies' | 'contains';

export interface SponsorInfinityNode {
  readonly id: string;
  readonly kind: 'layer' | 'invariant' | 'infinity';
}

export interface SponsorInfinityEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SponsorInfinityEdgeKind;
}

export interface SponsorRecursiveInfinityGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorInfinityNode>;
  readonly edges: ReadonlyArray<SponsorInfinityEdge>;
  readonly graphSignature: string;
}

const INFINITY = 'infinity:recursive';

export function resolveRecursiveInfinityGraph(
  invariants: SponsorInfinityInvariantRegistry,
  proofs: SponsorRecursiveContainmentProofs,
): SponsorRecursiveInfinityGraph {
  const nodes: SponsorInfinityNode[] = [];
  const edges: SponsorInfinityEdge[] = [];

  for (const d of proofs.descriptors) {
    nodes.push(Object.freeze({ id: `layer:${d.id}`, kind: 'layer' as const }));
  }
  for (const inv of invariants.invariants) {
    nodes.push(Object.freeze({ id: `invariant:${inv.id}`, kind: 'invariant' as const }));
  }
  nodes.push(Object.freeze({ id: INFINITY, kind: 'infinity' as const }));

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
      Object.freeze({ from: `layer:${d.id}`, to: INFINITY, kind: 'contains' as const }),
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
