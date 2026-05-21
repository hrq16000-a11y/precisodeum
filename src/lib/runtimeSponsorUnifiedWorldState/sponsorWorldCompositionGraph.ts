/**
 * Phase 1.9.26 — Sponsor World Composition Graph.
 * Canonical composition: each layer composes the cumulative state of all
 * previous layers in SPONSOR_WORLD_LAYER_ORDER. Pure structural fusion.
 */
import {
  SPONSOR_WORLD_LAYER_ORDER,
  deepFreeze,
  signObject,
  type SponsorWorldLayerId,
} from './sponsorWorldInternals';
import type { SponsorUnifiedWorldState } from './sponsorUnifiedWorldState';

export interface SponsorWorldStateCompositionNode {
  readonly layer: SponsorWorldLayerId;
  readonly index: number;
  readonly fuses: ReadonlyArray<SponsorWorldLayerId>;
  readonly compositionSignature: string;
}

export interface SponsorWorldStateCompositionEdge {
  readonly from: SponsorWorldLayerId;
  readonly to: SponsorWorldLayerId;
  readonly edgeSignature: string;
}

export interface SponsorWorldStateCompositionGraph {
  readonly nodes: ReadonlyArray<SponsorWorldStateCompositionNode>;
  readonly edges: ReadonlyArray<SponsorWorldStateCompositionEdge>;
  readonly graphSignature: string;
}

export function resolveCompositionGraph(
  world: SponsorUnifiedWorldState,
): SponsorWorldStateCompositionGraph {
  const byLayer = new Map(world.entries.map((e) => [e.layer, e]));
  const nodes: SponsorWorldStateCompositionNode[] = [];
  const edges: SponsorWorldStateCompositionEdge[] = [];

  for (let i = 0; i < SPONSOR_WORLD_LAYER_ORDER.length; i++) {
    const layer = SPONSOR_WORLD_LAYER_ORDER[i];
    const fuses: SponsorWorldLayerId[] = SPONSOR_WORLD_LAYER_ORDER.slice(0, i) as SponsorWorldLayerId[];
    const fuseSigs = fuses.map((l) => byLayer.get(l)?.entrySignature ?? '');
    const compositionSignature = signObject({
      layer,
      index: i,
      self: byLayer.get(layer)?.entrySignature ?? '',
      fuses: fuseSigs,
    });
    nodes.push(
      Object.freeze({
        layer,
        index: i,
        fuses: Object.freeze(fuses),
        compositionSignature,
      }),
    );
    if (i > 0) {
      const from = SPONSOR_WORLD_LAYER_ORDER[i - 1];
      edges.push(
        Object.freeze({
          from,
          to: layer,
          edgeSignature: signObject({ from, to: layer, kind: 'compose' }),
        }),
      );
    }
  }

  const graphSignature = signObject({
    nodes: nodes.map((n) => n.compositionSignature),
    edges: edges.map((e) => e.edgeSignature),
  });

  return deepFreeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    graphSignature,
  });
}
