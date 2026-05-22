/**
 * Phase 1.9.48 — Execution interdiction matrix.
 */
import { signObject } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import { SAFETY_BLOCKING_VECTORS, type SponsorSafetyBlockingVector } from './sponsorSafetyInternals';

export interface SponsorInterdictionEntry {
  readonly vector: SponsorSafetyBlockingVector;
  readonly decision: 'BLOCK';
  readonly entrySignature: string;
}

export interface SponsorExecutionInterdictionMatrix {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorInterdictionEntry>;
  readonly matrixSignature: string;
}

export function buildExecutionInterdictionMatrix(): SponsorExecutionInterdictionMatrix {
  const entries: SponsorInterdictionEntry[] = [...SAFETY_BLOCKING_VECTORS]
    .sort()
    .map((vector) =>
      Object.freeze({
        vector,
        decision: 'BLOCK' as const,
        entrySignature: signObject({ vector, decision: 'BLOCK' }),
      }),
    );
  return Object.freeze({
    version: 'v1' as const,
    entries: Object.freeze(entries),
    matrixSignature: signObject(entries.map((e) => e.entrySignature)),
  });
}
