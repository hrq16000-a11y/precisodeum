import type { FunctorObject, RuntimeFunctorTopology, TopologyClass } from './functorTypes';

export function buildFunctorTopology(objs: readonly FunctorObject[]): RuntimeFunctorTopology {
  if (objs.length === 0) return Object.freeze({ class: 'STABLE', connectivity: 1, unstable: false, collapsed: false });
  const ids = new Set(objs.map((o) => o.id));
  let edges = 0;
  let valid = 0;
  for (const o of objs) for (const m of o.morphisms) { edges++; if (ids.has(m)) valid++; }
  const connectivity = edges === 0 ? 1 : valid / edges;
  let cls: TopologyClass = 'STABLE';
  if (connectivity <= 0.1) cls = 'COLLAPSED';
  else if (connectivity < 0.5) cls = 'UNSTABLE';
  else if (connectivity < 0.85) cls = 'WEAK';
  return Object.freeze({ class: cls, connectivity, unstable: cls === 'UNSTABLE' || cls === 'COLLAPSED', collapsed: cls === 'COLLAPSED' });
}
