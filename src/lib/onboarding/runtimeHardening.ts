/**
 * Runtime Hardening · Hostile Runtime Validation Layer
 *
 * Camada PURA e determinística para validar a resiliência operacional do
 * onboarding sob condições reais hostis (offline, packet loss, multi-tab,
 * session expiration, retry storms, etc).
 *
 * GARANTIAS:
 *  - Sem IO. Sem mutação. Sem side effects.
 *  - Nenhum cenário aqui afeta o onboarding real — são simulações in-memory.
 *  - Determinístico: RNG seeded via FNV-1a 32-bit.
 *  - Fail-soft: validators retornam findings, nunca lançam.
 *
 * NÃO usar este módulo para executar chaos real em produção.
 */

// ============================================================================
// POLÍTICA IMUTÁVEL
// ============================================================================

export const RUNTIME_HARDENING_POLICY = Object.freeze({
  allow_real_chaos: false,
  allow_runtime_mutation: false,
  allow_auto_healing: false,
  allow_auto_rollback: false,
  allow_destructive_replay: false,
  default_flag_state: 'off' as const,
});

// ============================================================================
// TIPOS
// ============================================================================

export type RuntimeEventKind =
  | 'phase_enter'
  | 'phase_exit'
  | 'persist_attempt'
  | 'persist_success'
  | 'persist_error'
  | 'recovery_attempt'
  | 'recovery_success'
  | 'recovery_failure'
  | 'telemetry'
  | 'retry'
  | 'reconnect'
  | 'hydration'
  | 'background'
  | 'foreground'
  | 'session_expired'
  | 'submit'
  | 'db_confirm'
  | 'toast_success'
  | 'toast_error';

export interface SimulatedEvent {
  t: number; // monotonic ms (deterministic)
  kind: RuntimeEventKind;
  phase?: string;
  session_id: string;
  tab_id?: string;
  ok?: boolean;
  attempt?: number;
  meta?: Record<string, unknown>;
}

export interface ScenarioOptions {
  seed?: number;
  session_id?: string;
  tab_id?: string;
  intensity?: number; // 0..1
}

export interface ScenarioResult {
  scenario: string;
  events: SimulatedEvent[];
  notes: string[];
  expected_findings: string[]; // tipos esperados (orientativo)
}

// ============================================================================
// PRNG DETERMINÍSTICO (FNV-1a 32-bit + LCG)
// ============================================================================

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function makeRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    // LCG (Numerical Recipes)
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function defaultSeed(opts?: ScenarioOptions): number {
  if (typeof opts?.seed === 'number') return opts.seed >>> 0;
  return fnv1a(opts?.session_id ?? 'hardening-default');
}

const SESSION = (o?: ScenarioOptions) => o?.session_id ?? 'sess-deterministic';
const TAB = (o?: ScenarioOptions) => o?.tab_id ?? 'tab-1';

// ============================================================================
// HOSTILE SCENARIOS (determinísticos)
// ============================================================================

export function simulateNetworkDegradation(opts?: ScenarioOptions): ScenarioResult {
  const rng = makeRng(defaultSeed(opts));
  const sid = SESSION(opts);
  const events: SimulatedEvent[] = [];
  let t = 0;
  for (let i = 0; i < 5; i++) {
    events.push({ t: (t += 50 + Math.floor(rng() * 200)), kind: 'persist_attempt', session_id: sid, attempt: i + 1, phase: 'phase2_service' });
    const slow = rng() < (opts?.intensity ?? 0.6);
    if (slow) {
      events.push({ t: (t += 1500 + Math.floor(rng() * 2000)), kind: 'persist_error', session_id: sid, attempt: i + 1, meta: { reason: 'timeout' } });
      events.push({ t: (t += 100), kind: 'retry', session_id: sid, attempt: i + 1 });
    } else {
      events.push({ t: (t += 300), kind: 'persist_success', session_id: sid, attempt: i + 1 });
      break;
    }
  }
  return {
    scenario: 'network_degradation',
    events,
    notes: ['latency spike + intermittent persist errors'],
    expected_findings: ['latency_spike', 'retry_loop'],
  };
}

