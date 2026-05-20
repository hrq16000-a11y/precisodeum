/**
 * Fase 1.9.12 — Inert adapters (READ-ONLY).
 */

import { deepFreeze, reqSignature } from './recursiveEquilibrium';
import type {
  ReqEdge,
  ReqInternals,
  ReqNode,
  ReqSystem,
} from './recursiveEquilibriumTypes';

export interface RawReqNode {
  readonly id: string;
  readonly layer: string;
  readonly potential?: number;
  readonly depth?: number;
}

export interface RawReqEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly weight?: number;
}

export interface RawReqSystem {
  readonly id: string;
  readonly nodes: readonly RawReqNode[];
  readonly edges: readonly RawReqEdge[];
}

export function adaptReqNode(raw: RawReqNode): ReqNode {
  const potential =
    typeof raw.potential === 'number' && Number.isFinite(raw.potential) ? raw.potential : 0;
  const depth =
    typeof raw.depth === 'number' && Number.isFinite(raw.depth) ? raw.depth : 0;
  return deepFreeze({
    id: raw.id,
    layer: raw.layer,
    potential,
    depth,
    signature: reqSignature({ id: raw.id, layer: raw.layer, potential, depth }),
  });
}

export function adaptReqEdge(raw: RawReqEdge): ReqEdge {
  const weight =
    typeof raw.weight === 'number' && Number.isFinite(raw.weight) ? raw.weight : 1;
  return deepFreeze({
    id: raw.id,
    source: raw.source,
    target: raw.target,
    weight,
  });
}

export function adaptRecursiveSystemRaw(raw: RawReqSystem): ReqSystem {
  const nodes = raw.nodes.map(adaptReqNode);
  const edges = raw.edges.map(adaptReqEdge);
  return deepFreeze({
    id: raw.id,
    nodes: Object.freeze([...nodes].sort((a, b) => a.id.localeCompare(b.id))),
    edges: Object.freeze(
      [...edges].sort(
        (a, b) =>
          a.id.localeCompare(b.id) ||
          a.source.localeCompare(b.source) ||
          a.target.localeCompare(b.target),
      ),
    ),
    signature: reqSignature({ id: raw.id, nodes, edges }),
  });
}

export const REQ_INTERNALS: ReqInternals = deepFreeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  liveExecutionEnabled: false as const,
  retryEnabled: false as const,
  backgroundEnabled: false as const,
  realUsersAllowed: false as const,
});
