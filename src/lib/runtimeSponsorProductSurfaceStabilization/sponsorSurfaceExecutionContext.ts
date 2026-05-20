/**
 * Phase 1.9.20 — Sponsor Surface · Execution context.
 * Describes a single (simulated) edge invocation. Pure data — no mutation.
 */

export type SponsorSurfaceNodeRegion =
  | 'edge-na'
  | 'edge-sa'
  | 'edge-eu'
  | 'edge-ap'
  | 'edge-local';

export interface SponsorSurfaceExecutionContext {
  readonly nodeId: string;
  readonly nodeRegion: SponsorSurfaceNodeRegion;
  /** Monotonic invocation index — purely informational, NEVER used in payload. */
  readonly invocationIndex: number;
  /** Synthetic flag: was this invocation served from a cache layer? */
  readonly cachedHit: boolean;
}

export function createExecutionContext(
  partial: Partial<SponsorSurfaceExecutionContext> = {},
): SponsorSurfaceExecutionContext {
  return Object.freeze({
    nodeId: partial.nodeId ?? 'edge-local-0',
    nodeRegion: partial.nodeRegion ?? 'edge-local',
    invocationIndex:
      typeof partial.invocationIndex === 'number' && partial.invocationIndex >= 0
        ? Math.floor(partial.invocationIndex)
        : 0,
    cachedHit: partial.cachedHit === true,
  });
}
