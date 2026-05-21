/**
 * Phase 1.9.38 — Sponsor Reflexivity Graph.
 */
import { deepFreeze, signObject } from './sponsorReflexivityInternals';
import type { SponsorReflexivityInvariantRegistry } from './sponsorReflexivityInvariants';
import type { SponsorRecursiveCompletenessProofs } from './sponsorRecursiveCompletenessProofs';

export type SponsorReflexivityEdgeKind = 'sequence' | 'describes' | 'reflects';

export interface SponsorReflexivityNode {
  readonly id: string;
  readonly kind: 'layer' | 'invariant' | 'terminal';
}

export interface SponsorReflexivityEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SponsorReflexivityEdgeKind;
}

export interface SponsorReflexivityGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorReflexivityNode>;
  readonly edges: ReadonlyArray<SponsorReflexivityEdge>;
  readonly graphSignature: string;
}

const TERMINAL = 'terminal:reflexivity';

export function resolveReflexivityGraph(
  invariants: SponsorReflexivityInvariantRegistry,
  proofs: SponsorRecursiveCompletenessProofs,
): SponsorReflexivityGraph {
  const nodes: SponsorReflexivityNode[] = [];
  const edges: SponsorReflexivityEdge[] = [];

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
        kind: 'describes' as const,
      }),
    );
  }
  for (const d of proofs.descriptors) {
    edges.push(
      Object.freeze({ from: `layer:${d.id}`, to: TERMINAL, kind: 'reflects' as const }),
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
