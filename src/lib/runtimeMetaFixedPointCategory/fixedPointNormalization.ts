/**
 * Fase 1.9.11 — Canonical normalization (READ-ONLY, idempotent).
 */

import { deepFreeze, fpcSignature, stableStringify } from './fixedPointCategory';
import type {
  FpcCategory,
  FpcNormalization,
  FpcReductionMode,
} from './fixedPointCategoryTypes';

export function normalizeCategory(cat: FpcCategory): string {
  return stableStringify({
    id: cat.id,
    objects: [...cat.objects]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((o) => ({ id: o.id, layer: o.layer, value: o.value })),
    morphisms: [...cat.morphisms]
      .sort(
        (a, b) =>
          a.id.localeCompare(b.id) ||
          a.source.localeCompare(b.source) ||
          a.target.localeCompare(b.target),
      )
      .map((m) => ({ id: m.id, s: m.source, t: m.target, w: m.weight })),
  });
}

export function buildNormalization(cat: FpcCategory): FpcNormalization {
  const a = normalizeCategory(cat);
  const b = normalizeCategory(cat);
  const idempotent = a === b;
  const mode: FpcReductionMode = idempotent ? 'idempotent' : 'unstable';
  return deepFreeze({
    signature: fpcSignature(a),
    idempotent,
    mode,
  });
}
