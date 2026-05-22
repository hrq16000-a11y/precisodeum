/**
 * Phase 1.9.46 — djb2/FNV-style stable string hash.
 * MUST be bit-identical to per-plane djb2() implementations.
 */
import { canonicalize } from './metaPlaneStableSerialization';

export function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function signObject(value: unknown): string {
  return djb2(canonicalize(value));
}
