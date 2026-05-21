/**
 * Phase 1.9.37 — Sponsor Unity Graph.
 */
import { deepFreeze, signObject } from './sponsorUnityInternals';
import type { SponsorUnityInvariantRegistry } from './sponsorUnityInvariants';
import type { SponsorSelfEquivalenceProofs } from './sponsorSelfEquivalenceProofs';

export type SponsorUnityNodeKind = 'layer' | 'invariant' | 'terminal';
export type SponsorUnityEdgeKind = 'sequence' | 'equates' | 'unifies';

export interface SponsorUnityNode {
  readonly id: string;
  readonly kind: SponsorUnityNodeKind;
  readonly label: string;
  readonly nodeSignature: string;
}

export interface SponsorUnityEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SponsorUnityEdgeKind;
  readonly edgeSignature: string;
}

export interface SponsorUnityGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorUnityNode>;
  readonly edges: ReadonlyArray<SponsorUnityEdge>;
  readonly graphSignature: string;
}

const TERMINAL_NODE = 'terminal:unity';

export function resolveUnityGraph(
  invariants: SponsorUnityInvariantRegistry,
  proofs: SponsorSelfEquivalenceProofs,
): SponsorUnityGraph {
  const nodes: SponsorUnityNode[] = [];
  for (const d of proofs.descriptors) {
    nodes.push(
      Object.freeze({
        id: `layer:${d.id}`,
        kind: 'layer' as const,
        label: `${d.phase}/${d.id}`,
        nodeSignature: d.descriptorSignature,
      }),
    );
  }
  for (const inv of invariants.invariants) {
    nodes.push(
      Object.freeze({
        id: `inv:${inv.id}`,
        kind: 'invariant' as const,
        label: inv.title,
        nodeSignature: inv.invariantSignature,
      }),
    );
  }
  nodes.push(
    Object.freeze({
      id: TERMINAL_NODE,
      kind: 'terminal' as const,
      label: 'Terminal Absolute Unity',
      nodeSignature: signObject({ id: TERMINAL_NODE, proofs: proofs.proofsSignature }),
    }),
  );

  const edges: SponsorUnityEdge[] = [];
  for (let i = 0; i < proofs.descriptors.length - 1; i++) {
    const from = `layer:${proofs.descriptors[i].id}`;
    const to = `layer:${proofs.descriptors[i + 1].id}`;
    edges.push(
      Object.freeze({
        from,
        to,
        kind: 'sequence' as const,
        edgeSignature: signObject({ from, to, kind: 'sequence' }),
      }),
    );
  }
  for (const inv of invariants.invariants) {
    const from = `inv:${inv.id}`;
    for (const d of proofs.descriptors) {
      const to = `layer:${d.id}`;
      edges.push(
        Object.freeze({
          from,
          to,
          kind: 'equates' as const,
          edgeSignature: signObject({ from, to, kind: 'equates' }),
        }),
      );
    }
  }
  for (const d of proofs.descriptors) {
    const from = `layer:${d.id}`;
    edges.push(
      Object.freeze({
        from,
        to: TERMINAL_NODE,
        kind: 'unifies' as const,
        edgeSignature: signObject({ from, to: TERMINAL_NODE, kind: 'unifies' }),
      }),
    );
  }

  const graphSignature = signObject({
    nodes: nodes.map((n) => n.nodeSignature),
    edges: edges.map((e) => e.edgeSignature),
  });
  return deepFreeze({
    version: 'v1' as const,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    graphSignature,
  });
}
