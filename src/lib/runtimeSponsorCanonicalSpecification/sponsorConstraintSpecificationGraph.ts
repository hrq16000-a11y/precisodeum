/**
 * Phase 1.9.30 — Sponsor Constraint Specification Graph.
 * Deterministic graph: nodes = layers + canonical constraint nodes; edges = applicability.
 */
import {
  deepFreeze,
  signObject,
  type SponsorSpecificationPlane,
} from './sponsorSpecificationInternals';
import type { SponsorExecutionSemanticDescriptor } from './sponsorExecutionSemantics';

export interface SponsorConstraintNode {
  readonly id: string;
  readonly kind: 'layer' | 'constraint';
  readonly label: string;
  readonly plane?: SponsorSpecificationPlane;
  readonly nodeSignature: string;
}

export interface SponsorConstraintEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: 'satisfies' | 'sequence';
  readonly edgeSignature: string;
}

export interface SponsorConstraintSpecificationGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorConstraintNode>;
  readonly edges: ReadonlyArray<SponsorConstraintEdge>;
  readonly constraintCount: number;
  readonly graphSignature: string;
}

const CANONICAL_CONSTRAINTS: ReadonlyArray<string> = Object.freeze([
  'bit-stable-output',
  'no-side-effects',
  'no-upstream-mutation',
  'ordered-composition',
  'bit-stable-projection',
  'canonical-ordering',
  'rollback-reproducible',
]);

export function resolveConstraintSpecificationGraph(
  descriptors: ReadonlyArray<SponsorExecutionSemanticDescriptor>,
): SponsorConstraintSpecificationGraph {
  const layerNodes: SponsorConstraintNode[] = descriptors.map((d) =>
    Object.freeze({
      id: `layer:${d.phase}:${d.layer}`,
      kind: 'layer' as const,
      label: d.layer,
      plane: d.plane,
      nodeSignature: signObject({
        id: `layer:${d.phase}:${d.layer}`,
        plane: d.plane,
        sig: d.descriptorSignature,
      }),
    }),
  );

  const constraintNodes: SponsorConstraintNode[] = CANONICAL_CONSTRAINTS.map((c) =>
    Object.freeze({
      id: `constraint:${c}`,
      kind: 'constraint' as const,
      label: c,
      nodeSignature: signObject({ id: `constraint:${c}` }),
    }),
  );

  const nodes = [...layerNodes, ...constraintNodes];

  const edges: SponsorConstraintEdge[] = [];

  // sequence edges between layers
  for (let i = 0; i < layerNodes.length - 1; i++) {
    edges.push(
      Object.freeze({
        from: layerNodes[i].id,
        to: layerNodes[i + 1].id,
        relation: 'sequence' as const,
        edgeSignature: signObject({
          from: layerNodes[i].id,
          to: layerNodes[i + 1].id,
          relation: 'sequence',
        }),
      }),
    );
  }

  // satisfies edges from layers to constraints (via guarantees)
  for (const d of descriptors) {
    for (const g of d.guarantees) {
      const constraintId = `constraint:${g}`;
      if (!CANONICAL_CONSTRAINTS.includes(g)) continue;
      const layerId = `layer:${d.phase}:${d.layer}`;
      edges.push(
        Object.freeze({
          from: layerId,
          to: constraintId,
          relation: 'satisfies' as const,
          edgeSignature: signObject({
            from: layerId,
            to: constraintId,
            relation: 'satisfies',
          }),
        }),
      );
    }
  }

  // canonical edge ordering
  edges.sort((a, b) => {
    if (a.relation !== b.relation) return a.relation < b.relation ? -1 : 1;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    return a.to < b.to ? -1 : a.to > b.to ? 1 : 0;
  });

  const frozenEdges = Object.freeze(edges.map((e) => Object.freeze(e)));

  const graphSignature = signObject({
    nodes: nodes.map((n) => n.nodeSignature),
    edges: frozenEdges.map((e) => e.edgeSignature),
  });

  return deepFreeze({
    version: 'v1' as const,
    nodes: Object.freeze(nodes),
    edges: frozenEdges,
    constraintCount: constraintNodes.length,
    graphSignature,
  });
}
