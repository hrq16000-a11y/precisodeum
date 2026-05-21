/**
 * Phase 1.9.34 — Sponsor Ontology Graph.
 */
import { deepFreeze, signObject } from './sponsorExistenceInternals';
import type { SponsorAbsoluteIdentity } from './sponsorAbsoluteIdentity';
import type { SponsorExistenceInvariantRegistry } from './sponsorExistenceInvariants';

export type SponsorOntologyNodeKind = 'layer' | 'invariant' | 'identity';
export type SponsorOntologyEdgeKind = 'sequence' | 'asserts' | 'identifies';

export interface SponsorOntologyNode {
  readonly id: string;
  readonly kind: SponsorOntologyNodeKind;
  readonly label: string;
  readonly nodeSignature: string;
}

export interface SponsorOntologyEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SponsorOntologyEdgeKind;
  readonly edgeSignature: string;
}

export interface SponsorOntologyGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorOntologyNode>;
  readonly edges: ReadonlyArray<SponsorOntologyEdge>;
  readonly graphSignature: string;
}

const IDENTITY_NODE = 'identity:absolute';

export function resolveOntologyGraph(
  identity: SponsorAbsoluteIdentity,
  invariants: SponsorExistenceInvariantRegistry,
): SponsorOntologyGraph {
  const nodes: SponsorOntologyNode[] = [];
  nodes.push(
    Object.freeze({
      id: IDENTITY_NODE,
      kind: 'identity' as const,
      label: 'Absolute Identity',
      nodeSignature: signObject({ id: IDENTITY_NODE, sig: identity.absoluteIdentity }),
    }),
  );
  for (const n of identity.nodes) {
    nodes.push(
      Object.freeze({
        id: `layer:${n.id}`,
        kind: 'layer' as const,
        label: `${n.phase}/${n.id}`,
        nodeSignature: n.nodeSignature,
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

  const edges: SponsorOntologyEdge[] = [];
  // identifies: identity → every layer
  for (const n of identity.nodes) {
    const to = `layer:${n.id}`;
    edges.push(
      Object.freeze({
        from: IDENTITY_NODE,
        to,
        kind: 'identifies' as const,
        edgeSignature: signObject({ from: IDENTITY_NODE, to, kind: 'identifies' }),
      }),
    );
  }
  // sequence: canonical ontology ordering
  for (let i = 0; i < identity.nodes.length - 1; i++) {
    const from = `layer:${identity.nodes[i].id}`;
    const to = `layer:${identity.nodes[i + 1].id}`;
    edges.push(
      Object.freeze({
        from,
        to,
        kind: 'sequence' as const,
        edgeSignature: signObject({ from, to, kind: 'sequence' }),
      }),
    );
  }
  // asserts: every invariant → every layer
  for (const inv of invariants.invariants) {
    const from = `inv:${inv.id}`;
    for (const n of identity.nodes) {
      const to = `layer:${n.id}`;
      edges.push(
        Object.freeze({
          from,
          to,
          kind: 'asserts' as const,
          edgeSignature: signObject({ from, to, kind: 'asserts' }),
        }),
      );
    }
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
