/**
 * Phase 1.9.43 — Sponsor Transcendent Identity Graph.
 */
import { deepFreeze, signObject } from './sponsorTranscendentInternals';
import type { SponsorTranscendentInvariantRegistry } from './sponsorTranscendentInvariants';
import type { SponsorUniversalSelfEquivalenceProofs } from './sponsorUniversalSelfEquivalenceProofs';

export type SponsorTranscendentEdgeKind = 'sequence' | 'certifies' | 'transcends';

export interface SponsorTranscendentNode {
  readonly id: string;
  readonly kind: 'layer' | 'invariant' | 'transcendence';
}

export interface SponsorTranscendentEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SponsorTranscendentEdgeKind;
}

export interface SponsorTranscendentIdentityGraph {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorTranscendentNode>;
  readonly edges: ReadonlyArray<SponsorTranscendentEdge>;
  readonly graphSignature: string;
}

const TRANSCENDENCE = 'transcendence:universal';

export function resolveTranscendentIdentityGraph(
  invariants: SponsorTranscendentInvariantRegistry,
  proofs: SponsorUniversalSelfEquivalenceProofs,
): SponsorTranscendentIdentityGraph {
  const nodes: SponsorTranscendentNode[] = [];
  const edges: SponsorTranscendentEdge[] = [];

  for (const d of proofs.descriptors) {
    nodes.push(Object.freeze({ id: `layer:${d.id}`, kind: 'layer' as const }));
  }
  for (const inv of invariants.invariants) {
    nodes.push(Object.freeze({ id: `invariant:${inv.id}`, kind: 'invariant' as const }));
  }
  nodes.push(Object.freeze({ id: TRANSCENDENCE, kind: 'transcendence' as const }));

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
      Object.freeze({ from: `layer:${d.id}`, to: TRANSCENDENCE, kind: 'transcends' as const }),
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