export function simulatePacketLoss(opts?: ScenarioOptions): ScenarioResult {
  const rng = makeRng(defaultSeed(opts));
  const sid = SESSION(opts);
  const events: SimulatedEvent[] = [];
  let t = 0;
  const lossRate = opts?.intensity ?? 0.4;
  for (let i = 0; i < 6; i++) {
    events.push({ t: (t += 80), kind: 'telemetry', session_id: sid, meta: { dropped: rng() < lossRate } });
  }
  return { scenario: 'packet_loss', events, notes: [`loss rate=${lossRate}`], expected_findings: ['telemetry_loss'] };
}

export function simulateOfflineRecovery(opts?: ScenarioOptions): ScenarioResult {
  const sid = SESSION(opts);
  let t = 0;
  const events: SimulatedEvent[] = [
    { t: (t += 0), kind: 'phase_enter', session_id: sid, phase: 'phase2_service' },
    { t: (t += 200), kind: 'persist_attempt', session_id: sid, attempt: 1 },
    { t: (t += 100), kind: 'persist_error', session_id: sid, meta: { reason: 'offline' } },
    { t: (t += 8000), kind: 'reconnect', session_id: sid },
    { t: (t += 50), kind: 'recovery_attempt', session_id: sid },
    { t: (t += 300), kind: 'recovery_success', session_id: sid },
    { t: (t += 100), kind: 'persist_attempt', session_id: sid, attempt: 2 },
    { t: (t += 200), kind: 'persist_success', session_id: sid, attempt: 2 },
  ];
  return { scenario: 'offline_recovery', events, notes: ['offline → reconnect → recover → persist'], expected_findings: [] };
}

export function simulateReconnectFlow(opts?: ScenarioOptions): ScenarioResult {
  const sid = SESSION(opts);
  let t = 0;
  const events: SimulatedEvent[] = [
    { t: (t += 0), kind: 'background', session_id: sid },
    { t: (t += 10_000), kind: 'foreground', session_id: sid },
    { t: (t += 50), kind: 'reconnect', session_id: sid },
    { t: (t += 100), kind: 'hydration', session_id: sid, ok: true },
  ];
  return { scenario: 'reconnect_flow', events, notes: ['reconnect after background'], expected_findings: [] };
}

export function simulateSessionExpiration(opts?: ScenarioOptions): ScenarioResult {
  const sid = SESSION(opts);
  let t = 0;
  const events: SimulatedEvent[] = [
    { t: (t += 0), kind: 'phase_enter', session_id: sid, phase: 'phase4_final' },
    { t: (t += 5000), kind: 'session_expired', session_id: sid },
    { t: (t += 100), kind: 'submit', session_id: sid },
    { t: (t += 200), kind: 'toast_success', session_id: sid, ok: true },
    // sem persist_success real → phantom
  ];
  return {
    scenario: 'session_expiration',
    events,
    notes: ['session expired but toast claimed success'],
    expected_findings: ['phantom_success'],
  };
}

export function simulateDraftCorruption(opts?: ScenarioOptions): ScenarioResult {
  const sid = SESSION(opts);
  let t = 0;
  const events: SimulatedEvent[] = [
    { t: (t += 0), kind: 'hydration', session_id: sid, ok: false, meta: { reason: 'invalid_envelope' } },
    { t: (t += 50), kind: 'recovery_attempt', session_id: sid },
    { t: (t += 100), kind: 'recovery_failure', session_id: sid, meta: { reason: 'corrupted' } },
  ];
  return { scenario: 'draft_corruption', events, notes: ['draft envelope invalid'], expected_findings: ['recovery_failure', 'corruption_propagation'] };
}

export function simulateHydrationRace(opts?: ScenarioOptions): ScenarioResult {
  const sid = SESSION(opts);
  let t = 0;
  const events: SimulatedEvent[] = [
    { t: (t += 0), kind: 'hydration', session_id: sid, tab_id: TAB(opts), ok: true, attempt: 1 },
    { t: (t += 5), kind: 'hydration', session_id: sid, tab_id: TAB(opts), ok: true, attempt: 2 },
    { t: (t += 5), kind: 'hydration', session_id: sid, tab_id: TAB(opts), ok: true, attempt: 3 },
  ];
  return { scenario: 'hydration_race', events, notes: ['concurrent hydrations'], expected_findings: ['hydration_race'] };
}

