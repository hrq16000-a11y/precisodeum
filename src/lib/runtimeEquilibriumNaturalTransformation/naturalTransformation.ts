import type { NaturalClass, NaturalComponent, RuntimeNaturalTransformation } from './naturalTransformationTypes';

export function calculateNaturality(comps: readonly NaturalComponent[]): number {
  if (comps.length === 0) return 1;
  return comps.reduce((a, c) => a + c.naturality, 0) / comps.length;
}

export function detectNaturalCollapse(comps: readonly NaturalComponent[]): boolean {
  if (comps.length === 0) return false;
  return comps.every((c) => c.naturality <= 0.05 && c.identity <= 0.05);
}

export function detectRecursiveNatural(comps: readonly NaturalComponent[]): boolean {
  for (const c of comps) if (c.morphisms.includes(c.id)) return true;
  return false;
}

export function classifyNatural(naturality: number, collapsed: boolean, recursive: boolean): NaturalClass {
  if (collapsed) return 'DEGENERATE';
  if (recursive) return 'BROKEN';
  if (naturality < 0.3) return 'PARTIAL';
  if (naturality < 0.7) return 'WEAKLY_NATURAL';
  return 'NATURAL';
}

export function buildNaturalTransformation(comps: readonly NaturalComponent[]): RuntimeNaturalTransformation {
  const sorted = Object.freeze([...comps].sort((a, b) => a.id.localeCompare(b.id)));
  const naturality = calculateNaturality(sorted);
  const collapsed = detectNaturalCollapse(sorted);
  const recursive = detectRecursiveNatural(sorted);
  const cls = classifyNatural(naturality, collapsed, recursive);
  const signature = `nat:${cls}:${naturality.toFixed(6)}:${sorted.map((c) => c.signature).join('|')}`;
  return Object.freeze({ components: sorted, class: cls, naturality, collapsed, signature });
}
