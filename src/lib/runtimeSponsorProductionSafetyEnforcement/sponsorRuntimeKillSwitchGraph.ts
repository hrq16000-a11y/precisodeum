/**
 * Phase 1.9.48 — Runtime kill-switch graph.
 */
import { buildCanonicalGraph, type CanonicalGraph } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import { SAFETY_BLOCKING_VECTORS } from './sponsorSafetyInternals';

export function buildRuntimeKillSwitchGraph(): CanonicalGraph {
  const killSwitch = 'safety:kill-switch';
  const nodes = [
    { id: killSwitch, kind: 'kill_switch' as const },
    ...SAFETY_BLOCKING_VECTORS.map((v) => ({ id: `runtime:${v}`, kind: 'runtime' as const })),
  ];
  const edges = SAFETY_BLOCKING_VECTORS.map((v) => ({
    from: killSwitch,
    to: `runtime:${v}`,
    relation: 'interrupts',
  }));
  return buildCanonicalGraph(nodes, edges);
}
