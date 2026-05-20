/**
 * Fase 1.9.12 — Recursive determinism (byte-equivalent replay).
 */

import { deepFreeze, reqSignature } from './recursiveEquilibrium';
import { normalizeRecursiveSystem } from './recursiveNormalization';
import type { ReqDeterminism, ReqSystem } from './recursiveEquilibriumTypes';

const REPLAYS = 3;

export function buildRecursiveDeterminism(sys: ReqSystem): ReqDeterminism {
  const sigs: string[] = [];
  for (let i = 0; i < REPLAYS; i += 1) {
    sigs.push(reqSignature(normalizeRecursiveSystem(sys)));
  }
  const stable = sigs.every((s) => s === sigs[0]);
  return deepFreeze({
    stable,
    signature: sigs[0],
    replays: REPLAYS,
  });
}
