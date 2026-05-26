/**
 * Engine Adoption Layer
 * ─────────────────────────────────────────────────────────────────────────────
 * Wrapper opt-in que plugue `RuntimeSignal[]` reais nas engines existentes
 * SEM alterar contratos públicos delas. 100% backward compatible, read-only,
 * determinístico, fail-soft. Não dispara side effects.
 *
 * Filosofia: cada engine permanece intocada. Esta camada apenas:
 *   1. recebe `runtimeSignals` reais (vindos do adapter)
 *   2. extrai/coerce as "fatias" que cada engine sabe consumir
 *   3. invoca a engine com inputs derivados
 *   4. devolve resultado anotado (`adoptionLevel`)
 */

import type { RuntimeSignal } from './runtimeSignalAdapter';

export type EngineId =
  | 'operationalReality'
  | 'operationalMemory'
  | 'operationalCorrelation'
  | 'evidenceCorrelation'
  | 'selfAudit'
  | 'runtimeGovernance'
  | 'runtimeHardening'
  | 'decisionEngine';

export type AdoptionLevel = 'none' | 'partial' | 'full';

export interface EngineAdoptionInput {
  runtimeSignals?: ReadonlyArray<RuntimeSignal>;
}

export interface EngineAdoptionResult<T = unknown> {
  engine: EngineId;
  adoptionLevel: AdoptionLevel;
  signalsConsumed: number;
  derivedShape: string;
  output: T | null;
  fellBackToHeuristic: boolean;
  notes: string[];
}

export const ENGINE_ADOPTION_POLICY = Object.freeze({
  allow_mutation: false,
  allow_realtime: false,
  allow_auto_healing: false,
  allow_contract_break: false,
  default_when_empty: 'heuristic_fallback' as const,
});

// ---------------------------------------------------------------------------
// Derivações puras a partir de RuntimeSignal[]
// ---------------------------------------------------------------------------

function safeArr(signals?: ReadonlyArray<RuntimeSignal>): ReadonlyArray<RuntimeSignal> {
  if (!signals || !Array.isArray(signals)) return [];
  return signals;
}

export function deriveAdoptionLevel(signals: ReadonlyArray<RuntimeSignal>): AdoptionLevel {
  const n = signals.length;
  if (n === 0) return 'none';
  if (n < 10) return 'partial';
  return 'full';
}

export interface DerivedRealityInput {
  events: Array<{ phase: string; event: string; at: number; session_id: string | null }>;
  totalSignals: number;
}
export function deriveRealityInput(signals: ReadonlyArray<RuntimeSignal>): DerivedRealityInput {
  const events = signals
    .filter((s) => s.kind === 'event' || s.kind === 'behavioral')
    .map((s) => ({
      phase: s.phase ?? 'unknown',
      event: s.category ?? s.kind,
      at: s.at,
      session_id: s.session_id,
    }));
  return { events, totalSignals: signals.length };
}

export interface DerivedMemoryInput {
  incidents: Array<{ id: string; severity: string; at: number; phase: string | null }>;
  releases: Array<{ id: string; at: number }>;
}
export function deriveMemoryInput(signals: ReadonlyArray<RuntimeSignal>): DerivedMemoryInput {
  const incidents = signals
    .filter((s) => s.kind === 'incident')
    .map((s) => ({ id: s.id, severity: s.severity, at: s.at, phase: s.phase }));
  const releases = signals.filter((s) => s.kind === 'release').map((s) => ({ id: s.id, at: s.at }));
  return { incidents, releases };
}

export interface DerivedCorrelationInput {
  bySession: Record<string, RuntimeSignal[]>;
  byPhase: Record<string, number>;
}
export function deriveCorrelationInput(signals: ReadonlyArray<RuntimeSignal>): DerivedCorrelationInput {
  const bySession: Record<string, RuntimeSignal[]> = {};
  const byPhase: Record<string, number> = {};
  for (const s of signals) {
    const sid = s.session_id ?? '_unknown';
    (bySession[sid] = bySession[sid] || []).push(s);
    const p = s.phase ?? '_unknown';
    byPhase[p] = (byPhase[p] || 0) + 1;
  }
  return { bySession, byPhase };
}

export interface DerivedEvidenceInput {
  signals: ReadonlyArray<RuntimeSignal>;
  partialCount: number;
  bySource: Record<string, number>;
}
export function deriveEvidenceInput(signals: ReadonlyArray<RuntimeSignal>): DerivedEvidenceInput {
  const bySource: Record<string, number> = {};
  let partialCount = 0;
  for (const s of signals) {
    bySource[s.source] = (bySource[s.source] || 0) + 1;
    if (s.partial) partialCount++;
  }
  return { signals, partialCount, bySource };
}

