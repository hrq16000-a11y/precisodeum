/**
 * Phase 1.9.24 — Sponsor Capability Compatibility Graph.
 * Validates capability dependencies and version monotonicity deterministically.
 */
import {
  SponsorCapabilityCompatibilityError,
  deepFreeze,
  signObject,
} from './sponsorCapabilityInternals';
import type { SponsorCapabilityRegistry } from './sponsorCapabilityRegistry';

export interface SponsorCapabilityCompatibilityEdge {
  readonly from: string;
  readonly to: string;
}

export interface SponsorCapabilityCompatibilityGraph {
  readonly nodes: ReadonlyArray<string>;
  readonly edges: ReadonlyArray<SponsorCapabilityCompatibilityEdge>;
  readonly graphSignature: string;
  readonly compatible: true;
}

export function validateCapabilityCompatibility(
  registry: SponsorCapabilityRegistry,
): SponsorCapabilityCompatibilityGraph {
  const versionByKey = new Map<string, number>();
  const allIds = new Set<string>();
  const edgeSet = new Set<string>();
  const edges: SponsorCapabilityCompatibilityEdge[] = [];

  for (const cap of registry.capabilities) {
    allIds.add(cap.id);
    const key = `${cap.surface}::${cap.id}`;
    const prev = versionByKey.get(key);
    if (prev !== undefined && cap.version <= prev) {
      throw new SponsorCapabilityCompatibilityError(
        `non-monotonic capability version for ${key}: ${prev} → ${cap.version}`,
      );
    }
    versionByKey.set(key, cap.version);
    if (cap.frozen && registry.capabilities.some(
      (o) => o.surface === cap.surface && o.id === cap.id && o.version > cap.version,
    )) {
      throw new SponsorCapabilityCompatibilityError(
        `frozen capability ${key} cannot have newer version coexisting`,
      );
    }
  }

  for (const cap of registry.capabilities) {
    for (const req of cap.requires) {
      if (!allIds.has(req)) {
        throw new SponsorCapabilityCompatibilityError(
          `capability ${cap.id} requires unknown ${req}`,
        );
      }
      const edgeKey = `${cap.id}→${req}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        edges.push(Object.freeze({ from: cap.id, to: req }));
      }
    }
  }

  const nodes = Object.freeze([...allIds].sort());
  const sortedEdges = Object.freeze(
    [...edges].sort((a, b) =>
      a.from === b.from ? (a.to < b.to ? -1 : 1) : a.from < b.from ? -1 : 1,
    ),
  );
  const graphSignature = signObject({
    nodes,
    edges: sortedEdges.map((e) => `${e.from}→${e.to}`),
  });
  return deepFreeze({
    nodes,
    edges: sortedEdges,
    graphSignature,
    compatible: true as const,
  });
}