export function simulateCrossTabConflict(opts?: ScenarioOptions): ScenarioResult {
  const sid = SESSION(opts);
  let t = 0;
  const events: SimulatedEvent[] = [
    { t: (t += 0), kind: 'persist_attempt', session_id: sid, tab_id: 'tab-A', attempt: 1 },
    { t: (t += 10), kind: 'persist_attempt', session_id: sid, tab_id: 'tab-B', attempt: 1 },
    { t: (t += 200), kind: 'persist_success', session_id: sid, tab_id: 'tab-A' },
    { t: (t += 50), kind: 'persist_success', session_id: sid, tab_id: 'tab-B' },
  ];
  return { scenario: 'cross_tab_conflict', events, notes: ['two tabs persisting concurrently'], expected_findings: ['cross_tab_conflict', 'duplicate_persist'] };
}

export function simulateRetryAmplification(opts?: ScenarioOptions): ScenarioResult {
  const sid = SESSION(opts);
  let t = 0;
  const events: SimulatedEvent[] = [];
  for (let i = 1; i <= 8; i++) {
    events.push({ t: (t += 100), kind: 'persist_attempt', session_id: sid, attempt: i });
    events.push({ t: (t += 50), kind: 'persist_error', session_id: sid, attempt: i });
    events.push({ t: (t += 10), kind: 'retry', session_id: sid, attempt: i });
  }
  return { scenario: 'retry_amplification', events, notes: ['8 retries without success'], expected_findings: ['retry_storm'] };
}

export function simulateSlowDevice(opts?: ScenarioOptions): ScenarioResult {
  const sid = SESSION(opts);
  let t = 0;
  const events: SimulatedEvent[] = [
    { t: (t += 0), kind: 'phase_enter', session_id: sid, phase: 'phase2_service' },
    { t: (t += 3500), kind: 'persist_attempt', session_id: sid, meta: { cpu_lag_ms: 3500 } },
    { t: (t += 800), kind: 'persist_success', session_id: sid },
  ];
  return { scenario: 'slow_device', events, notes: ['CPU lag amplified debounce'], expected_findings: ['cpu_lag'] };
}

export function simulateBackgroundResume(opts?: ScenarioOptions): ScenarioResult {
  const sid = SESSION(opts);
  let t = 0;
  const events: SimulatedEvent[] = [
    { t: (t += 0), kind: 'background', session_id: sid },
    { t: (t += 60_000), kind: 'foreground', session_id: sid },
    { t: (t += 100), kind: 'hydration', session_id: sid, ok: true },
  ];
  return { scenario: 'background_resume', events, notes: ['long background pause'], expected_findings: [] };
}

export function simulateRapidRefresh(opts?: ScenarioOptions): ScenarioResult {
  const sid = SESSION(opts);
  let t = 0;
  const events: SimulatedEvent[] = [];
  for (let i = 0; i < 4; i++) {
    events.push({ t: (t += 200), kind: 'phase_enter', session_id: sid, phase: 'phase2_service' });
    events.push({ t: (t += 50), kind: 'hydration', session_id: sid, ok: true });
    events.push({ t: (t += 30), kind: 'phase_exit', session_id: sid, phase: 'phase2_service' });
  }
  return { scenario: 'rapid_refresh', events, notes: ['4 rapid refreshes'], expected_findings: ['hydration_race'] };
}

export function simulatePartialPersistence(opts?: ScenarioOptions): ScenarioResult {
  const sid = SESSION(opts);
  let t = 0;
  const events: SimulatedEvent[] = [
    { t: (t += 0), kind: 'persist_attempt', session_id: sid, attempt: 1 },
    { t: (t += 200), kind: 'persist_success', session_id: sid, attempt: 1 },
    // sem db_confirm — confirmação parcial
    { t: (t += 500), kind: 'toast_success', session_id: sid },
  ];
  return { scenario: 'partial_persistence', events, notes: ['persist success but no DB confirm'], expected_findings: ['partial_persist', 'phantom_success'] };
}

