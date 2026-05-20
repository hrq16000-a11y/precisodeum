import type { CompositionClass, DeterminismClass, FunctorClass, FunctorRisk, FunctorSeverity, IdentityClass, RuntimeFunctorAggregate, RuntimeFunctorEnvelope, TopologyClass } from './functorTypes';

const SEV: Record<FunctorSeverity, number> = { info: 0, warn: 1, error: 2, critical: 3 };
const FUN: Record<FunctorClass, number> = { PRESERVING: 0, WEAKLY_PRESERVING: 1, DISTORTING: 2, RECURSIVE: 3, DEGENERATE: 4 };
const COM: Record<CompositionClass, number> = { ASSOCIATIVE: 0, WEAK: 1, PARTIAL: 2, BROKEN: 3, NON_ASSOCIATIVE: 4 };
const IDE: Record<IdentityClass, number> = { PRESERVED: 0, WEAK: 1, BROKEN: 2 };
const DET: Record<DeterminismClass, number> = { DETERMINISTIC: 0, WEAK: 1, NONDETERMINISTIC: 2 };
const TOP: Record<TopologyClass, number> = { STABLE: 0, WEAK: 1, UNSTABLE: 2, COLLAPSED: 3 };

function worst<T extends string>(vs: readonly T[], r: Record<T, number>, zero: T): T { let m = zero; for (const v of vs) if (r[v] > r[m]) m = v; return m; }

export function rankFunctorRisk(envs: readonly RuntimeFunctorEnvelope[]): FunctorSeverity {
  const all: FunctorSeverity[] = [];
  for (const e of envs) for (const r of e.risks) all.push(r.severity);
  return worst(all, SEV, 'info');
}

export function aggregateFunctorMechanics(envs: readonly RuntimeFunctorEnvelope[]): RuntimeFunctorAggregate {
  const risks: FunctorRisk[] = [];
  for (const e of envs) for (const r of e.risks) risks.push(r);
  const stable = envs.every((e) => e.stable);
  const score = envs.length === 0 ? 1 : envs.reduce((a, e) => a + e.score, 0) / envs.length;
  const confidence = envs.length === 0 ? 1 : envs.reduce((a, e) => a + e.certification.confidence, 0) / envs.length;
  return Object.freeze({
    envelopes: Object.freeze([...envs]),
    score,
    confidence,
    worstSeverity: rankFunctorRisk(envs),
    worstFunctor: worst(envs.map((e) => e.functor.class), FUN, 'PRESERVING'),
    worstComposition: worst(envs.map((e) => e.composition.class), COM, 'ASSOCIATIVE'),
    worstIdentity: worst(envs.map((e) => e.identity.class), IDE, 'PRESERVED'),
    worstDeterminism: worst(envs.map((e) => e.determinism.class), DET, 'DETERMINISTIC'),
    worstTopology: worst(envs.map((e) => e.topology.class), TOP, 'STABLE'),
    stable,
    risks: Object.freeze(risks),
  });
}
