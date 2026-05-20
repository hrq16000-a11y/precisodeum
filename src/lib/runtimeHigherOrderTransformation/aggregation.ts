import type { CompositionClass, DeterminismClass, FunctorialityClass, HigherOrderClass, HigherOrderRisk, HigherOrderSeverity, IdentityClass, LiftingClass, NaturalityClass, RuntimeHigherOrderAggregate, RuntimeHigherOrderEnvelope, TopologyClass } from './higherOrderTypes';

const SEV: Record<HigherOrderSeverity, number> = { info: 0, warn: 1, error: 2, critical: 3 };
const HO: Record<HigherOrderClass, number> = { HIGHER_ORDER: 0, WEAKLY_HIGHER: 1, PARTIAL: 2, BROKEN: 3, DEGENERATE: 4 };
const COM: Record<CompositionClass, number> = { ASSOCIATIVE: 0, WEAK: 1, PARTIAL: 2, BROKEN: 3, NON_ASSOCIATIVE: 4 };
const IDE: Record<IdentityClass, number> = { PRESERVED: 0, WEAK: 1, BROKEN: 2 };
const DET: Record<DeterminismClass, number> = { DETERMINISTIC: 0, WEAK: 1, NONDETERMINISTIC: 2 };
const TOP: Record<TopologyClass, number> = { STABLE: 0, WEAK: 1, UNSTABLE: 2, COLLAPSED: 3 };
const NAT: Record<NaturalityClass, number> = { NATURAL: 0, WEAK: 1, PARTIAL: 2, BROKEN: 3 };
const FUN: Record<FunctorialityClass, number> = { FUNCTORIAL: 0, WEAK: 1, PARTIAL: 2, FAILED: 3 };
const LIF: Record<LiftingClass, number> = { LIFTED: 0, WEAK: 1, PARTIAL: 2, UNLIFTABLE: 3 };

function worst<T extends string>(vs: readonly T[], r: Record<T, number>, zero: T): T {
  let m = zero;
  for (const v of vs) if (r[v] > r[m]) m = v;
  return m;
}

export function rankHigherOrderRisk(envs: readonly RuntimeHigherOrderEnvelope[]): HigherOrderSeverity {
  const all: HigherOrderSeverity[] = [];
  for (const e of envs) for (const r of e.risks) all.push(r.severity);
  return worst(all, SEV, 'info');
}

export function aggregateHigherOrderMechanics(envs: readonly RuntimeHigherOrderEnvelope[]): RuntimeHigherOrderAggregate {
  const risks: HigherOrderRisk[] = [];
  for (const e of envs) for (const r of e.risks) risks.push(r);
  const stable = envs.every((e) => e.stable);
  const score = envs.length === 0 ? 1 : envs.reduce((a, e) => a + e.score, 0) / envs.length;
  const confidence = envs.length === 0 ? 1 : envs.reduce((a, e) => a + e.certification.confidence, 0) / envs.length;
  return Object.freeze({
    envelopes: Object.freeze([...envs]),
    score,
    confidence,
    worstSeverity: rankHigherOrderRisk(envs),
    worstHigherOrder: worst(envs.map((e) => e.transformation.class), HO, 'HIGHER_ORDER'),
    worstComposition: worst(envs.map((e) => e.composition.class), COM, 'ASSOCIATIVE'),
    worstIdentity: worst(envs.map((e) => e.identity.class), IDE, 'PRESERVED'),
    worstDeterminism: worst(envs.map((e) => e.determinism.class), DET, 'DETERMINISTIC'),
    worstTopology: worst(envs.map((e) => e.topology.class), TOP, 'STABLE'),
    worstNaturality: worst(envs.map((e) => e.naturality.class), NAT, 'NATURAL'),
    worstFunctoriality: worst(envs.map((e) => e.functoriality.class), FUN, 'FUNCTORIAL'),
    worstLifting: worst(envs.map((e) => e.lifting.class), LIF, 'LIFTED'),
    stable,
    risks: Object.freeze(risks),
  });
}