export function simulateDelayedTelemetry(opts?: ScenarioOptions): ScenarioResult {
  const sid = SESSION(opts);
  const events: SimulatedEvent[] = [
    { t: 0, kind: 'phase_enter', session_id: sid, phase: 'phase2_service' },
    { t: 100, kind: 'persist_success', session_id: sid },
    { t: 30_000, kind: 'telemetry', session_id: sid, meta: { delayed_ms: 30_000 } },
  ];
  return { scenario: 'delayed_telemetry', events, notes: ['telemetry arrived 30s late'], expected_findings: ['telemetry_delay'] };
}

export function simulateClockDrift(opts?: ScenarioOptions): ScenarioResult {
  const sid = SESSION(opts);
  const events: SimulatedEvent[] = [
    { t: 0, kind: 'phase_enter', session_id: sid },
    { t: 500, kind: 'persist_attempt', session_id: sid },
    { t: 200, kind: 'persist_success', session_id: sid, meta: { clock_skew_ms: -300 } },
  ];
  return { scenario: 'clock_drift', events, notes: ['negative delta detected'], expected_findings: ['clock_drift', 'out_of_order'] };
}

export function simulateOutOfOrderEvents(opts?: ScenarioOptions): ScenarioResult {
  const sid = SESSION(opts);
  const events: SimulatedEvent[] = [
    { t: 0, kind: 'persist_success', session_id: sid },
    { t: 50, kind: 'persist_attempt', session_id: sid },
    { t: 100, kind: 'phase_enter', session_id: sid },
  ];
  return { scenario: 'out_of_order_events', events, notes: ['success before attempt'], expected_findings: ['out_of_order'] };
}

// ============================================================================
// FINDINGS / VALIDATORS
// ============================================================================

export type HardeningSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface HardeningFinding {
  type: string;
  severity: HardeningSeverity;
  scenario?: string;
  detail: string;
  evidence_count: number;
}

function countKinds(events: SimulatedEvent[]): Record<RuntimeEventKind, number> {
  const out = {} as Record<RuntimeEventKind, number>;
  for (const e of events) out[e.kind] = (out[e.kind] ?? 0) + 1;
  return out;
}

export function validateOperationalIntegrity(events: SimulatedEvent[]): HardeningFinding[] {
  const findings: HardeningFinding[] = [];
  const c = countKinds(events);
  // out of order: success seen before attempt by session
  const bySession = new Map<string, SimulatedEvent[]>();
  for (const e of events) {
    if (!bySession.has(e.session_id)) bySession.set(e.session_id, []);
    bySession.get(e.session_id)!.push(e);
  }
  for (const list of bySession.values()) {
    const sorted = [...list].sort((a, b) => a.t - b.t);
    let sawAttempt = false;
    let outOfOrder = 0;
    for (const e of sorted) {
      if (e.kind === 'persist_attempt') sawAttempt = true;
      if (e.kind === 'persist_success' && !sawAttempt) outOfOrder++;
    }
    if (outOfOrder > 0) {
      findings.push({ type: 'out_of_order', severity: 'medium', detail: `${outOfOrder} success before attempt`, evidence_count: outOfOrder });
    }
  }
  if ((c.retry ?? 0) >= 5) {
    findings.push({ type: 'retry_storm', severity: 'high', detail: `${c.retry} retries observed`, evidence_count: c.retry });
  }
  return findings;
}

export function validatePersistenceIntegrity(events: SimulatedEvent[]): HardeningFinding[] {
  const findings: HardeningFinding[] = [];
  // duplicate persist by session
  const successBySession = new Map<string, number>();
  for (const e of events) {
    if (e.kind === 'persist_success') successBySession.set(e.session_id, (successBySession.get(e.session_id) ?? 0) + 1);
  }
  for (const [sid, n] of successBySession) {
    if (n > 1) findings.push({ type: 'duplicate_persist', severity: 'high', detail: `session ${sid} persisted ${n}×`, evidence_count: n });
  }
  // toast_success without persist_success
  const hasToast = events.some((e) => e.kind === 'toast_success');
  const hasPersist = events.some((e) => e.kind === 'persist_success');
  const hasConfirm = events.some((e) => e.kind === 'db_confirm');
  if (hasToast && !hasPersist) {
    findings.push({ type: 'phantom_success', severity: 'critical', detail: 'toast success without persist success', evidence_count: 1 });
  } else if (hasToast && hasPersist && !hasConfirm) {
    findings.push({ type: 'partial_persist', severity: 'medium', detail: 'persist success without DB confirm', evidence_count: 1 });
  }
  return findings;
}

