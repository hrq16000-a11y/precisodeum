/**
 * Fase 1.9.12 — Recursive closure (READ-ONLY).
 */

import { deepFreeze, reqSignature } from './recursiveEquilibrium';
import type {
  ReqClosure,
  ReqResolution,
  ReqSystem,
} from './recursiveEquilibriumTypes';

export function buildRecursiveClosure(
  sys: ReqSystem,
  res: ReqResolution,
): ReqClosure {
  const reachable = new Set<string>();
  for (const p of res.points) for (const id of p.path) reachable.add(id);
  const missing = sys.nodes
    .map((n) => n.id)
    .filter((id) => !reachable.has(id))
    .sort();
  const closed = missing.length === 0 && res.unreachable.length === 0;
  const signature = reqSignature({
    closed,
    missing,
    sysSig: sys.signature,
  });
  return deepFreeze({
    closed,
    missing: Object.freeze(missing),
    signature,
  });
}
