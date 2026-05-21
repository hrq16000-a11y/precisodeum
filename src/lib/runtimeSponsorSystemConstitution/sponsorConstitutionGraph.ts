/**
 * Phase 1.9.31 — Sponsor Constitution Graph.
 * Deterministic graph: axioms → invariants → layers (governance edges).
 */
import {
  SPONSOR_CONSTITUTION_LAYERS,
  SPONSOR_CONSTITUTION_LAYER_ORDER,
  deepFreeze,
  signObject,
  type SponsorConstitutionLayerId,
} from './sponsorConstitutionInternals';
import type { SponsorConstitutionalAxiomsRegistry } from './sponsorConstitutionalAxioms';
import type { SponsorSupremeInvariantRegistry } from './sponsorSupremeInvariantRegistry';

export interface SponsorConstitutionLayerInput {
  readonly layer: SponsorConstitutionLayerId;
  readonly signature?: string | null;
}

export interface SponsorConstitutionLayerDescriptor {
  readonly layer: SponsorConstitutionLayerId;
  readonly phase: string;
  readonly signature: string | null;
  readonly present: boolean;
  readonly descriptorSignature: string;
}

export interface SponsorConstitutionNode {
  readonly id: string;
  readonly kind: 'axiom' | 'invariant' | 'layer';
  readonly label: string;
  readonly nodeSignature: string;
}

export interface SponsorConstitutionEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: 'axiom-invariant' | 'invariant-layer' | 'sequence';
  readonly edgeSignature: string;
}

export interface SponsorConstitutionGraph {
  readonly version: 'v1';
  readonly descriptors: ReadonlyArray<SponsorConstitutionLayerDescriptor>;
  readonly nodes: ReadonlyArray<SponsorConstitutionNode>;
  readonly edges: ReadonlyArray<SponsorConstitutionEdge>;
  readonly graphSignature: string;
}

export function generateLayerDescriptors(
  inputs: ReadonlyArray<SponsorConstitutionLayerInput> = [],
): ReadonlyArray<SponsorConstitutionLayerDescriptor> {
  const byLayer = new Map<SponsorConstitutionLayerId, string | null>();
  for (const inp of inputs) {
    if (!SPONSOR_CONSTITUTION_LAYER_ORDER.includes(inp.layer)) continue;
    byLayer.set(inp.layer, inp.signature ?? null);
  }
  const descriptors = SPONSOR_CONSTITUTION_LAYERS.map((spec) => {
    const signature = byLayer.has(spec.layer) ? byLayer.get(spec.layer) ?? null : null;
    const present = signature !== null && signature !== '';
    return Object.freeze({
      layer: spec.layer,
      phase: spec.phase,
      signature,
      present,
      descriptorSignature: signObject({
        layer: spec.layer,
        phase: spec.phase,
        signature,
        present,
      }),
    });
  });
  return deepFreeze(Object.freeze(descriptors));
}

export function resolveConstitutionGraph(
  axioms: SponsorConstitutionalAxiomsRegistry,
  invariants: SponsorSupremeInvariantRegistry,
  descriptors: ReadonlyArray<SponsorConstitutionLayerDescriptor>,
): SponsorConstitutionGraph {
  const axiomNodes: SponsorConstitutionNode[] = axioms.axioms.map((a) =>
    Object.freeze({
      id: `axiom:${a.id}`,
      kind: 'axiom' as const,
      label: a.id,
      nodeSignature: signObject({ id: `axiom:${a.id}`, sig: a.axiomSignature }),
    }),
  );
  const invariantNodes: SponsorConstitutionNode[] = invariants.invariants.map((i) =>
    Object.freeze({
      id: `inv:${i.id}`,
      kind: 'invariant' as const,
      label: i.id,
      nodeSignature: signObject({ id: `inv:${i.id}`, sig: i.invariantSignature }),
    }),
  );
  const layerNodes: SponsorConstitutionNode[] = descriptors.map((d) =>
    Object.freeze({
      id: `layer:${d.phase}:${d.layer}`,
      kind: 'layer' as const,
      label: d.layer,
      nodeSignature: signObject({
        id: `layer:${d.phase}:${d.layer}`,
        sig: d.descriptorSignature,
      }),
    }),
  );
  const nodes = [...axiomNodes, ...invariantNodes, ...layerNodes];

  const edges: SponsorConstitutionEdge[] = [];

  // axiom → invariant
  for (const inv of invariants.invariants) {
    edges.push(
      Object.freeze({
        from: `axiom:${inv.axiom}`,
        to: `inv:${inv.id}`,
        relation: 'axiom-invariant' as const,
        edgeSignature: signObject({
          from: `axiom:${inv.axiom}`,
          to: `inv:${inv.id}`,
          relation: 'axiom-invariant',
        }),
      }),
    );
  }

  // invariant → layer (each invariant governs every present layer)
  for (const inv of invariants.invariants) {
    for (const d of descriptors) {
      edges.push(
        Object.freeze({
          from: `inv:${inv.id}`,
          to: `layer:${d.phase}:${d.layer}`,
          relation: 'invariant-layer' as const,
          edgeSignature: signObject({
            from: `inv:${inv.id}`,
            to: `layer:${d.phase}:${d.layer}`,
            relation: 'invariant-layer',
          }),
        }),
      );
    }
  }

  // canonical sequence between layers
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
    descriptors,
    nodes: Object.freeze(nodes),
    edges: frozenEdges,
    graphSignature,
  });
}
