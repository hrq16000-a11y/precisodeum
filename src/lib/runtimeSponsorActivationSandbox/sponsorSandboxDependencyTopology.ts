/**
 * Phase 1.9.47 — Sandbox dependency topology over upstream layers.
 */
import { buildCanonicalGraph, type CanonicalGraph } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import { SANDBOX_UPSTREAM_LAYERS } from './sponsorSandboxInternals';

export function buildSandboxDependencyTopology(): CanonicalGraph {
  const terminal = 'sandbox:dependency-root';
  const nodes = [
    { id: terminal, kind: 'sandbox' as const },
    ...SANDBOX_UPSTREAM_LAYERS.map((l) => ({ id: `layer:${l}`, kind: 'upstream' as const })),
  ];
  const edges = SANDBOX_UPSTREAM_LAYERS.map((l) => ({
    from: `layer:${l}`,
    to: terminal,
    relation: 'feeds',
  }));
  return buildCanonicalGraph(nodes, edges);
}
