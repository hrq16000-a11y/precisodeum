/**
 * Phase 1.9.39 — Sponsor Closure-Unity Graph.
 */
import { deepFreeze, signObject } from './sponsorClosureUnityInternals';
import type { SponsorClosureUnityInvariantRegistry } from './sponsorClosureUnityInvariants';
import type { SponsorSelfContainmentProofs } from './sponsorSelfContainmentProofs';

export type SponsorClosureUnityEdgeKind = 'sequence' | 'contains' | 'closes';

export interface SponsorClosureUnityNode {
  readonly id: string;
  readonly kind: 'layer' | 'invariant' | 'terminal';
}

export interface SponsorClosureUnityEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SponsorClosureUnityEdgeKind;
}

export interface SponsorClosureUnityGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorClosureUnityNode>;
  readonly edges: ReadonlyArray<SponsorClosureUnityEdge>;
  readonly graphSignature: string;
}

const TERMINAL = 'terminal:closure-unity';

export function resolveClosureUnityGraph(
  invariants: SponsorClosureUnityInvariantRegistry,
  proofs: SponsorSelfContainmentProofs,
): SponsorClosureUnityGraph {
  const nodes: SponsorClosureUnityNode[] = [];
  const edges: SponsorClosureUnityEdge[] = [];

  for (const d of proofs.descriptors) {
    nodes.push(Object.freeze({ id: `layer:${d.id}`, kind: 'layer' as const }));
  }
  for (const inv of invariants.invariants) {
    nodes.push(Object.freeze({ id: `invariant:${inv.id}`, kind: 'invariant' as const }));
  }
  nodes.push(Object.freeze({ id: TERMINAL, kind: 'terminal' as const }));

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
        kind: 'contains' as const,
      }),
    );
  }
  for (const d of proofs.descriptors) {
    edges.push(
      Object.freeze({ from: `layer:${d.id}`, to: TERMINAL, kind: 'closes' as const }),
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
