/**
 * Fase 1.9.12 — Recursive topology (READ-ONLY).
 */

import { deepFreeze } from './recursiveEquilibrium';
import type {
  ReqResolution,
  ReqSystem,
  ReqTopology,
  ReqTopologyMode,
} from './recursiveEquilibriumTypes';

export function buildRecursiveTopology(
  sys: ReqSystem,
  res: ReqResolution,
): ReqTopology {
  const parent = new Map<string, string>();
  for (const n of sys.nodes) parent.set(n.id, n.id);
  const find = (x: string): string => {
    let cur = x;
    while (parent.get(cur) !== cur) cur = parent.get(cur)!;
    return cur;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  };
  for (const e of sys.edges) {
    if (parent.has(e.source) && parent.has(e.target)) union(e.source, e.target);
  }
  const roots = new Set<string>();
  for (const n of sys.nodes) roots.add(find(n.id));

  const cyclic = res.cycles.length > 0;
  const collapsed =
    sys.nodes.length > 0 && res.points.every((p) => p.diverged);
  const unreachable = res.unreachable.length > 0;

  let mode: ReqTopologyMode;
  if (collapsed) mode = 'collapsed';
  else if (unreachable) mode = 'unreachable';
  else if (cyclic) mode = 'cyclic';
  else if (roots.size === 1) mode = 'connected';
  else mode = 'discrete';

  return deepFreeze({
    mode,
    connectedComponents: roots.size,
    cyclic,
    collapsed,
    unreachable,
  });
}
