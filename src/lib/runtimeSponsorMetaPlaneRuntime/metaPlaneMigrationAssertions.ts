/**
 * Phase 1.9.46 — Migration assertions (read-only).
 *
 * Validates bit-stability invariants any caller migrating to the shared
 * runtime MUST satisfy. Returns booleans; never throws, never mutates.
 */
import { signObject } from './metaPlaneFNV';

export interface MigrationCheck {
  readonly key: string;
  readonly legacySignature: string;
  readonly payload: unknown;
}

export interface MigrationReport {
  readonly version: 'v1';
  readonly total: number;
  readonly stable: number;
  readonly drifted: ReadonlyArray<string>;
  readonly bitStable: boolean;
}

export function assertNoSignatureDrift(checks: ReadonlyArray<MigrationCheck>): MigrationReport {
  const drifted: string[] = [];
  for (const c of checks) {
    if (signObject(c.payload) !== c.legacySignature) drifted.push(c.key);
  }
  return Object.freeze({
    version: 'v1' as const,
    total: checks.length,
    stable: checks.length - drifted.length,
    drifted: Object.freeze(drifted),
    bitStable: drifted.length === 0,
  });
}

export function assertNoUpstreamMutation(
  before: ReadonlyArray<{ key: string; signature: string }>,
  after: ReadonlyArray<{ key: string; signature: string }>,
): boolean {
  if (before.length !== after.length) return false;
  const byKey = new Map(after.map((a) => [a.key, a.signature]));
  for (const b of before) if (byKey.get(b.key) !== b.signature) return false;
  return true;
}
