/**
 * Phase 1.9.41 — Sponsor Singularity Graph (canonical collapse graph).
 */
import { deepFreeze, signObject } from './sponsorSingularityInternals';
import type { SponsorSingularityInvariantRegistry } from './sponsorSingularityInvariants';
import type { SponsorCanonicalCollapseProofs } from './sponsorCanonicalCollapseProofs';

export type SponsorSingularityEdgeKind = 'sequence' | 'certifies' | 'collapses';

export interface SponsorSingularityNode {
  readonly id: string;
  readonly kind: 'layer' | 'invariant' | 'singularity';
}

export interface SponsorSingularityEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SponsorSingularityEdgeKind;
}

export interface SponsorSingularityGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorSingularityNode>;
  readonly edges: ReadonlyArray<SponsorSingularityEdge>;
  readonly graphSignature: string;
}

const SINGULARITY = 'singularity:canonical';

export function resolveSingularityGraph(
  invariants: SponsorSingularityInvariantRegistry,
  proofs: SponsorCanonicalCollapseProofs,
): SponsorSingularityGraph {
  const nodes: SponsorSingularityNode[] = [];
  const edges: SponsorSingularityEdge[] = [];

  for (const d of proofs.descriptors) {
    nodes.push(Object.freeze({ id: `layer:${d.id}`, kind: 'layer' as const }));
  }
  for (const inv of invariants.invariants) {
    nodes.push(Object.freeze({ id: `invariant:${inv.id}`, kind: 'invariant' as const }));
  }
  nodes.push(Object.freeze({ id: SINGULARITY, kind: 'singularity' as const }));

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
      Object.freeze({ from: `layer:${d.id}`, to: SINGULARITY, kind: 'collapses' as const }),
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
