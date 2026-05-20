import type { CategoryObject, CategoryStabilityClass, RuntimeStabilityCategory } from './categoryTypes';

function avg(ns: readonly number[]): number { if (ns.length === 0) return 1; return ns.reduce((a, b) => a + b, 0) / ns.length; }

export function calculateCategoryBalance(objects: readonly CategoryObject[]): number {
  if (objects.length === 0) return 1;
  const p = avg(objects.map((o) => o.preservation));
  const c = avg(objects.map((o) => o.coherence));
  const i = avg(objects.map((o) => o.identity));
  return Math.max(0, Math.min(1, (p + c + i) / 3));
}

export function detectCategoryCollapse(objects: readonly CategoryObject[]): boolean {
  if (objects.length === 0) return false;
  const broken = objects.filter((o) => o.identity <= 0 && o.preservation <= 0).length;
  return broken / objects.length >= 0.5;
}

export function normalizeCategoryState(objects: readonly CategoryObject[]): readonly CategoryObject[] {
  const sorted = [...objects].sort((a, b) => a.id.localeCompare(b.id));
  return Object.freeze(sorted.map((o) => Object.freeze({ ...o, morphisms: Object.freeze([...o.morphisms].sort()) })));
}

export function buildStabilityCategory(objects: readonly CategoryObject[]): RuntimeStabilityCategory {
  const norm = normalizeCategoryState(objects);
  const balance = calculateCategoryBalance(norm);
  const collapsed = detectCategoryCollapse(norm);
  let classification: CategoryStabilityClass = 'STABLE';
  if (collapsed) classification = 'COLLAPSED';
  else if (balance < 0.3) classification = 'FRACTURED';
  else if (balance < 0.6) classification = 'TRANSFORMING';
  else if (balance >= 0.95) classification = 'IDENTITY';
  const signature = `cat:${norm.length}:${classification}:${balance.toFixed(4)}`;
  return Object.freeze({ objects: norm, classification, balance, collapsed, signature });
}
