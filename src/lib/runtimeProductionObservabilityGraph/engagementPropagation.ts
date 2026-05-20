import { deepFreeze, sigOf, cloneSorted } from './observabilityTypes';

export interface EngagementSignal {
  readonly entityId: string;
  readonly intensity: number;
  readonly ageDays: number;
}

export interface EngagementPropagation {
  readonly decayed: ReadonlyArray<{ entityId: string; score: number }>;
  readonly signature: string;
}

const HALF_LIFE = 14;

export function propagateEngagement(
  signals: ReadonlyArray<EngagementSignal>,
): EngagementPropagation {
  const acc = new Map<string, number>();
  for (const s of signals) {
    const intensity = Number.isFinite(s.intensity) ? s.intensity : 0;
    const age = Number.isFinite(s.ageDays) ? Math.max(0, s.ageDays) : 0;
    const decay = Math.pow(0.5, age / HALF_LIFE);
    acc.set(s.entityId, (acc.get(s.entityId) ?? 0) + intensity * decay);
  }
  const decayed = cloneSorted(
    Array.from(acc.entries()).map(([entityId, score]) => ({ entityId, score })),
    (a, b) =>
      a.score === b.score
        ? a.entityId < b.entityId
          ? -1
          : a.entityId > b.entityId
            ? 1
            : 0
        : b.score - a.score,
  );
  const out = { decayed, signature: sigOf(decayed) };
  return deepFreeze(out);
}