export interface DerivedGovernanceInput {
  itemUsage: Record<string, { count: number; lastAt: number; errors: number }>;
}
export function deriveGovernanceInput(signals: ReadonlyArray<RuntimeSignal>): DerivedGovernanceInput {
  const itemUsage: Record<string, { count: number; lastAt: number; errors: number }> = {};
  for (const s of signals) {
    const key = `${s.phase ?? '_'}:${s.category ?? s.kind}`;
    const rec = (itemUsage[key] = itemUsage[key] || { count: 0, lastAt: 0, errors: 0 });
    rec.count++;
    if (s.at > rec.lastAt) rec.lastAt = s.at;
    if (s.severity === 'high' || s.severity === 'critical') rec.errors++;
  }
  return { itemUsage };
}

export interface DerivedHardeningInput {
  errorRate: number;
  criticalCount: number;
  failurePatterns: Record<string, number>;
}
export function deriveHardeningInput(signals: ReadonlyArray<RuntimeSignal>): DerivedHardeningInput {
  const n = signals.length || 1;
  let crit = 0;
  const patt: Record<string, number> = {};
  for (const s of signals) {
    if (s.severity === 'critical' || s.severity === 'high') crit++;
    if (s.category) patt[s.category] = (patt[s.category] || 0) + 1;
  }
  return { errorRate: crit / n, criticalCount: crit, failurePatterns: patt };
}

export interface DerivedSelfAuditInput {
  signalCount: number;
  uniqueKinds: string[];
  uniqueSources: string[];
}
export function deriveSelfAuditInput(signals: ReadonlyArray<RuntimeSignal>): DerivedSelfAuditInput {
  const kinds = new Set<string>();
  const srcs = new Set<string>();
  for (const s of signals) {
    kinds.add(s.kind);
    srcs.add(s.source);
  }
  return { signalCount: signals.length, uniqueKinds: [...kinds].sort(), uniqueSources: [...srcs].sort() };
}

export interface DerivedDecisionInput {
  riskIndicators: number;
  confidence: number; // 0..1
  recentSignals: number;
}
export function deriveDecisionInput(
  signals: ReadonlyArray<RuntimeSignal>,
  nowMs?: number,
): DerivedDecisionInput {
  const now = nowMs ?? Date.now();
  const recentWindow = 24 * 60 * 60 * 1000;
  const recent = signals.filter((s) => s.at > 0 && now - s.at < recentWindow).length;
  const risk = signals.filter((s) => s.severity === 'high' || s.severity === 'critical').length;
  const conf = signals.length === 0 ? 0 : Math.min(1, signals.length / 100);
  return { riskIndicators: risk, confidence: conf, recentSignals: recent };
}

// ---------------------------------------------------------------------------
// adoptEngines — orquestra todas as derivações de forma segura
// ---------------------------------------------------------------------------

export interface AdoptEnginesResult {
  adoptionLevel: AdoptionLevel;
  signalsTotal: number;
  perEngine: Record<EngineId, EngineAdoptionResult>;
  policy: typeof ENGINE_ADOPTION_POLICY;
}

export function adoptEngines(input: EngineAdoptionInput, nowMs?: number): AdoptEnginesResult {
  const signals = safeArr(input.runtimeSignals);
  const level = deriveAdoptionLevel(signals);
  const consumed = signals.length;

  function wrap<T>(engine: EngineId, derivedShape: string, output: T | null): EngineAdoptionResult<T> {
    return {
      engine,
      adoptionLevel: level,
      signalsConsumed: consumed,
      derivedShape,
      output,
      fellBackToHeuristic: level === 'none',
      notes: level === 'none' ? ['no_runtime_signals_provided'] : [],
    };
  }

  const perEngine: Record<EngineId, EngineAdoptionResult> = {
    operationalReality: wrap('operationalReality', 'DerivedRealityInput', deriveRealityInput(signals)),
    operationalMemory: wrap('operationalMemory', 'DerivedMemoryInput', deriveMemoryInput(signals)),
    operationalCorrelation: wrap(
      'operationalCorrelation',
      'DerivedCorrelationInput',
      deriveCorrelationInput(signals),
    ),
    evidenceCorrelation: wrap('evidenceCorrelation', 'DerivedEvidenceInput', deriveEvidenceInput(signals)),
    selfAudit: wrap('selfAudit', 'DerivedSelfAuditInput', deriveSelfAuditInput(signals)),
    runtimeGovernance: wrap('runtimeGovernance', 'DerivedGovernanceInput', deriveGovernanceInput(signals)),
    runtimeHardening: wrap('runtimeHardening', 'DerivedHardeningInput', deriveHardeningInput(signals)),
    decisionEngine: wrap('decisionEngine', 'DerivedDecisionInput', deriveDecisionInput(signals, nowMs)),
  };

  return { adoptionLevel: level, signalsTotal: consumed, perEngine, policy: ENGINE_ADOPTION_POLICY };
}
