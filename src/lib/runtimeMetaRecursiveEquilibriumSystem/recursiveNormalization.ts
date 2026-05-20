/**
 * Fase 1.9.12 — Recursive normalization (READ-ONLY, idempotent).
 */

import { deepFreeze, reqSignature, stableStringify } from './recursiveEquilibrium';
import type {
  ReqNormalization,
  ReqReductionMode,
  ReqSystem,
} from './recursiveEquilibriumTypes';

export function normalizeRecursiveSystem(sys: ReqSystem): string {
  return stableStringify({
    id: sys.id,
    nodes: [...sys.nodes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((n) => ({ id: n.id, layer: n.layer, potential: n.potential, depth: n.depth })),
    edges: [...sys.edges]
      .sort(
        (a, b) =>
          a.id.localeCompare(b.id) ||
          a.source.localeCompare(b.source) ||
          a.target.localeCompare(b.target),
      )
      .map((e) => ({ id: e.id, s: e.source, t: e.target, w: e.weight })),
  });
}

export function buildRecursiveNormalization(sys: ReqSystem): ReqNormalization {
  const a = normalizeRecursiveSystem(sys);
  const b = normalizeRecursiveSystem(sys);
  const idempotent = a === b;
  const mode: ReqReductionMode = idempotent ? 'idempotent' : 'unstable';
  return deepFreeze({
    signature: reqSignature(a),
    idempotent,
    mode,
  });
}
