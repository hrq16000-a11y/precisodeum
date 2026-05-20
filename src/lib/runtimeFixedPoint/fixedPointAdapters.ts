/**
 * Fase 1.9.1 — Inert adapters mapping prior runtime layers into FixedPointState.
 * READ-ONLY, no side-effects, no imports from runtime libs.
 */

import type { FixedPointState } from './fixedPointTypes';

export interface RawFixedPointInput {
  readonly id?: string;
  readonly layer: string;
  readonly stage?: string;
  readonly liveExecutionEnabled?: boolean;
  readonly retryEnabled?: boolean;
  readonly backgroundEnabled?: boolean;
  readonly realUsersAllowed?: boolean;
}

function buildSignature(input: RawFixedPointInput): string {
  return [
    input.layer,
    input.stage ?? 'STAGE_0_READ_ONLY',
    input.liveExecutionEnabled ? '1' : '0',
    input.retryEnabled ? '1' : '0',
    input.backgroundEnabled ? '1' : '0',
    input.realUsersAllowed ? '1' : '0',
  ].join('|');
}

export function adaptFixedPointState(raw: RawFixedPointInput): FixedPointState {
  return Object.freeze({
    id: raw.id ?? `${raw.layer}:0`,
    layer: raw.layer,
    stage: raw.stage ?? 'STAGE_0_READ_ONLY',
    liveExecutionEnabled: raw.liveExecutionEnabled ?? false,
    retryEnabled: raw.retryEnabled ?? false,
    backgroundEnabled: raw.backgroundEnabled ?? false,
    realUsersAllowed: raw.realUsersAllowed ?? false,
    signature: buildSignature(raw),
  });
}

export function adaptAllFixedPointStates(
  raws: readonly RawFixedPointInput[],
): readonly FixedPointState[] {
  return Object.freeze(raws.map(adaptFixedPointState));
}

const make = (layer: string) => (i?: Partial<RawFixedPointInput>) =>
  adaptFixedPointState({ ...(i ?? {}), layer });

export const adaptCanonicalAlgebraState = make('canonical-algebra');
export const adaptGovernanceMeshState = make('governance-mesh');
export const adaptImmutableCoreState = make('immutable-core');
export const adaptEnforcementState = make('enforcement');
export const adaptIsolationState = make('isolation');
export const adaptIntegrityState = make('integrity');
export const adaptStabilityState = make('stability');
export const adaptCausalityState = make('causality');
export const adaptReplayState = make('replay');
export const adaptHistoryState = make('history');
export const adaptRecorderState = make('recorder');
export const adaptCertificationState = make('certification');
export const adaptGovernanceState = make('governance');
export const adaptPromotionState = make('promotion');
export const adaptPilotState = make('pilot');

export const CANONICAL_FIXED_POINT_LAYERS: readonly string[] = Object.freeze([
  'canonical-algebra',
  'governance-mesh',
  'immutable-core',
  'enforcement',
  'isolation',
  'integrity',
  'stability',
  'causality',
  'replay',
  'history',
  'recorder',
  'certification',
  'governance',
  'promotion',
  'pilot',
]);

export function buildDefaultFixedPointStates(): readonly FixedPointState[] {
  return adaptAllFixedPointStates(
    CANONICAL_FIXED_POINT_LAYERS.map((layer) => ({ layer })),
  );
}
