/**
 * Phase 1.9.36 — Sponsor Equilibrium Graph.
 */
import { deepFreeze, signObject } from './sponsorEquilibriumInternals';
import type { SponsorEquilibriumInvariantRegistry } from './sponsorEquilibriumInvariants';
import type { SponsorUniversalSaturationProofs } from './sponsorUniversalSaturationProofs';

export type SponsorEquilibriumNodeKind = 'layer' | 'invariant' | 'terminal';
export type SponsorEquilibriumEdgeKind = 'sequence' | 'saturates' | 'equilibrates';

export interface SponsorEquilibriumNode {
  readonly id: string;
  readonly kind: SponsorEquilibriumNodeKind;
  readonly label: string;
  readonly nodeSignature: string;
}

export interface SponsorEquilibriumEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SponsorEquilibriumEdgeKind;
  readonly edgeSignature: string;
}

export interface SponsorEquilibriumGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorEquilibriumNode>;
  readonly edges: ReadonlyArray<SponsorEquilibriumEdge>;
  readonly graphSignature: string;
}

const TERMINAL_NODE = 'terminal:equilibrium';

export function resolveEquilibriumGraph(
  invariants: SponsorEquilibriumInvariantRegistry,
  proofs: SponsorUniversalSaturationProofs,
): SponsorEquilibriumGraph {
  const nodes: SponsorEquilibriumNode[] = [];
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
      label: 'Terminal Equilibrium Saturation',
      nodeSignature: signObject({ id: TERMINAL_NODE, proofs: proofs.proofsSignature }),
    }),
  );

  const edges: SponsorEquilibriumEdge[] = [];
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
          kind: 'saturates' as const,
          edgeSignature: signObject({ from, to, kind: 'saturates' }),
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
        kind: 'equilibrates' as const,
        edgeSignature: signObject({ from, to: TERMINAL_NODE, kind: 'equilibrates' }),
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
