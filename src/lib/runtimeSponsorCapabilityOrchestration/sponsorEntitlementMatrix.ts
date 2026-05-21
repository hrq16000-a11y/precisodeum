/**
 * Phase 1.9.24 — Sponsor Entitlement Matrix.
 * Deterministic entitlement mapping per surface × scope × capability.
 */
import { deepFreeze, signObject } from './sponsorCapabilityInternals';
import {
  SPONSOR_CAPABILITY_SCOPE_ORDER,
  SPONSOR_CAPABILITY_SURFACE_ORDER,
  type SponsorCapabilityScope,
  type SponsorCapabilitySurface,
  type SponsorEntitlementStatus,
} from './sponsorCapabilityDefinitions';
import type { SponsorCapabilityRegistry } from './sponsorCapabilityRegistry';

export interface SponsorEntitlementCell {
  readonly surface: SponsorCapabilitySurface;
  readonly scope: SponsorCapabilityScope;
  readonly capabilityId: string;
  readonly version: number;
  readonly entitlement: SponsorEntitlementStatus;
}

export interface SponsorEntitlementMatrix {
  readonly cells: ReadonlyArray<SponsorEntitlementCell>;
  readonly enabledCount: number;
  readonly shadowCount: number;
  readonly disabledCount: number;
  readonly matrixSignature: string;
}

export function resolveEntitlementMatrix(
  registry: SponsorCapabilityRegistry,
): SponsorEntitlementMatrix {
  const cells: SponsorEntitlementCell[] = [];
  let enabledCount = 0;
  let shadowCount = 0;
  let disabledCount = 0;
  for (const surface of SPONSOR_CAPABILITY_SURFACE_ORDER) {
    for (const scope of SPONSOR_CAPABILITY_SCOPE_ORDER) {
      const caps = (registry.bySurface[surface] ?? []).filter((c) => c.scope === scope);
      for (const c of caps) {
        const cell = Object.freeze({
          surface,
          scope,
          capabilityId: c.id,
          version: c.version,
          entitlement: c.entitlement,
        });
        cells.push(cell);
        if (c.entitlement === 'enabled') enabledCount += 1;
        else if (c.entitlement === 'shadow') shadowCount += 1;
        else disabledCount += 1;
      }
    }
  }
  const matrixSignature = signObject(
    cells.map((c) => `${c.surface}:${c.scope}:${c.capabilityId}:${c.version}:${c.entitlement}`),
  );
  return deepFreeze({
    cells: Object.freeze(cells),
    enabledCount,
    shadowCount,
    disabledCount,
    matrixSignature,
  });
}
