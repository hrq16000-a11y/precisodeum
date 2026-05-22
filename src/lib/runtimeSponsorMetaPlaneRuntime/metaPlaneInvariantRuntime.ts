/**
 * Phase 1.9.46 — Invariant runtime (shared, read-only).
 */
import { deepFreeze } from './metaPlaneDeepFreeze';
import { signObject } from './metaPlaneFNV';

export interface CanonicalInvariant {
  readonly id: string;
  readonly description: string;
  readonly invariantSignature: string;
}

export interface CanonicalInvariantRegistry {
  readonly version: 'v1';
  readonly invariants: ReadonlyArray<CanonicalInvariant>;
  readonly invariantsSignature: string;
}

export function normalizeInvariantSet(
  invariants: ReadonlyArray<{ id: string; description: string }>,
): ReadonlyArray<CanonicalInvariant> {
  const seen = new Set<string>();
  const sorted = [...invariants]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
    .map((i) => Object.freeze({
      id: i.id,
      description: i.description,
      invariantSignature: signObject({ id: i.id, description: i.description }),
    }));
  return Object.freeze(sorted);
}

export function buildInvariantRegistry(
  invariants: ReadonlyArray<{ id: string; description: string }>,
): CanonicalInvariantRegistry {
  const normalized = normalizeInvariantSet(invariants);
  return deepFreeze({
    version: 'v1' as const,
    invariants: normalized,
    invariantsSignature: signObject(normalized.map((i) => i.invariantSignature)),
  });
}

export function assertInvariantConsistency(registry: CanonicalInvariantRegistry): boolean {
  const ids = registry.invariants.map((i) => i.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) return false;
  for (let i = 1; i < ids.length; i++) if (ids[i - 1] > ids[i]) return false;
  return registry.invariantsSignature
    === signObject(registry.invariants.map((i) => i.invariantSignature));
}
