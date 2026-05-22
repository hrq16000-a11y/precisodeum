/**
 * Rollout Snapshot — snapshot determinístico do estado de rollout.
 */
import { orchestrateRolloutStages } from './sponsorRolloutOrchestrationRuntime';
import { resolveRolloutDependencies } from './sponsorRolloutDependencyResolver';
import { simulateRolloutConvergence } from './sponsorRolloutConvergenceEngine';
import { buildRolloutDependencyGraph } from './sponsorRolloutDependencyGraph';
import { buildSequenceTopology } from './sponsorRolloutSequenceTopology';
import { buildConvergenceGraph } from './sponsorRolloutConvergenceGraph';

function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}';
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

export interface RolloutSnapshot {
  readonly stages: ReturnType<typeof orchestrateRolloutStages>;
  readonly dependencies: ReturnType<typeof resolveRolloutDependencies>;
  readonly convergence: ReturnType<typeof simulateRolloutConvergence>;
  readonly dependencyGraph: ReturnType<typeof buildRolloutDependencyGraph>;
  readonly sequenceTopology: ReturnType<typeof buildSequenceTopology>;
  readonly convergenceGraph: ReturnType<typeof buildConvergenceGraph>;
  readonly signature: string;
}

export function buildRolloutSnapshot(): RolloutSnapshot {
  const body = {
    stages: orchestrateRolloutStages(),
    dependencies: resolveRolloutDependencies(),
    convergence: simulateRolloutConvergence(),
    dependencyGraph: buildRolloutDependencyGraph(),
    sequenceTopology: buildSequenceTopology(),
    convergenceGraph: buildConvergenceGraph(),
  };
  const signature = djb2(canonical(body));
  return Object.freeze({ ...body, signature });
}
