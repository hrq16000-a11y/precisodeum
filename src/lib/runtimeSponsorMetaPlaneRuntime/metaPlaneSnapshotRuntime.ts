/**
 * Phase 1.9.46 — Snapshot runtime (shared, read-only).
 */
import { deepFreeze } from './metaPlaneDeepFreeze';
import { signObject } from './metaPlaneFNV';

export interface DeterministicSnapshot<P> {
  readonly version: 'v1';
  readonly payload: P;
  readonly snapshotSignature: string;
}

export function signSnapshotPayload<P>(payload: P): string {
  return signObject(payload);
}

export function createDeterministicSnapshot<P>(payload: P): DeterministicSnapshot<P> {
  const frozen = deepFreeze(payload);
  return deepFreeze({
    version: 'v1' as const,
    payload: frozen,
    snapshotSignature: signSnapshotPayload(frozen),
  });
}

export function assertSnapshotIntegrity<P>(snap: DeterministicSnapshot<P>): boolean {
  return Object.isFrozen(snap)
    && snap.snapshotSignature === signSnapshotPayload(snap.payload);
}
