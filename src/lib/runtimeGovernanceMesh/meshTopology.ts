import type {
  LayerSnapshot,
  MeshTopology,
  MeshTopologyState,
  RuntimeLayer,
} from './meshTypes';

// Deterministic shared boundary edges between layers (read-only graph).
const SHARED_BOUNDARIES: ReadonlyArray<readonly [RuntimeLayer, RuntimeLayer]> = [
  ['recorder', 'history'],
  ['history', 'replay'],
  ['replay', 'causality'],
  ['causality', 'stability'],
  ['stability', 'integrity'],
  ['integrity', 'isolation'],
  ['isolation', 'enforcement'],
  ['enforcement', 'immutable-core'],
  ['certification', 'governance'],
  ['governance', 'promotion'],
  ['promotion', 'pilot'],
];

export function buildMeshTopology(layers: readonly LayerSnapshot[]): MeshTopology {
  const set = new Set(layers.map((l) => l.layer));
  const overlaps = SHARED_BOUNDARIES.filter(([a, b]) => set.has(a) && set.has(b));

  const cycles: RuntimeLayer[][] = [];
  // Detect cycles among recursive layers: any cluster of recursive layers ≥ 2 connected via SHARED_BOUNDARIES
  const recursiveLayers = layers
    .filter((l) => l.topology === 'recursive' || l.topology === 'collapsed')
    .map((l) => l.layer);
  if (recursiveLayers.length >= 2) {
    const adj = new Map<RuntimeLayer, Set<RuntimeLayer>>();
    for (const [a, b] of SHARED_BOUNDARIES) {
      if (recursiveLayers.includes(a) && recursiveLayers.includes(b)) {
        if (!adj.has(a)) adj.set(a, new Set());
        if (!adj.has(b)) adj.set(b, new Set());
        adj.get(a)!.add(b);
        adj.get(b)!.add(a);
      }
    }
    if (adj.size >= 2) {
      cycles.push(Array.from(adj.keys()).sort() as RuntimeLayer[]);
    }
  }

  const recursive = recursiveLayers.length > 0;
  const collapsed = layers.some((l) => l.topology === 'collapsed');

  const allLayersStable = layers.every((l) => l.topology === 'stable');

  let state: MeshTopologyState;
  if (collapsed) state = 'collapsed';
  else if (cycles.length > 0) state = 'circular';
  else if (recursive) state = 'recursive';
  else if (!allLayersStable && overlaps.length > SHARED_BOUNDARIES.length * 0.6) state = 'overlapping';
  else state = 'stable';

  return { state, overlaps, cycles, recursive, collapsed };
}

export function detectTopologyOverlap(t: MeshTopology): readonly (readonly [RuntimeLayer, RuntimeLayer])[] {
  return t.overlaps;
}

export function detectTopologyRecursion(t: MeshTopology): boolean {
  return t.recursive;
}

export function detectTopologyCollapse(t: MeshTopology): boolean {
  return t.collapsed;
}

export function detectCircularPropagation(t: MeshTopology): readonly (readonly RuntimeLayer[])[] {
  return t.cycles;
}

export function classifyTopologyHealth(t: MeshTopology): MeshTopologyState {
  return t.state;
}
