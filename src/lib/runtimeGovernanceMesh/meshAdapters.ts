/**
 * Inert adapters mapping the 13 runtime layers into LayerSnapshot.
 * READ-ONLY, deterministic, no side effects, no imports from runtime libs.
 */

import type { LayerSnapshot, RuntimeLayer } from './meshTypes';

export interface RawLayerInput {
  readonly layer: RuntimeLayer;
  readonly stage?: string;
  readonly liveExecutionEnabled?: boolean;
  readonly retryEnabled?: boolean;
  readonly backgroundEnabled?: boolean;
  readonly realUsersAllowed?: boolean;
  readonly readiness?: 'ready' | 'partial' | 'blocked';
  readonly certification?: 'full' | 'partial' | 'conditional' | 'blocked';
  readonly containment?: 'sealed' | 'contained' | 'leaking' | 'collapsed';
  readonly topology?: 'stable' | 'overlapping' | 'recursive' | 'collapsed';
  readonly drift?: 'none' | 'minor' | 'major' | 'critical';
  readonly invariants?: Readonly<Record<string, boolean>>;
}

function freeze<T>(v: T): T {
  return Object.freeze(v) as T;
}

export function adaptLayer(raw: RawLayerInput): LayerSnapshot {
  return freeze({
    layer: raw.layer,
    stage: raw.stage ?? 'STAGE_0_READ_ONLY',
    liveExecutionEnabled: raw.liveExecutionEnabled ?? false,
    retryEnabled: raw.retryEnabled ?? false,
    backgroundEnabled: raw.backgroundEnabled ?? false,
    realUsersAllowed: raw.realUsersAllowed ?? false,
    readiness: raw.readiness ?? 'ready',
    certification: raw.certification ?? 'full',
    containment: raw.containment ?? 'sealed',
    topology: raw.topology ?? 'stable',
    drift: raw.drift ?? 'none',
    invariants: freeze({ ...(raw.invariants ?? {}) }),
  });
}

export function adaptAllLayers(raws: readonly RawLayerInput[]): readonly LayerSnapshot[] {
  return freeze(raws.map(adaptLayer));
}

export function adaptRecorder(input?: Partial<RawLayerInput>): LayerSnapshot {
  return adaptLayer({ ...(input ?? {}), layer: 'recorder' });
}
export function adaptHistory(input?: Partial<RawLayerInput>): LayerSnapshot {
  return adaptLayer({ ...(input ?? {}), layer: 'history' });
}
export function adaptReplay(input?: Partial<RawLayerInput>): LayerSnapshot {
  return adaptLayer({ ...(input ?? {}), layer: 'replay' });
}
export function adaptCausality(input?: Partial<RawLayerInput>): LayerSnapshot {
  return adaptLayer({ ...(input ?? {}), layer: 'causality' });
}
export function adaptStability(input?: Partial<RawLayerInput>): LayerSnapshot {
  return adaptLayer({ ...(input ?? {}), layer: 'stability' });
}
export function adaptIntegrity(input?: Partial<RawLayerInput>): LayerSnapshot {
  return adaptLayer({ ...(input ?? {}), layer: 'integrity' });
}
export function adaptIsolation(input?: Partial<RawLayerInput>): LayerSnapshot {
  return adaptLayer({ ...(input ?? {}), layer: 'isolation' });
}
export function adaptEnforcement(input?: Partial<RawLayerInput>): LayerSnapshot {
  return adaptLayer({ ...(input ?? {}), layer: 'enforcement' });
}
export function adaptImmutableCore(input?: Partial<RawLayerInput>): LayerSnapshot {
  return adaptLayer({ ...(input ?? {}), layer: 'immutable-core' });
}
export function adaptCertification(input?: Partial<RawLayerInput>): LayerSnapshot {
  return adaptLayer({ ...(input ?? {}), layer: 'certification' });
}
export function adaptGovernance(input?: Partial<RawLayerInput>): LayerSnapshot {
  return adaptLayer({ ...(input ?? {}), layer: 'governance' });
}
export function adaptPromotion(input?: Partial<RawLayerInput>): LayerSnapshot {
  return adaptLayer({ ...(input ?? {}), layer: 'promotion' });
}
export function adaptPilot(input?: Partial<RawLayerInput>): LayerSnapshot {
  return adaptLayer({ ...(input ?? {}), layer: 'pilot' });
}

export function buildDefaultMeshLayers(): readonly LayerSnapshot[] {
  return adaptAllLayers([
    { layer: 'recorder' },
    { layer: 'history' },
    { layer: 'replay' },
    { layer: 'causality' },
    { layer: 'stability' },
    { layer: 'integrity' },
    { layer: 'isolation' },
    { layer: 'enforcement' },
    { layer: 'immutable-core' },
    { layer: 'certification' },
    { layer: 'governance' },
    { layer: 'promotion' },
    { layer: 'pilot' },
  ]);
}
