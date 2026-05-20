/**
 * Fase 1.9.11 — Topology classification (READ-ONLY).
 */

import { deepFreeze } from './fixedPointCategory';
import type {
  FpcCategory,
  FpcResolution,
  FpcTopology,
  FpcTopologyMode,
} from './fixedPointCategoryTypes';

export function buildTopology(cat: FpcCategory, res: FpcResolution): FpcTopology {
  // Connected components via union-find over morphisms.
  const parent = new Map<string, string>();
  for (const o of cat.objects) parent.set(o.id, o.id);
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
  for (const m of cat.morphisms) {
    if (parent.has(m.source) && parent.has(m.target)) union(m.source, m.target);
  }
  const roots = new Set<string>();
  for (const o of cat.objects) roots.add(find(o.id));

  const cyclic = res.cycles.length > 0;
  const collapsed = cat.objects.length > 0 && res.fixedPoints.every((f) => f.diverged);
  const unreachable = res.unreachable.length > 0;
  let mode: FpcTopologyMode;
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
