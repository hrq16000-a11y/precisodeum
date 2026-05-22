/**
 * Rollout Dependency Graph — grafo canônico de dependências.
 */
import { resolveRolloutDependencies } from './sponsorRolloutDependencyResolver';

export interface RolloutGraphEdge {
  readonly from: string;
  readonly to: string;
}

export function buildRolloutDependencyGraph(): readonly RolloutGraphEdge[] {
  const deps = resolveRolloutDependencies();
  const edges: RolloutGraphEdge[] = [];
  for (const d of deps) {
    for (const req of d.requires) {
      edges.push(Object.freeze({ from: req, to: d.stage }));
    }
  }
  edges.sort((a, b) => (a.from + '→' + a.to).localeCompare(b.from + '→' + b.to));
  return Object.freeze(edges);
}