export function validateRecoveryIntegrity(events: SimulatedEvent[]): HardeningFinding[] {
  const findings: HardeningFinding[] = [];
  const failures = events.filter((e) => e.kind === 'recovery_failure').length;
  if (failures > 0) findings.push({ type: 'recovery_failure', severity: 'high', detail: `${failures} recovery failures`, evidence_count: failures });
  const reattempt = events.filter((e) => e.kind === 'recovery_attempt').length;
  if (reattempt >= 3) findings.push({ type: 'recovery_loop', severity: 'medium', detail: `${reattempt} recovery attempts`, evidence_count: reattempt });
  return findings;
}

export function validateEvidenceIntegrity(events: SimulatedEvent[]): HardeningFinding[] {
  const findings: HardeningFinding[] = [];
  const dropped = events.filter((e) => e.kind === 'telemetry' && (e.meta as any)?.dropped).length;
  const total = events.filter((e) => e.kind === 'telemetry').length;
  if (total > 0 && dropped / total > 0.25) {
    findings.push({ type: 'telemetry_loss', severity: 'high', detail: `${dropped}/${total} telemetry dropped`, evidence_count: dropped });
  }
  const delayed = events.filter((e) => e.kind === 'telemetry' && Number((e.meta as any)?.delayed_ms ?? 0) > 5_000).length;
  if (delayed > 0) findings.push({ type: 'telemetry_delay', severity: 'medium', detail: `${delayed} delayed telemetry`, evidence_count: delayed });
  return findings;
}

export function validateTruthConsistency(events: SimulatedEvent[]): HardeningFinding[] {
  return validatePersistenceIntegrity(events).filter((f) => f.type === 'phantom_success' || f.type === 'partial_persist');
}

export function validateMemoryConsistency(events: SimulatedEvent[]): HardeningFinding[] {
  // hydration race detection
  const hydrationsBySession = new Map<string, SimulatedEvent[]>();
  for (const e of events) {
    if (e.kind !== 'hydration') continue;
    if (!hydrationsBySession.has(e.session_id)) hydrationsBySession.set(e.session_id, []);
    hydrationsBySession.get(e.session_id)!.push(e);
  }
  const findings: HardeningFinding[] = [];
  for (const [sid, list] of hydrationsBySession) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.t - b.t);
    const span = sorted[sorted.length - 1].t - sorted[0].t;
    if (span < 1_000) {
      findings.push({ type: 'hydration_race', severity: 'high', detail: `${list.length} hydrations within ${span}ms (${sid})`, evidence_count: list.length });
    }
  }
  return findings;
}

export function validateGovernanceIntegrity(events: SimulatedEvent[]): HardeningFinding[] {
  // cross-tab persistence on same session
  const tabsBySession = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.kind !== 'persist_attempt' || !e.tab_id) continue;
    if (!tabsBySession.has(e.session_id)) tabsBySession.set(e.session_id, new Set());
    tabsBySession.get(e.session_id)!.add(e.tab_id);
  }
  const findings: HardeningFinding[] = [];
  for (const [sid, tabs] of tabsBySession) {
    if (tabs.size > 1) {
      findings.push({ type: 'cross_tab_conflict', severity: 'high', detail: `${tabs.size} tabs persisting in ${sid}`, evidence_count: tabs.size });
    }
  }
  return findings;
}

export function validateForensicReconstruction(events: SimulatedEvent[]): HardeningFinding[] {
  const findings: HardeningFinding[] = [];
  // sessions without phase_enter cannot be reconstructed
  const sessions = new Set(events.map((e) => e.session_id));
  for (const sid of sessions) {
    const list = events.filter((e) => e.session_id === sid);
    const hasEnter = list.some((e) => e.kind === 'phase_enter');
    const hasOther = list.some((e) => e.kind !== 'phase_enter');
    if (!hasEnter && hasOther) {
      findings.push({ type: 'missing_anchor', severity: 'low', detail: `session ${sid} lacks phase_enter`, evidence_count: list.length });
    }
  }
  return findings;
}

