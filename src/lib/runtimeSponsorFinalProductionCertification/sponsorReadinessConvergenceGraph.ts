/**
 * Readiness Convergence Graph — grafo canônico de convergência.
 */
import { convergeEcosystemReadiness } from './sponsorReadinessConvergenceEngine';

export interface ConvergenceEdge {
  readonly from: string;
  readonly to: string;
}

export function buildReadinessConvergenceGraph(): readonly ConvergenceEdge[] {
  const pts = convergeEcosystemReadiness().points;
  const edges: ConvergenceEdge[] = [];
  for (const p of pts) {
    edges.push(Object.freeze({ from: p.dimension, to: 'TERMINAL_READINESS' }));
  }
  edges.sort((a, b) => (a.from + '→' + a.to).localeCompare(b.from + '→' + b.to));
  return Object.freeze(edges);
}
