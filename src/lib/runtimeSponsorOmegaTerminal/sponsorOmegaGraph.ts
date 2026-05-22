/**
 * Phase 1.9.40 — Sponsor Omega Graph.
 */
import { deepFreeze, signObject } from './sponsorOmegaInternals';
import type { SponsorOmegaInvariantRegistry } from './sponsorOmegaInvariants';
import type { SponsorIrreducibleCompletenessProofs } from './sponsorIrreducibleCompletenessProofs';

export type SponsorOmegaEdgeKind = 'sequence' | 'certifies' | 'terminates';

export interface SponsorOmegaNode {
  readonly id: string;
  readonly kind: 'layer' | 'invariant' | 'terminal';
}

export interface SponsorOmegaEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SponsorOmegaEdgeKind;
}

export interface SponsorOmegaGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorOmegaNode>;
  readonly edges: ReadonlyArray<SponsorOmegaEdge>;
  readonly graphSignature: string;
}

const TERMINAL = 'terminal:omega';

export function resolveOmegaGraph(
  invariants: SponsorOmegaInvariantRegistry,
  proofs: SponsorIrreducibleCompletenessProofs,
): SponsorOmegaGraph {
  const nodes: SponsorOmegaNode[] = [];
  const edges: SponsorOmegaEdge[] = [];

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
        kind: 'certifies' as const,
      }),
    );
  }
  for (const d of proofs.descriptors) {
    edges.push(
      Object.freeze({ from: `layer:${d.id}`, to: TERMINAL, kind: 'terminates' as const }),
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
