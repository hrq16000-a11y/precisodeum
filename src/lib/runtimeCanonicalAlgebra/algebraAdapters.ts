/**
 * Inert adapters mapping the 14 previous runtime layers into RuntimeState.
 * READ-ONLY, deterministic, no side effects, no imports from runtime libs.
 */

import { CANONICAL_LAYERS, type CanonicalLayer, type RuntimeState } from './algebraTypes';

export interface RawStateInput {
  readonly id?: string;
  readonly layer: CanonicalLayer;
  readonly stage?: string;
  readonly liveExecutionEnabled?: boolean;
  readonly retryEnabled?: boolean;
  readonly backgroundEnabled?: boolean;
  readonly realUsersAllowed?: boolean;
  readonly classification?: RuntimeState['classification'];
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
}

export function adaptState(raw: RawStateInput): RuntimeState {
  return Object.freeze({
    id: raw.id ?? `${raw.layer}:0`,
    layer: raw.layer,
    stage: raw.stage ?? 'STAGE_0_READ_ONLY',
    liveExecutionEnabled: raw.liveExecutionEnabled ?? false,
    retryEnabled: raw.retryEnabled ?? false,
    backgroundEnabled: raw.backgroundEnabled ?? false,
    realUsersAllowed: raw.realUsersAllowed ?? false,
    classification: raw.classification ?? 'canonical',
    attributes: Object.freeze({ ...(raw.attributes ?? {}) }),
  });
}

export function adaptAllStates(raws: readonly RawStateInput[]): readonly RuntimeState[] {
  return Object.freeze(raws.map(adaptState));
}

export const adaptRecorderState = (i?: Partial<RawStateInput>) =>
  adaptState({ ...(i ?? {}), layer: 'recorder' });
export const adaptHistoryState = (i?: Partial<RawStateInput>) =>
  adaptState({ ...(i ?? {}), layer: 'history' });
export const adaptReplayState = (i?: Partial<RawStateInput>) =>
  adaptState({ ...(i ?? {}), layer: 'replay' });
export const adaptCausalityState = (i?: Partial<RawStateInput>) =>
  adaptState({ ...(i ?? {}), layer: 'causality' });
export const adaptStabilityState = (i?: Partial<RawStateInput>) =>
  adaptState({ ...(i ?? {}), layer: 'stability' });
export const adaptIntegrityState = (i?: Partial<RawStateInput>) =>
  adaptState({ ...(i ?? {}), layer: 'integrity' });
export const adaptIsolationState = (i?: Partial<RawStateInput>) =>
  adaptState({ ...(i ?? {}), layer: 'isolation' });
export const adaptEnforcementState = (i?: Partial<RawStateInput>) =>
  adaptState({ ...(i ?? {}), layer: 'enforcement' });
export const adaptImmutableCoreState = (i?: Partial<RawStateInput>) =>
  adaptState({ ...(i ?? {}), layer: 'immutable-core' });
export const adaptMeshState = (i?: Partial<RawStateInput>) =>
  adaptState({ ...(i ?? {}), layer: 'mesh' });
export const adaptCertificationState = (i?: Partial<RawStateInput>) =>
  adaptState({ ...(i ?? {}), layer: 'certification' });
export const adaptGovernanceState = (i?: Partial<RawStateInput>) =>
  adaptState({ ...(i ?? {}), layer: 'governance' });
export const adaptPromotionState = (i?: Partial<RawStateInput>) =>
  adaptState({ ...(i ?? {}), layer: 'promotion' });
export const adaptPilotState = (i?: Partial<RawStateInput>) =>
  adaptState({ ...(i ?? {}), layer: 'pilot' });

export function buildDefaultCanonicalStates(): readonly RuntimeState[] {
  return adaptAllStates(
    CANONICAL_LAYERS.map((layer) => ({ id: `${layer}:0`, layer })),
  );
}
