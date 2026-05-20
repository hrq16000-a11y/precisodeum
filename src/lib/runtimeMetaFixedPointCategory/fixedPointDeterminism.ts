/**
 * Fase 1.9.11 — Determinism (byte-equivalent replay).
 */

import { deepFreeze, fpcSignature } from './fixedPointCategory';
import { normalizeCategory } from './fixedPointNormalization';
import type { FpcCategory, FpcDeterminism } from './fixedPointCategoryTypes';

const REPLAYS = 3;

export function buildDeterminism(cat: FpcCategory): FpcDeterminism {
  const sigs: string[] = [];
  for (let i = 0; i < REPLAYS; i += 1) {
    sigs.push(fpcSignature(normalizeCategory(cat)));
  }
  const stable = sigs.every((s) => s === sigs[0]);
  return deepFreeze({
    stable,
    signature: sigs[0],
    replays: REPLAYS,
  });
}
