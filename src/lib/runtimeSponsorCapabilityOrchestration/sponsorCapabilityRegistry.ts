/**
 * Phase 1.9.24 — Sponsor Capability Registry.
 * Canonical, deterministic, immutable registry of capability definitions.
 */
import {
  SponsorCapabilityMutationError,
  deepFreeze,
  signObject,
} from './sponsorCapabilityInternals';
import {
  SPONSOR_CAPABILITY_SURFACE_ORDER,
  normalizeCapability,
  type SponsorCapabilityDefinition,
  type SponsorCapabilityDefinitionInput,
  type SponsorCapabilitySurface,
} from './sponsorCapabilityDefinitions';

export interface SponsorCapabilityRegistry {
  readonly capabilities: ReadonlyArray<SponsorCapabilityDefinition>;
  readonly bySurface: Readonly<
    Record<SponsorCapabilitySurface, ReadonlyArray<SponsorCapabilityDefinition>>
  >;
  readonly registrySignature: string;
}

function canonicalSort(
  caps: ReadonlyArray<SponsorCapabilityDefinition>,
): ReadonlyArray<SponsorCapabilityDefinition> {
  const surfaceRank = new Map(SPONSOR_CAPABILITY_SURFACE_ORDER.map((s, i) => [s, i]));
  return [...caps].sort((a, b) => {
    const sa = surfaceRank.get(a.surface) ?? 999;
    const sb = surfaceRank.get(b.surface) ?? 999;
    if (sa !== sb) return sa - sb;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return a.version - b.version;
  });
}

export function buildCapabilityRegistry(
  inputs: ReadonlyArray<SponsorCapabilityDefinitionInput>,
): SponsorCapabilityRegistry {
  const seen = new Set<string>();
  const normalized: SponsorCapabilityDefinition[] = [];
  for (const input of inputs) {
    const key = `${input.surface}::${input.id}::${input.version}`;
    if (seen.has(key)) {
      throw new SponsorCapabilityMutationError(`duplicate capability key: ${key}`);
    }
    seen.add(key);
    normalized.push(normalizeCapability(input));
  }
  const sorted = canonicalSort(normalized);
  const bySurface: Record<string, SponsorCapabilityDefinition[]> = {};
  for (const surface of SPONSOR_CAPABILITY_SURFACE_ORDER) bySurface[surface] = [];
  for (const c of sorted) bySurface[c.surface].push(c);
  const frozenBySurface: Record<string, ReadonlyArray<SponsorCapabilityDefinition>> = {};
  for (const surface of SPONSOR_CAPABILITY_SURFACE_ORDER) {
    frozenBySurface[surface] = Object.freeze(bySurface[surface]);
  }
  const registrySignature = signObject({
    capabilities: sorted.map((c) => c.capabilitySignature),
  });
  return deepFreeze({
    capabilities: Object.freeze(sorted),
    bySurface: Object.freeze(frozenBySurface) as Readonly<
      Record<SponsorCapabilitySurface, ReadonlyArray<SponsorCapabilityDefinition>>
    >,
    registrySignature,
  });
}

export function resolveCapabilities(
  registry: SponsorCapabilityRegistry,
  surface: SponsorCapabilitySurface,
): ReadonlyArray<SponsorCapabilityDefinition> {
  return registry.bySurface[surface] ?? Object.freeze([]);
}
