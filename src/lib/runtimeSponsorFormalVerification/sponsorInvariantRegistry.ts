/**
 * Phase 1.9.28 — Sponsor Invariant Registry.
 * Canonical, frozen set of formal invariants to verify across the system.
 * READ-ONLY · ZERO BUSINESS LOGIC.
 */
import {
  SPONSOR_VERIFICATION_LAYER_ORDER,
  deepFreeze,
  signObject,
  type SponsorVerificationLayerId,
} from './sponsorVerificationInternals';

export type SponsorInvariantSeverity = 'critical' | 'structural' | 'advisory';

export interface SponsorInvariantDefinition {
  readonly id: string;
  readonly scope: SponsorVerificationLayerId | 'global';
  readonly severity: SponsorInvariantSeverity;
  readonly description: string;
  readonly definitionSignature: string;
}

const RAW_INVARIANTS: ReadonlyArray<Omit<SponsorInvariantDefinition, 'definitionSignature'>> = [
  {
    id: 'inv.global.layer-presence',
    scope: 'global',
    severity: 'critical',
    description: 'all 14 sponsor layers (1.9.14 → 1.9.27) must be present',
  },
  {
    id: 'inv.global.layer-order',
    scope: 'global',
    severity: 'critical',
    description: 'layers must appear in canonical phase order',
  },
  {
    id: 'inv.global.signature-non-empty',
    scope: 'global',
    severity: 'structural',
    description: 'every present layer must expose a non-empty signature',
  },
  {
    id: 'inv.global.signature-stability',
    scope: 'global',
    severity: 'critical',
    description: 'two runs over identical inputs must yield identical signatures',
  },
  {
    id: 'inv.global.no-upstream-mutation',
    scope: 'global',
    severity: 'critical',
    description: 'verification must not mutate any upstream layer artifact',
  },
  ...SPONSOR_VERIFICATION_LAYER_ORDER.map<
    Omit<SponsorInvariantDefinition, 'definitionSignature'>
  >((layer) => ({
    id: `inv.layer.${layer}.signature-present`,
    scope: layer,
    severity: 'structural' as const,
    description: `layer ${layer} must expose a deterministic signature`,
  })),
];

export interface SponsorInvariantRegistry {
  readonly version: 'v1';
  readonly invariants: ReadonlyArray<SponsorInvariantDefinition>;
  readonly registrySignature: string;
}

export function buildInvariantRegistry(): SponsorInvariantRegistry {
  const invariants: SponsorInvariantDefinition[] = [...RAW_INVARIANTS]
    .map((inv) => ({
      ...inv,
      definitionSignature: signObject({
        id: inv.id,
        scope: inv.scope,
        severity: inv.severity,
      }),
    }))
    // canonical ordering: scope, then id
    .sort((a, b) => {
      if (a.scope !== b.scope) return a.scope < b.scope ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((inv) => Object.freeze(inv));
  const registrySignature = signObject(invariants.map((i) => i.definitionSignature));
  return deepFreeze({
    version: 'v1' as const,
    invariants: Object.freeze(invariants),
    registrySignature,
  });
}
