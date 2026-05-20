/**
 * Fase 1.9.2 — Convergence space (READ-ONLY, deterministic, pure).
 */

import type { ConvergenceNode, ConvergenceSpace } from './convergenceTypes';

export interface RawConvergenceNodeInput {
  readonly id: string;
  readonly layer: string;
  readonly stage?: string;
  readonly liveExecutionEnabled?: boolean;
  readonly retryEnabled?: boolean;
  readonly backgroundEnabled?: boolean;
  readonly realUsersAllowed?: boolean;
  readonly value?: number;
  readonly successors?: readonly string[];
}

function buildSignature(n: Omit<ConvergenceNode, 'signature'>): string {
  return [
    n.id,
    n.layer,
    n.stage,
    n.liveExecutionEnabled ? '1' : '0',
    n.retryEnabled ? '1' : '0',
    n.backgroundEnabled ? '1' : '0',
    n.realUsersAllowed ? '1' : '0',
    n.value.toFixed(6),
    [...n.successors].sort().join(','),
  ].join('|');
}

function buildNode(raw: RawConvergenceNodeInput): ConvergenceNode {
  const partial: Omit<ConvergenceNode, 'signature'> = {
    id: raw.id,
    layer: raw.layer,
    stage: raw.stage ?? 'STAGE_0_READ_ONLY',
    liveExecutionEnabled: raw.liveExecutionEnabled ?? false,
    retryEnabled: raw.retryEnabled ?? false,
    backgroundEnabled: raw.backgroundEnabled ?? false,
    realUsersAllowed: raw.realUsersAllowed ?? false,
    value: raw.value ?? 0,
    successors: Object.freeze([...(raw.successors ?? [])].sort()),
  };
  return Object.freeze({ ...partial, signature: buildSignature(partial) });
}

export function buildConvergenceSpace(
  raws: readonly RawConvergenceNodeInput[],
): ConvergenceSpace {
  const nodes = raws.map(buildNode);
  return normalizeConvergenceSpace(
    Object.freeze({
      nodes: Object.freeze(nodes),
      signature: '',
      frozen: true,
    }),
  );
}

export function normalizeConvergenceSpace(space: ConvergenceSpace): ConvergenceSpace {
  const sorted = [...space.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const signature = sorted.map((n) => n.signature).join(';');
  return freezeConvergenceSpace(
    Object.freeze({
      nodes: Object.freeze(sorted),
      signature,
      frozen: true,
    }),
  );
}

export function freezeConvergenceSpace(space: ConvergenceSpace): ConvergenceSpace {
  return Object.freeze(space);
}

export function compareConvergenceSpaces(
  a: ConvergenceSpace,
  b: ConvergenceSpace,
): boolean {
  return a.signature === b.signature;
}
