/**
 * Fase 1.9.11 — Inert adapters (READ-ONLY, no runtime deps).
 */

import { deepFreeze, fpcSignature } from './fixedPointCategory';
import type {
  FpcCategory,
  FpcInternals,
  FpcMorphism,
  FpcObject,
} from './fixedPointCategoryTypes';

export interface RawFpcObject {
  readonly id: string;
  readonly layer: string;
  readonly value?: number;
}

export interface RawFpcMorphism {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly weight?: number;
}

export interface RawFpcCategory {
  readonly id: string;
  readonly objects: readonly RawFpcObject[];
  readonly morphisms: readonly RawFpcMorphism[];
}

export function adaptObject(raw: RawFpcObject): FpcObject {
  const value = typeof raw.value === 'number' && Number.isFinite(raw.value) ? raw.value : 0;
  const sig = fpcSignature({ id: raw.id, layer: raw.layer, value });
  return deepFreeze({ id: raw.id, layer: raw.layer, value, signature: sig });
}

export function adaptMorphism(raw: RawFpcMorphism): FpcMorphism {
  const weight = typeof raw.weight === 'number' && Number.isFinite(raw.weight) ? raw.weight : 1;
  return deepFreeze({
    id: raw.id,
    source: raw.source,
    target: raw.target,
    weight,
  });
}

export function adaptCategoryRaw(raw: RawFpcCategory): FpcCategory {
  const objects = raw.objects.map(adaptObject);
  const morphisms = raw.morphisms.map(adaptMorphism);
  return deepFreeze({
    id: raw.id,
    objects: Object.freeze([...objects].sort((a, b) => a.id.localeCompare(b.id))),
    morphisms: Object.freeze(
      [...morphisms].sort(
        (a, b) =>
          a.id.localeCompare(b.id) ||
          a.source.localeCompare(b.source) ||
          a.target.localeCompare(b.target),
      ),
    ),
    signature: fpcSignature({ objects, morphisms, id: raw.id }),
  });
}

export const FPC_INTERNALS: FpcInternals = deepFreeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  liveExecutionEnabled: false as const,
  retryEnabled: false as const,
  backgroundEnabled: false as const,
  realUsersAllowed: false as const,
});
