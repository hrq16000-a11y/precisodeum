/**
 * Phase 1.9.24 — Sponsor Capability Definitions.
 * Canonical types & normalization for deterministic capabilities.
 */
import {
  SponsorCapabilityMutationError,
  deepFreeze,
  signObject,
} from './sponsorCapabilityInternals';

export type SponsorCapabilitySurface =
  | 'mesh'
  | 'finalizer'
  | 'campaign'
  | 'temporal'
  | 'contract'
  | 'api'
  | 'stabilization'
  | 'consistency'
  | 'audit'
  | 'governance';

export const SPONSOR_CAPABILITY_SURFACE_ORDER: ReadonlyArray<SponsorCapabilitySurface> =
  Object.freeze([
    'mesh',
    'finalizer',
    'campaign',
    'temporal',
    'contract',
    'api',
    'stabilization',
    'consistency',
    'audit',
    'governance',
  ]);

export type SponsorCapabilityScope = 'system' | 'product' | 'consumer';

export const SPONSOR_CAPABILITY_SCOPE_ORDER: ReadonlyArray<SponsorCapabilityScope> =
  Object.freeze(['system', 'product', 'consumer']);

export type SponsorEntitlementStatus = 'enabled' | 'disabled' | 'shadow';

export interface SponsorCapabilityDefinitionInput {
  readonly id: string;
  readonly version: number;
  readonly surface: SponsorCapabilitySurface;
  readonly scope: SponsorCapabilityScope;
  readonly entitlement: SponsorEntitlementStatus;
  readonly requires?: ReadonlyArray<string>;
  readonly frozen?: boolean;
}

export interface SponsorCapabilityDefinition {
  readonly id: string;
  readonly version: number;
  readonly surface: SponsorCapabilitySurface;
  readonly scope: SponsorCapabilityScope;
  readonly entitlement: SponsorEntitlementStatus;
  readonly requires: ReadonlyArray<string>;
  readonly frozen: boolean;
  readonly capabilitySignature: string;
}

function validateId(id: string): void {
  if (typeof id !== 'string' || id.length === 0) {
    throw new SponsorCapabilityMutationError(`invalid capability id: ${String(id)}`);
  }
  if (!/^[a-z0-9_.:-]+$/i.test(id)) {
    throw new SponsorCapabilityMutationError(`capability id has invalid chars: ${id}`);
  }
}

export function normalizeCapability(
  input: SponsorCapabilityDefinitionInput,
): SponsorCapabilityDefinition {
  validateId(input.id);
  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new SponsorCapabilityMutationError(`invalid capability version: ${input.version}`);
  }
  if (!SPONSOR_CAPABILITY_SURFACE_ORDER.includes(input.surface)) {
    throw new SponsorCapabilityMutationError(`invalid surface: ${input.surface}`);
  }
  if (!SPONSOR_CAPABILITY_SCOPE_ORDER.includes(input.scope)) {
    throw new SponsorCapabilityMutationError(`invalid scope: ${input.scope}`);
  }
  const requires = Object.freeze([...(input.requires ?? [])].sort());
  for (const r of requires) validateId(r);
  const frozen = input.frozen === true;
  const capabilitySignature = signObject({
    id: input.id,
    version: input.version,
    surface: input.surface,
    scope: input.scope,
    entitlement: input.entitlement,
    requires,
    frozen,
  });
  return deepFreeze({
    id: input.id,
    version: input.version,
    surface: input.surface,
    scope: input.scope,
    entitlement: input.entitlement,
    requires,
    frozen,
    capabilitySignature,
  });
}
