/**
 * Phase 1.9.46 — Compatibility adapters.
 *
 * Read-only adapters that allow upstream planes (1.9.28 → 1.9.45) to OPT-IN
 * to the shared runtime without changing any public signature, payload, or
 * envelope. Upstream planes remain bit-identical.
 */
import { signObject } from './metaPlaneFNV';
import { canonicalize } from './metaPlaneStableSerialization';
import { deepFreeze } from './metaPlaneDeepFreeze';

export const compatibilitySignObject = signObject;
export const compatibilityCanonicalize = canonicalize;
export const compatibilityDeepFreeze = deepFreeze;

/**
 * Verifies that a candidate signature produced by the shared runtime matches
 * a known-good signature produced by a legacy per-plane implementation.
 */
export function assertSignatureCompatibility(
  legacySignature: string,
  payload: unknown,
): boolean {
  return legacySignature === signObject(payload);
}
