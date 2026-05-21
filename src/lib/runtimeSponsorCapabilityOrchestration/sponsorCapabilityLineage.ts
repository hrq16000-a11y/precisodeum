/**
 * Phase 1.9.24 — Sponsor Capability Lineage.
 * Deterministic per-capability evolution history (surface::id → versions).
 */
import { deepFreeze, signObject } from './sponsorCapabilityInternals';
import type { SponsorCapabilityRegistry } from './sponsorCapabilityRegistry';
import type { SponsorCapabilityDefinition } from './sponsorCapabilityDefinitions';

export interface SponsorCapabilityLineageEntry {
  readonly key: string;
  readonly versions: ReadonlyArray<number>;
  readonly signatures: ReadonlyArray<string>;
  readonly entrySignature: string;
}

export interface SponsorCapabilityLineage {
  readonly entries: ReadonlyArray<SponsorCapabilityLineageEntry>;
  readonly lineageSignature: string;
}

export function computeCapabilityLineage(
  registry: SponsorCapabilityRegistry,
): SponsorCapabilityLineage {
  const byKey = new Map<string, SponsorCapabilityDefinition[]>();
  for (const c of registry.capabilities) {
    const key = `${c.surface}::${c.id}`;
    const list = byKey.get(key) ?? [];
    list.push(c);
    byKey.set(key, list);
  }
  const entries: SponsorCapabilityLineageEntry[] = [];
  for (const key of [...byKey.keys()].sort()) {
    const list = (byKey.get(key) ?? []).slice().sort((a, b) => a.version - b.version);
    const versions = Object.freeze(list.map((c) => c.version));
    const signatures = Object.freeze(list.map((c) => c.capabilitySignature));
    const entrySignature = signObject({ key, versions, signatures });
    entries.push(Object.freeze({ key, versions, signatures, entrySignature }));
  }
  const lineageSignature = signObject(entries.map((e) => e.entrySignature));
  return deepFreeze({
    entries: Object.freeze(entries),
    lineageSignature,
  });
}
