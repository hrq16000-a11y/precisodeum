/**
 * Fase 1.9.11 — Fixed-Point Category builder + resolution (READ-ONLY).
 */

import type {
  FpcCategory,
  FpcConvergenceClass,
  FpcFixedPoint,
  FpcMorphism,
  FpcObject,
  FpcResolution,
} from './fixedPointCategoryTypes';

const MAX_ITER = 64;

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const k of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[k]);
  }
  return value;
}

export function fpcSignature(value: unknown): string {
  return fnv1a(stableStringify(value));
}

export function buildFixedPointCategory(
  id: string,
  objects: readonly FpcObject[],
  morphisms: readonly FpcMorphism[],
): FpcCategory {
  const sortedObjects = [...objects].sort((a, b) => a.id.localeCompare(b.id));
  const sortedMorphisms = [...morphisms].sort((a, b) =>
    a.id.localeCompare(b.id) ||
    a.source.localeCompare(b.source) ||
    a.target.localeCompare(b.target),
  );
  const cat = {
    id,
    objects: Object.freeze(sortedObjects.map((o) => Object.freeze({ ...o }))),
    morphisms: Object.freeze(sortedMorphisms.map((m) => Object.freeze({ ...m }))),
    signature: '',
  } as { -readonly [K in keyof FpcCategory]: FpcCategory[K] };
  cat.signature = fpcSignature({
    id,
    objects: cat.objects,
    morphisms: cat.morphisms,
  });
  return deepFreeze(cat) as FpcCategory;
}

function indexObjects(cat: FpcCategory): ReadonlyMap<string, FpcObject> {
  const m = new Map<string, FpcObject>();
  for (const o of cat.objects) m.set(o.id, o);
  return m;
}

function successorsOf(cat: FpcCategory): ReadonlyMap<string, readonly string[]> {
  const m = new Map<string, string[]>();
  for (const o of cat.objects) m.set(o.id, []);
  for (const mo of cat.morphisms) {
    const list = m.get(mo.source);
    if (list) list.push(mo.target);
  }
  for (const [k, v] of m) m.set(k, [...v].sort());
  return m;
}

function classify(iter: number, cycle: boolean, diverged: boolean): FpcConvergenceClass {
  if (diverged) return 'DIVERGENT';
  if (cycle) return 'OSCILLATING';
  if (iter === 0) return 'SEALED';
  if (iter >= MAX_ITER) return 'DIVERGENT';
  if (iter <= 2) return 'STABLE';
  return 'EVENTUAL';
}

export function resolveFixedPoint(cat: FpcCategory, startId: string): FpcFixedPoint {
  const objs = indexObjects(cat);
  const succ = successorsOf(cat);
  const path: string[] = [];
  const indexInPath = new Map<string, number>();
  let curId: string | undefined = startId;
  let steps = 0;
  let cycle = false;
  let prev = -Infinity;
  let increasing = 0;

  while (curId && steps < MAX_ITER) {
    const cur = objs.get(curId);
    if (!cur) break;
    if (indexInPath.has(curId)) {
      cycle = true;
      break;
    }
    indexInPath.set(curId, path.length);
    path.push(curId);
    if (cur.value > prev) increasing += 1;
    prev = cur.value;
    const nexts = succ.get(curId) ?? [];
    curId = nexts[0];
    steps += 1;
  }
  const diverged = steps >= MAX_ITER && increasing >= MAX_ITER / 2;
  const cls = classify(steps, cycle, diverged);
  return deepFreeze({
    id: startId,
    path: Object.freeze([...path]),
    iterations: steps,
    stable: !cycle && !diverged && steps < MAX_ITER,
    cycle,
    diverged,
    convergenceClass: cls,
  });
}

export function resolveFixedPointCategory(cat: FpcCategory): FpcResolution {
  const fps = cat.objects.map((o) => resolveFixedPoint(cat, o.id));
  const cycles: string[][] = [];
  const seenCycle = new Set<string>();
  for (const fp of fps) {
    if (!fp.cycle) continue;
    const key = [...fp.path].sort().join('>');
    if (seenCycle.has(key)) continue;
    seenCycle.add(key);
    cycles.push([...fp.path]);
  }
  cycles.sort((a, b) => a.join('>').localeCompare(b.join('>')));
  const reachable = new Set<string>();
  for (const fp of fps) for (const p of fp.path) reachable.add(p);
  const unreachable = cat.objects
    .map((o) => o.id)
    .filter((id) => !reachable.has(id))
    .sort();
  return deepFreeze({
    category: cat,
    fixedPoints: Object.freeze([...fps].sort((a, b) => a.id.localeCompare(b.id))),
    cycles: Object.freeze(cycles.map((c) => Object.freeze(c))),
    unreachable: Object.freeze(unreachable),
  });
}
