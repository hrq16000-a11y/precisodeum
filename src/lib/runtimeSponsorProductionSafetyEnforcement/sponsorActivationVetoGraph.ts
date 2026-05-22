/**
 * Phase 1.9.48 — Activation veto graph.
 */
import { buildCanonicalGraph, type CanonicalGraph } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import { SAFETY_BLOCKING_VECTORS } from './sponsorSafetyInternals';
import { SPONSOR_SAFETY_INVARIANTS } from './sponsorInvariantViolationRegistry';

export function buildActivationVetoGraph(): CanonicalGraph {
  const root = 'safety:veto-root';
  const nodes = [
    { id: root, kind: 'veto' as const },
    ...SAFETY_BLOCKING_VECTORS.map((v) => ({ id: `vector:${v}`, kind: 'vector' as const })),
    ...SPONSOR_SAFETY_INVARIANTS.map((i) => ({ id: `invariant:${i.id}`, kind: 'invariant' as const })),
  ];
  const edges = [
    ...SAFETY_BLOCKING_VECTORS.map((v) => ({ from: `vector:${v}`, to: root, relation: 'vetoes' })),
    ...SPONSOR_SAFETY_INVARIANTS.map((i) => ({
      from: `invariant:${i.id}`,
      to: `vector:${i.vector}`,
      relation: 'guards',
    })),
  ];
  return buildCanonicalGraph(nodes, edges);
}
