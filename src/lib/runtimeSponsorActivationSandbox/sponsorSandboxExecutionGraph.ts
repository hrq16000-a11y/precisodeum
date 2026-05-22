/**
 * Phase 1.9.47 — Sandbox execution graph.
 */
import { buildCanonicalGraph, type CanonicalGraph } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import { SANDBOX_ROLLOUT_STAGES } from './sponsorSandboxInternals';

export function buildSandboxExecutionGraph(): CanonicalGraph {
  const terminal = 'sandbox:terminal';
  const nodes = [
    { id: terminal, kind: 'sandbox' as const },
    ...SANDBOX_ROLLOUT_STAGES.map((s) => ({ id: `stage:${s}`, kind: 'stage' as const })),
  ];
  const edges = [];
  for (let i = 1; i < SANDBOX_ROLLOUT_STAGES.length; i++) {
    edges.push({
      from: `stage:${SANDBOX_ROLLOUT_STAGES[i - 1]}`,
      to: `stage:${SANDBOX_ROLLOUT_STAGES[i]}`,
      relation: 'progresses_to',
    });
  }
  edges.push({
    from: `stage:${SANDBOX_ROLLOUT_STAGES[SANDBOX_ROLLOUT_STAGES.length - 1]}`,
    to: terminal,
    relation: 'completes',
  });
  return buildCanonicalGraph(nodes, edges);
}