// ============================================================================
// SCORES (0..100)
// ============================================================================

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function severityPenalty(f: HardeningFinding): number {
  switch (f.severity) {
    case 'critical':
      return 35;
    case 'high':
      return 18;
    case 'medium':
      return 9;
    case 'low':
      return 4;
    default:
      return 1;
  }
}

function scoreFrom(findings: HardeningFinding[]): number {
  let score = 100;
  for (const f of findings) score -= severityPenalty(f);
  return clamp(score);
}

export function computeRuntimeResilienceScore(events: SimulatedEvent[]): number {
  return scoreFrom([
    ...validateOperationalIntegrity(events),
    ...validatePersistenceIntegrity(events),
    ...validateMemoryConsistency(events),
    ...validateGovernanceIntegrity(events),
  ]);
}

export function computeRecoveryResilience(events: SimulatedEvent[]): number {
  return scoreFrom(validateRecoveryIntegrity(events));
}

export function computeTelemetryResilience(events: SimulatedEvent[]): number {
  return scoreFrom(validateEvidenceIntegrity(events));
}

export function computePersistenceResilience(events: SimulatedEvent[]): number {
  return scoreFrom(validatePersistenceIntegrity(events));
}

export function computeForensicReliability(events: SimulatedEvent[]): number {
  return scoreFrom(validateForensicReconstruction(events));
}

export function computeChaosResistance(results: ScenarioResult[]): number {
  if (results.length === 0) return 100;
  const scores = results.map((r) => computeRuntimeResilienceScore(r.events));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg);
}

// ============================================================================
// FAILURE PROPAGATION GRAPH
// ============================================================================

export type FpNodeKind =
  | 'runtime_event'
  | 'failure'
  | 'retry'
  | 'recovery'
  | 'persist'
  | 'telemetry'
  | 'divergence'
  | 'detector'
  | 'memory'
  | 'governance';

export type FpEdgeKind = 'caused' | 'amplified' | 'masked' | 'delayed' | 'fragmented' | 'recovered' | 'contradicted';

export interface FpNode {
  id: string;
  kind: FpNodeKind;
  label: string;
}

export interface FpEdge {
  from: string;
  to: string;
  kind: FpEdgeKind;
}

export interface FailurePropagationGraph {
  nodes: FpNode[];
  edges: FpEdge[];
  cascades: string[][]; // chains of failure
}

export function buildFailurePropagationGraph(events: SimulatedEvent[], findings: HardeningFinding[]): FailurePropagationGraph {
  const nodes = new Map<string, FpNode>();
  const edges: FpEdge[] = [];
  const add = (n: FpNode) => {
    if (!nodes.has(n.id)) nodes.set(n.id, n);
  };

  const sorted = [...events].sort((a, b) => a.t - b.t);
  let prevFailureId: string | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const id = `${e.kind}@${e.t}`;
    if (e.kind === 'persist_error' || e.kind === 'recovery_failure') {
      add({ id, kind: 'failure', label: e.kind });
      if (prevFailureId) edges.push({ from: prevFailureId, to: id, kind: 'amplified' });
      prevFailureId = id;
    } else if (e.kind === 'retry') {
      add({ id, kind: 'retry', label: 'retry' });
      if (prevFailureId) edges.push({ from: prevFailureId, to: id, kind: 'caused' });
    } else if (e.kind === 'recovery_success') {
      add({ id, kind: 'recovery', label: 'recovery_success' });
      if (prevFailureId) edges.push({ from: prevFailureId, to: id, kind: 'recovered' });
      prevFailureId = null;
    } else if (e.kind === 'persist_success' || e.kind === 'db_confirm') {
      add({ id, kind: 'persist', label: e.kind });
    } else if (e.kind === 'telemetry') {
      add({ id, kind: 'telemetry', label: 'telemetry' });
      const meta = (e.meta ?? {}) as any;
      if (meta.dropped) edges.push({ from: id, to: id, kind: 'masked' });
      if (Number(meta.delayed_ms ?? 0) > 5_000) edges.push({ from: id, to: id, kind: 'delayed' });
    }
  }

  for (const f of findings) {
    const id = `finding:${f.type}`;
    add({ id, kind: 'detector', label: f.type });
    if (f.type === 'phantom_success' || f.type === 'partial_persist') {
      add({ id: 'divergence:truth', kind: 'divergence', label: 'truth_divergence' });
      edges.push({ from: id, to: 'divergence:truth', kind: 'contradicted' });
    }
    if (f.type === 'cross_tab_conflict') {
      add({ id: 'governance:tabs', kind: 'governance', label: 'multi_tab' });
      edges.push({ from: id, to: 'governance:tabs', kind: 'fragmented' });
    }
    if (f.type === 'hydration_race') {
      add({ id: 'memory:hydration', kind: 'memory', label: 'hydration_state' });
      edges.push({ from: id, to: 'memory:hydration', kind: 'fragmented' });
    }
  }

  // Cascades = chains of failure->retry->failure
  const cascades: string[][] = [];
  const failureNodes = [...nodes.values()].filter((n) => n.kind === 'failure');
  if (failureNodes.length >= 2) {
    cascades.push(failureNodes.map((n) => n.id));
  }

  return { nodes: [...nodes.values()], edges, cascades };
}

