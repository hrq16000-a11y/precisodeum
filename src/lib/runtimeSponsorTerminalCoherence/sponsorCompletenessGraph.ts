/**
 * Phase 1.9.35 — Sponsor Completeness Graph.
 */
import { deepFreeze, signObject } from './sponsorCoherenceInternals';
import type { SponsorCoherenceInvariantRegistry } from './sponsorCoherenceInvariants';
import type { SponsorOntologicalCompletenessProofs } from './sponsorOntologicalCompletenessProofs';

export type SponsorCompletenessNodeKind = 'layer' | 'invariant' | 'terminal';
export type SponsorCompletenessEdgeKind = 'sequence' | 'completes' | 'closes';

export interface SponsorCompletenessNode {
  readonly id: string;
  readonly kind: SponsorCompletenessNodeKind;
  readonly label: string;
  readonly nodeSignature: string;
}

export interface SponsorCompletenessEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SponsorCompletenessEdgeKind;
  readonly edgeSignature: string;
}

export interface SponsorCompletenessGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorCompletenessNode>;
  readonly edges: ReadonlyArray<SponsorCompletenessEdge>;
  readonly graphSignature: string;
}

const TERMINAL_NODE = 'terminal:coherence';

export function resolveCompletenessGraph(
  invariants: SponsorCoherenceInvariantRegistry,
  proofs: SponsorOntologicalCompletenessProofs,
): SponsorCompletenessGraph {
  const nodes: SponsorCompletenessNode[] = [];
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
      label: 'Terminal Coherence Closure',
      nodeSignature: signObject({ id: TERMINAL_NODE, proofs: proofs.proofsSignature }),
    }),
  );

  const edges: SponsorCompletenessEdge[] = [];
  // sequence: canonical completeness ordering
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
  // completes: invariant → each layer
  for (const inv of invariants.invariants) {
    const from = `inv:${inv.id}`;
    for (const d of proofs.descriptors) {
      const to = `layer:${d.id}`;
      edges.push(
        Object.freeze({
          from,
          to,
          kind: 'completes' as const,
          edgeSignature: signObject({ from, to, kind: 'completes' }),
        }),
      );
    }
  }
  // closes: every layer → terminal
  for (const d of proofs.descriptors) {
    const from = `layer:${d.id}`;
    edges.push(
      Object.freeze({
        from,
        to: TERMINAL_NODE,
        kind: 'closes' as const,
        edgeSignature: signObject({ from, to: TERMINAL_NODE, kind: 'closes' }),
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
