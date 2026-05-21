/**
 * Phase 1.9.29 — Sponsor Introspection Graph.
 * Deterministic graph of layers grouped by plane + cross-plane edges.
 */
import { deepFreeze, signObject, type SponsorManifestPlane } from './sponsorManifestInternals';
import type { SponsorManifestDescriptor } from './sponsorManifestDescriptors';

export interface SponsorIntrospectionNode {
  readonly id: string;
  readonly layer: string;
  readonly phase: string;
  readonly plane: SponsorManifestPlane;
  readonly nodeSignature: string;
}

export interface SponsorIntrospectionEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: 'sequence' | 'plane';
  readonly edgeSignature: string;
}

export interface SponsorIntrospectionGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorIntrospectionNode>;
  readonly edges: ReadonlyArray<SponsorIntrospectionEdge>;
  readonly planes: ReadonlyArray<SponsorManifestPlane>;
  readonly graphSignature: string;
}

export function resolveIntrospectionGraph(
  descriptors: ReadonlyArray<SponsorManifestDescriptor>,
): SponsorIntrospectionGraph {
  const nodes: SponsorIntrospectionNode[] = descriptors.map((d) =>
    Object.freeze({
      id: `${d.phase}:${d.layer}`,
      layer: d.layer,
      phase: d.phase,
      plane: d.plane,
      nodeSignature: signObject({
        id: `${d.phase}:${d.layer}`,
        plane: d.plane,
        sig: d.descriptorSignature,
      }),
    }),
  );

  const edges: SponsorIntrospectionEdge[] = [];
  // sequence edges along canonical layer order
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push(
      Object.freeze({
        from: nodes[i].id,
        to: nodes[i + 1].id,
        kind: 'sequence' as const,
        edgeSignature: signObject({
          from: nodes[i].id,
          to: nodes[i + 1].id,
          kind: 'sequence',
        }),
      }),
    );
  }
  // plane edges: link first node of each plane to subsequent siblings (canonical)
  const byPlane = new Map<SponsorManifestPlane, SponsorIntrospectionNode[]>();
  for (const n of nodes) {
    const arr = byPlane.get(n.plane) ?? [];
    arr.push(n);
    byPlane.set(n.plane, arr);
  }
  const planeKeys = [...byPlane.keys()].sort();
  for (const plane of planeKeys) {
    const siblings = byPlane.get(plane)!;
    for (let i = 0; i < siblings.length - 1; i++) {
      edges.push(
        Object.freeze({
          from: siblings[i].id,
          to: siblings[i + 1].id,
          kind: 'plane' as const,
          edgeSignature: signObject({
            from: siblings[i].id,
            to: siblings[i + 1].id,
            kind: 'plane',
          }),
        }),
      );
    }
  }

  // canonical edge ordering
  edges.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    return a.to < b.to ? -1 : a.to > b.to ? 1 : 0;
  });

  const frozenEdges = Object.freeze(edges.map((e) => Object.freeze(e)));
  const graphSignature = signObject({
    nodes: nodes.map((n) => n.nodeSignature),
    edges: frozenEdges.map((e) => e.edgeSignature),
    planes: planeKeys,
  });

  return deepFreeze({
    version: 'v1' as const,
    nodes: Object.freeze(nodes),
    edges: frozenEdges,
    planes: Object.freeze(planeKeys),
    graphSignature,
  });
}