// ============================================================================
// AGGREGATE REPORT
// ============================================================================

export interface HardeningReport {
  scenarios: ScenarioResult[];
  findings: HardeningFinding[];
  scores: {
    runtime_resilience: number;
    recovery_resilience: number;
    telemetry_resilience: number;
    persistence_resilience: number;
    forensic_reliability: number;
    chaos_resistance: number;
  };
  graph: FailurePropagationGraph;
}

export function generateHardeningFindings(events: SimulatedEvent[], scenario?: string): HardeningFinding[] {
  const all = [
    ...validateOperationalIntegrity(events),
    ...validatePersistenceIntegrity(events),
    ...validateRecoveryIntegrity(events),
    ...validateEvidenceIntegrity(events),
    ...validateMemoryConsistency(events),
    ...validateGovernanceIntegrity(events),
    ...validateForensicReconstruction(events),
  ];
  if (scenario) for (const f of all) f.scenario = scenario;
  return all;
}

export function runAllScenarios(opts?: ScenarioOptions): HardeningReport {
  const builders: Array<(o?: ScenarioOptions) => ScenarioResult> = [
    simulateNetworkDegradation,
    simulatePacketLoss,
    simulateOfflineRecovery,
    simulateReconnectFlow,
    simulateSessionExpiration,
    simulateDraftCorruption,
    simulateHydrationRace,
    simulateCrossTabConflict,
    simulateRetryAmplification,
    simulateSlowDevice,
    simulateBackgroundResume,
    simulateRapidRefresh,
    simulatePartialPersistence,
    simulateDelayedTelemetry,
    simulateClockDrift,
    simulateOutOfOrderEvents,
  ];

  const scenarios = builders.map((b, i) => b({ ...opts, session_id: `${opts?.session_id ?? 'sess'}-${i}` }));
  const allEvents: SimulatedEvent[] = scenarios.flatMap((s) => s.events);
  const findings = scenarios.flatMap((s) => generateHardeningFindings(s.events, s.scenario));
  const graph = buildFailurePropagationGraph(allEvents, findings);

  return {
    scenarios,
    findings,
    scores: {
      runtime_resilience: computeRuntimeResilienceScore(allEvents),
      recovery_resilience: computeRecoveryResilience(allEvents),
      telemetry_resilience: computeTelemetryResilience(allEvents),
      persistence_resilience: computePersistenceResilience(allEvents),
      forensic_reliability: computeForensicReliability(allEvents),
      chaos_resistance: computeChaosResistance(scenarios),
    },
    graph,
  };
}

// ============================================================================
// FEATURE FLAGS (nomes canônicos)
// ============================================================================

export const HARDENING_FLAGS = Object.freeze({
  master: 'onboarding_runtime_hardening_enabled',
  chaos: 'onboarding_chaos_validation_enabled',
  offline: 'onboarding_offline_validation_enabled',
  retry: 'onboarding_retry_validation_enabled',
});
