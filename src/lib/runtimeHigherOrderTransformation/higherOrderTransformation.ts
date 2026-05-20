import type { HigherOrderClass, HigherOrderComponent, RuntimeHigherOrderTransformation } from './higherOrderTypes';

export function calculateHigherOrderScore(comps: readonly HigherOrderComponent[]): number {
  if (comps.length === 0) return 1;
  return comps.reduce((a, c) => a + (c.naturality + c.functoriality + c.lift) / 3, 0) / comps.length;
}

export function detectHigherOrderCollapse(comps: readonly HigherOrderComponent[]): boolean {
  if (comps.length === 0) return false;
  return comps.every((c) => c.naturality <= 0.05 && c.functoriality <= 0.05 && c.lift <= 0.05);
}

export function detectRecursiveHigherOrder(comps: readonly HigherOrderComponent[]): boolean {
  for (const c of comps) if (c.morphisms.includes(c.id)) return true;
  return false;
}

export function classifyHigherOrder(score: number, collapsed: boolean, recursive: boolean): HigherOrderClass {
  if (collapsed) return 'DEGENERATE';
  if (recursive) return 'BROKEN';
  if (score < 0.3) return 'PARTIAL';
  if (score < 0.7) return 'WEAKLY_HIGHER';
  return 'HIGHER_ORDER';
}

export function buildHigherOrderTransformation(comps: readonly HigherOrderComponent[]): RuntimeHigherOrderTransformation {
  const sorted = Object.freeze([...comps].sort((a, b) => a.id.localeCompare(b.id)));
  const score = calculateHigherOrderScore(sorted);
  const collapsed = detectHigherOrderCollapse(sorted);
  const recursive = detectRecursiveHigherOrder(sorted);
  const cls = classifyHigherOrder(score, collapsed, recursive);
  const signature = `ho:${cls}:${score.toFixed(6)}:${sorted.map((c) => c.signature).join('|')}`;
  return Object.freeze({ components: sorted, class: cls, score, collapsed, signature });
}
