import type { FunctorClass, FunctorObject, RuntimeEquilibriumFunctor } from './functorTypes';

export function calculateFunctorPreservation(objs: readonly FunctorObject[]): number {
  if (objs.length === 0) return 1;
  return objs.reduce((a, o) => a + o.preservation, 0) / objs.length;
}

export function detectFunctorCollapse(objs: readonly FunctorObject[]): boolean {
  if (objs.length === 0) return false;
  return objs.every((o) => o.preservation <= 0.05 && o.identity <= 0.05);
}

export function detectRecursiveFunctor(objs: readonly FunctorObject[]): boolean {
  for (const o of objs) if (o.morphisms.includes(o.id)) return true;
  return false;
}

export function classifyFunctor(preservation: number, collapsed: boolean, recursive: boolean): FunctorClass {
  if (collapsed) return 'DEGENERATE';
  if (recursive) return 'RECURSIVE';
  if (preservation < 0.3) return 'DISTORTING';
  if (preservation < 0.7) return 'WEAKLY_PRESERVING';
  return 'PRESERVING';
}

export function buildEquilibriumFunctor(objs: readonly FunctorObject[]): RuntimeEquilibriumFunctor {
  const sorted = Object.freeze([...objs].sort((a, b) => a.id.localeCompare(b.id)));
  const preservation = calculateFunctorPreservation(sorted);
  const collapsed = detectFunctorCollapse(sorted);
  const recursive = detectRecursiveFunctor(sorted);
  const cls = classifyFunctor(preservation, collapsed, recursive);
  const signature = `func:${cls}:${preservation.toFixed(6)}:${sorted.map((o) => o.signature).join('|')}`;
  return Object.freeze({ objects: sorted, class: cls, preservation, collapsed, signature });
}
