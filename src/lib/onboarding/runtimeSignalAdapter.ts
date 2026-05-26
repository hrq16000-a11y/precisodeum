/**
 * Runtime Signal Integration Layer (READ-ONLY, deterministic, fail-soft).
 *
 * Normaliza sinais reais de runtime (events/incidents/releases/experiments/flags),
 * correlaciona com engines existentes, computa qualidade/cobertura, gera feed de
 * evidência e reconstrói sessões operacionais. SEM IO, SEM RPC, SEM React,
 * SEM mutação. Toda função é pura sobre os inputs recebidos.
 *
 * Política frozen:
 *   - Não cria novas tabelas, migrations, RPCs.
 *   - Não altera onboarding, reducers, PHASE_ORDER, persistência.
 *   - Não toca DOM, não dispara fetch, não usa setTimeout/realtime.
 *   - Findings são heurísticos + auditáveis (cada um carrega evidence refs).
 */

export const RUNTIME_SIGNAL_POLICY = Object.freeze({
  allow_mutation: false,
  allow_io: false,
  allow_realtime: false,
  allow_ai: false,
  allow_auto_healing: false,
  allow_rpc: false,
  deterministic: true,
  fail_soft: true,
} as const);

// =====================================================================
// Tipos canônicos
// =====================================================================

export type SignalKind =
  | 'event'
  | 'incident'
  | 'release'
  | 'experiment'
  | 'flag'
  | 'behavioral_summary'
  | 'regression_snapshot'
  | 'memory_finding'
  | 'hardening_result'
  | 'evidence_finding';

export type SignalSource =
  | 'onboarding_events'
  | 'onboarding_incidents'
  | 'onboarding_release_snapshots'
  | 'onboarding_experiments'
  | 'site_settings'
  | 'behavioral'
  | 'regression'
  | 'memory'
  | 'hardening'
  | 'evidence';

export interface RuntimeSignal {
  /** Identificador estável (synthetic se origem não trouxer). */
  id: string;
  kind: SignalKind;
  source: SignalSource;
  /** Epoch ms; 0 se desconhecido. */
  at: number;
  /** Identidades correlacionáveis (todas opcionais). */
  session_id: string | null;
  user_id: string | null;
  phase: string | null;
  release: string | null;
  experiment: string | null;
  incident: string | null;
  /** Severidade normalizada. */
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  /** Categoria livre derivada do payload (ex: event name). */
  category: string | null;
  /** Meta sanitizada (sem PII bruta). */
  meta: Record<string, unknown>;
  /** True se a origem tinha campos críticos ausentes. */
  partial: boolean;
}

export interface AdapterInput {
  events?: unknown[];
  incidents?: unknown[];
  releases?: unknown[];
  experiments?: unknown[];
  flags?: unknown[];
  behavioral?: unknown[];
  regressions?: unknown[];
  memory?: unknown[];
  hardening?: unknown[];
  evidence?: unknown[];
}

export interface AdapterOutput {
  normalizedSignals: RuntimeSignal[];
  signalCoverage: number;   // 0..100 (quantas fontes vieram preenchidas)
  signalIntegrity: number;  // 0..100 (proporção sem corrupção/partial)
  missingSignals: SignalSource[];
  corruptedSignals: string[]; // ids
}

const ALL_SOURCES: SignalSource[] = [
  'onboarding_events',
  'onboarding_incidents',
  'onboarding_release_snapshots',
  'onboarding_experiments',
  'site_settings',
  'behavioral',
  'regression',
  'memory',
  'hardening',
  'evidence',
];

// =====================================================================
// Helpers internos
// =====================================================================

const PII_KEYS = new Set([
  'email', 'phone', 'whatsapp', 'cpf', 'cnpj', 'tax_id',
  'password', 'token', 'address', 'street', 'cep',
  'full_name', 'fullname', 'name', 'ip', 'lat', 'lng',
]);

function sanitizeMeta(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (PII_KEYS.has(k.toLowerCase())) continue;
    if (v && typeof v === 'object') {
      // shallow only
      try { out[k] = JSON.parse(JSON.stringify(v)); } catch { /* skip */ }
    } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return out;
}

function asString(v: unknown): string | null {
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number') return String(v);
  return null;
}

function asEpoch(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Date.parse(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function normalizeSeverity(v: unknown): RuntimeSignal['severity'] {
  const s = typeof v === 'string' ? v.toLowerCase() : '';
  if (s === 'critical' || s === 'crit') return 'critical';
  if (s === 'high' || s === 'error') return 'high';
  if (s === 'medium' || s === 'warn' || s === 'warning') return 'medium';
  if (s === 'low') return 'low';
  return 'info';
}

let _idCounter = 0;
function syntheticId(prefix: string): string {
  _idCounter = (_idCounter + 1) | 0;
  return `${prefix}_synth_${_idCounter}`;
}

function safeRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

// =====================================================================
// Normalizadores por fonte
// =====================================================================

function normEvent(raw: unknown): RuntimeSignal | null {
  const r = safeRecord(raw);
  if (!r || Object.keys(r).length === 0) return null;
  const id = asString(r.id) ?? syntheticId('evt');
  const phase = asString(r.phase) ?? asString((safeRecord(r.meta)).phase);
  const event = asString(r.event) ?? asString((safeRecord(r.meta)).event);
  const partial = !phase || !event;
  return {
    id,
    kind: 'event',
    source: 'onboarding_events',
    at: asEpoch(r.created_at ?? r.at ?? r.timestamp),
    session_id: asString(r.session_id) ?? asString((safeRecord(r.meta)).session_id),
    user_id: asString(r.user_id),
    phase,
    release: asString((safeRecord(r.meta)).app_version) ?? asString((safeRecord(r.meta)).release),
    experiment: asString((safeRecord(r.meta)).experiment_id),
    incident: null,
    severity: event === 'error' ? 'high' : 'info',
    category: event,
    meta: sanitizeMeta(r.meta),
    partial,
  };
}

function normIncident(raw: unknown): RuntimeSignal | null {
  const r = safeRecord(raw);
  if (Object.keys(r).length === 0) return null;
  return {
    id: asString(r.id) ?? syntheticId('inc'),
    kind: 'incident',
    source: 'onboarding_incidents',
    at: asEpoch(r.detected_at ?? r.created_at ?? r.at),
    session_id: asString(r.session_id),
    user_id: asString(r.user_id),
    phase: asString(r.phase),
    release: asString(r.release) ?? asString(r.app_version),
    experiment: null,
    incident: asString(r.id),
    severity: normalizeSeverity(r.severity),
    category: asString(r.kind) ?? asString(r.type),
    meta: sanitizeMeta(r.meta ?? r.details),
    partial: !r.severity,
  };
}

function normRelease(raw: unknown): RuntimeSignal | null {
  const r = safeRecord(raw);
  if (Object.keys(r).length === 0) return null;
  return {
    id: asString(r.id) ?? syntheticId('rel'),
    kind: 'release',
    source: 'onboarding_release_snapshots',
    at: asEpoch(r.captured_at ?? r.created_at ?? r.at),
    session_id: null,
    user_id: null,
    phase: null,
    release: asString(r.app_version) ?? asString(r.release) ?? asString(r.version),
    experiment: null,
    incident: null,
    severity: 'info',
    category: 'release_snapshot',
    meta: sanitizeMeta(r.metrics ?? r.meta),
    partial: !r.app_version && !r.release && !r.version,
  };
}

function normExperiment(raw: unknown): RuntimeSignal | null {
  const r = safeRecord(raw);
  if (Object.keys(r).length === 0) return null;
  return {
    id: asString(r.id) ?? syntheticId('exp'),
    kind: 'experiment',
    source: 'onboarding_experiments',
    at: asEpoch(r.updated_at ?? r.created_at),
    session_id: null,
    user_id: null,
    phase: asString(r.target_phase),
    release: null,
    experiment: asString(r.id) ?? asString(r.key),
    incident: null,
    severity: r.status === 'killed' ? 'high' : 'info',
    category: asString(r.status),
    meta: sanitizeMeta(r.config),
    partial: !r.status,
  };
}

function normFlag(raw: unknown): RuntimeSignal | null {
  const r = safeRecord(raw);
  if (Object.keys(r).length === 0) return null;
  return {
    id: asString(r.key) ?? syntheticId('flag'),
    kind: 'flag',
    source: 'site_settings',
    at: asEpoch(r.updated_at),
    session_id: null,
    user_id: null,
    phase: null,
    release: null,
    experiment: null,
    incident: null,
    severity: 'info',
    category: asString(r.key),
    meta: { value: r.value ?? null },
    partial: !r.key,
  };
}

function normGeneric(raw: unknown, kind: SignalKind, source: SignalSource): RuntimeSignal | null {
  const r = safeRecord(raw);
  if (Object.keys(r).length === 0) return null;
  return {
    id: asString(r.id) ?? syntheticId(kind),
    kind,
    source,
    at: asEpoch(r.at ?? r.created_at ?? r.timestamp),
    session_id: asString(r.session_id),
    user_id: asString(r.user_id),
    phase: asString(r.phase),
    release: asString(r.release),
    experiment: asString(r.experiment),
    incident: asString(r.incident),
    severity: normalizeSeverity(r.severity),
    category: asString(r.category) ?? asString(r.type),
    meta: sanitizeMeta(r.meta),
    partial: false,
  };
}

// =====================================================================
// Adapter principal
// =====================================================================

export function runtimeSignalAdapter(input: AdapterInput): AdapterOutput {
  const out: RuntimeSignal[] = [];
  const corrupted: string[] = [];
  const present = new Set<SignalSource>();

  const ingest = (
    list: unknown[] | undefined,
    src: SignalSource,
    fn: (x: unknown) => RuntimeSignal | null,
  ) => {
    if (!Array.isArray(list) || list.length === 0) return;
    present.add(src);
    for (const raw of list) {
      try {
        const s = fn(raw);
        if (!s) {
          corrupted.push(syntheticId('corrupt'));
          continue;
        }
        if (s.partial) corrupted.push(s.id);
        out.push(s);
      } catch {
        corrupted.push(syntheticId('corrupt'));
      }
    }
  };

  ingest(input.events, 'onboarding_events', normEvent);
  ingest(input.incidents, 'onboarding_incidents', normIncident);
  ingest(input.releases, 'onboarding_release_snapshots', normRelease);
  ingest(input.experiments, 'onboarding_experiments', normExperiment);
  ingest(input.flags, 'site_settings', normFlag);
  ingest(input.behavioral, 'behavioral', (x) => normGeneric(x, 'behavioral_summary', 'behavioral'));
  ingest(input.regressions, 'regression', (x) => normGeneric(x, 'regression_snapshot', 'regression'));
  ingest(input.memory, 'memory', (x) => normGeneric(x, 'memory_finding', 'memory'));
  ingest(input.hardening, 'hardening', (x) => normGeneric(x, 'hardening_result', 'hardening'));
  ingest(input.evidence, 'evidence', (x) => normGeneric(x, 'evidence_finding', 'evidence'));

  // Ordenação determinística (por at asc + id)
  out.sort((a, b) => (a.at - b.at) || a.id.localeCompare(b.id));

  const missingSignals = ALL_SOURCES.filter((s) => !present.has(s));
  const signalCoverage = Math.round(((ALL_SOURCES.length - missingSignals.length) / ALL_SOURCES.length) * 100);
  const signalIntegrity = out.length === 0
    ? 0
    : Math.round(((out.length - corrupted.length) / out.length) * 100);

  return {
    normalizedSignals: out,
    signalCoverage,
    signalIntegrity: Math.max(0, signalIntegrity),
    missingSignals,
    corruptedSignals: Array.from(new Set(corrupted)),
  };
}

// =====================================================================
// Real Signal Correlation
// =====================================================================

export interface IntegrationResult {
  byEngine: {
    operationalReality: number;
    operationalMemory: number;
    operationalCorrelation: number;
    evidenceCorrelation: number;
    selfAudit: number;
    runtimeGovernance: number;
    hardening: number;
    decisionEngine: number;
  };
  totalEnriched: number;
  unmatchedSignals: number;
}

/**
 * Helper de integração: mapeia signals para os "consumidores" lógicos por kind.
 * Não chama engines — apenas devolve contagens que cada engine PODERIA consumir
 * se receber `normalizedSignals` como input. Mantém este módulo zero-dep.
 */
export function integrateRuntimeSignals(signals: RuntimeSignal[]): IntegrationResult {
  const byEngine = {
    operationalReality: 0,
    operationalMemory: 0,
    operationalCorrelation: 0,
    evidenceCorrelation: 0,
    selfAudit: 0,
    runtimeGovernance: 0,
    hardening: 0,
    decisionEngine: 0,
  };
  let unmatched = 0;
  for (const s of signals) {
    let matched = false;
    if (s.kind === 'event' || s.kind === 'incident') {
      byEngine.operationalReality += 1;
      byEngine.evidenceCorrelation += 1;
      byEngine.operationalCorrelation += 1;
      matched = true;
    }
    if (s.kind === 'memory_finding' || s.kind === 'incident') {
      byEngine.operationalMemory += 1;
      matched = true;
    }
    if (s.kind === 'flag' || s.kind === 'experiment') {
      byEngine.runtimeGovernance += 1;
      byEngine.decisionEngine += 1;
      matched = true;
    }
    if (s.kind === 'hardening_result') {
      byEngine.hardening += 1;
      matched = true;
    }
    if (s.kind === 'release' || s.kind === 'regression_snapshot') {
      byEngine.selfAudit += 1;
      byEngine.operationalCorrelation += 1;
      matched = true;
    }
    if (s.kind === 'behavioral_summary') {
      byEngine.operationalReality += 1;
      byEngine.evidenceCorrelation += 1;
      matched = true;
    }
    if (!matched) unmatched += 1;
  }
  const totalEnriched = Object.values(byEngine).reduce((a, b) => a + b, 0);
  return { byEngine, totalEnriched, unmatchedSignals: unmatched };
}

// =====================================================================
// Signal Quality Engine
// =====================================================================

export type SignalQualityDetectorId =
  | 'telemetry_gaps'
  | 'corrupted_signal_cluster'
  | 'orphan_events'
  | 'broken_lineage'
  | 'incomplete_session_chain'
  | 'missing_release_context'
  | 'inconsistent_incident_mapping'
  | 'missing_experiment_context'
  | 'fragmented_runtime_visibility'
  | 'stale_operational_snapshot';

export interface SignalQualityFinding {
  id: SignalQualityDetectorId;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  note: string;
  evidence: string[]; // signal ids
}

export interface SignalQualityReport {
  scores: {
    signal_quality: number;
    telemetry_integrity: number;
    evidence_reliability: number;
    operational_visibility: number;
    forensic_completeness: number;
  };
  findings: SignalQualityFinding[];
}

const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 } as const;

function clamp(n: number, min = 0, max = 100): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function computeSignalQuality(
  signals: RuntimeSignal[],
  adapter: AdapterOutput,
  opts: { now?: number; staleAfterMs?: number } = {},
): SignalQualityReport {
  const now = opts.now ?? Date.now();
  const staleAfterMs = opts.staleAfterMs ?? 1000 * 60 * 60 * 24 * 7; // 7d
  const findings: SignalQualityFinding[] = [];

  // 1. telemetry_gaps — fontes ausentes
  if (adapter.missingSignals.length > 0) {
    findings.push({
      id: 'telemetry_gaps',
      severity: adapter.missingSignals.length >= 5 ? 'high' : 'medium',
      count: adapter.missingSignals.length,
      note: `${adapter.missingSignals.length} fonte(s) sem dados`,
      evidence: adapter.missingSignals,
    });
  }

  // 2. corrupted_signal_cluster
  if (adapter.corruptedSignals.length > 0) {
    findings.push({
      id: 'corrupted_signal_cluster',
      severity: adapter.corruptedSignals.length > signals.length * 0.2 ? 'high' : 'low',
      count: adapter.corruptedSignals.length,
      note: 'Sinais com campos críticos ausentes',
      evidence: adapter.corruptedSignals.slice(0, 50),
    });
  }

  // 3. orphan_events — events sem session_id nem user_id
  const orphans = signals.filter((s) => s.kind === 'event' && !s.session_id && !s.user_id);
  if (orphans.length > 0) {
    findings.push({
      id: 'orphan_events',
      severity: orphans.length > 20 ? 'high' : 'medium',
      count: orphans.length,
      note: 'Eventos sem session_id/user_id',
      evidence: orphans.slice(0, 20).map((s) => s.id),
    });
  }

  // 4. broken_lineage — incident referenciando phase sem evento na mesma phase
  const eventPhases = new Set(signals.filter((s) => s.kind === 'event').map((s) => s.phase).filter(Boolean));
  const incidentsBroken = signals.filter((s) => s.kind === 'incident' && s.phase && !eventPhases.has(s.phase));
  if (incidentsBroken.length > 0) {
    findings.push({
      id: 'broken_lineage',
      severity: 'medium',
      count: incidentsBroken.length,
      note: 'Incidentes sem eventos correspondentes',
      evidence: incidentsBroken.map((s) => s.id),
    });
  }

  // 5. incomplete_session_chain — sessões com menos de 2 eventos
  const sessionCounts = new Map<string, number>();
  for (const s of signals) {
    if (s.kind === 'event' && s.session_id) {
      sessionCounts.set(s.session_id, (sessionCounts.get(s.session_id) ?? 0) + 1);
    }
  }
  const shortSessions = Array.from(sessionCounts.entries()).filter(([, n]) => n < 2);
  if (shortSessions.length > 0) {
    findings.push({
      id: 'incomplete_session_chain',
      severity: 'low',
      count: shortSessions.length,
      note: 'Sessões com cadeia incompleta',
      evidence: shortSessions.slice(0, 20).map(([id]) => id),
    });
  }

  // 6. missing_release_context
  const eventsWithoutRelease = signals.filter((s) => s.kind === 'event' && !s.release);
  if (eventsWithoutRelease.length > 0 && eventsWithoutRelease.length > signals.length * 0.5) {
    findings.push({
      id: 'missing_release_context',
      severity: 'medium',
      count: eventsWithoutRelease.length,
      note: 'Maioria dos eventos sem app_version',
      evidence: eventsWithoutRelease.slice(0, 10).map((s) => s.id),
    });
  }

  // 7. inconsistent_incident_mapping — incident sem severity ou phase
  const inconsistentInc = signals.filter((s) => s.kind === 'incident' && (s.severity === 'info' || !s.phase));
  if (inconsistentInc.length > 0) {
    findings.push({
      id: 'inconsistent_incident_mapping',
      severity: 'low',
      count: inconsistentInc.length,
      note: 'Incidentes sem severity/phase definidos',
      evidence: inconsistentInc.slice(0, 20).map((s) => s.id),
    });
  }

  // 8. missing_experiment_context
  const expIds = new Set(signals.filter((s) => s.kind === 'experiment').map((s) => s.experiment).filter(Boolean));
  const expEvents = signals.filter((s) => s.experiment && !expIds.has(s.experiment));
  if (expEvents.length > 0) {
    findings.push({
      id: 'missing_experiment_context',
      severity: 'medium',
      count: expEvents.length,
      note: 'Eventos referenciam experimentos não declarados',
      evidence: expEvents.slice(0, 20).map((s) => s.id),
    });
  }

  // 9. fragmented_runtime_visibility — apenas 1-2 fontes presentes
  const presentSources = ALL_SOURCES.length - adapter.missingSignals.length;
  if (presentSources > 0 && presentSources <= 2) {
    findings.push({
      id: 'fragmented_runtime_visibility',
      severity: 'high',
      count: presentSources,
      note: 'Visibilidade fragmentada — poucas fontes ativas',
      evidence: [],
    });
  }

  // 10. stale_operational_snapshot
  const releases = signals.filter((s) => s.kind === 'release' && s.at > 0);
  if (releases.length > 0) {
    const newest = Math.max(...releases.map((s) => s.at));
    if (now - newest > staleAfterMs) {
      findings.push({
        id: 'stale_operational_snapshot',
        severity: 'medium',
        count: 1,
        note: 'Último release snapshot está stale',
        evidence: [String(newest)],
      });
    }
  }

  // Scores
  const integrity = adapter.signalIntegrity;
  const coverage = adapter.signalCoverage;
  const penaltyHigh = findings.filter((f) => SEVERITY_RANK[f.severity] >= 3).length * 12;
  const penaltyMed = findings.filter((f) => SEVERITY_RANK[f.severity] === 2).length * 6;
  const penaltyLow = findings.filter((f) => SEVERITY_RANK[f.severity] === 1).length * 2;
  const totalPenalty = penaltyHigh + penaltyMed + penaltyLow;

  const signal_quality = clamp(100 - totalPenalty);
  const telemetry_integrity = clamp(integrity - penaltyHigh / 2);
  const evidence_reliability = clamp(
    100 - findings.filter((f) => f.id === 'broken_lineage' || f.id === 'orphan_events').reduce((a, f) => a + f.count, 0),
  );
  const operational_visibility = clamp(coverage - (presentSources <= 2 ? 30 : 0));
  const forensic_completeness = clamp(
    signals.length === 0 ? 0 : (signals.filter((s) => s.session_id).length / signals.length) * 100,
  );

  return {
    scores: {
      signal_quality,
      telemetry_integrity,
      evidence_reliability,
      operational_visibility,
      forensic_completeness,
    },
    findings,
  };
}

// =====================================================================
// Cross-Layer Evidence Feed
// =====================================================================

export interface EvidenceTimelineEntry {
  at: number;
  signalId: string;
  kind: SignalKind;
  source: SignalSource;
  phase: string | null;
  severity: RuntimeSignal['severity'];
  summary: string;
}

export interface EvidenceCluster {
  key: string;          // session_id|phase|release
  size: number;
  kinds: SignalKind[];
  signalIds: string[];
}

export interface EvidenceContradiction {
  key: string;
  reason: string;
  signalIds: string[];
}

export interface EvidenceConfirmation {
  key: string;
  enginesAgreeing: number;
  kinds: SignalKind[];
  signalIds: string[];
}

export interface HiddenPattern {
  id: 'cascade' | 'silent_failure' | 'release_regression' | 'experiment_collision';
  count: number;
  note: string;
  signalIds: string[];
}

export interface EvidenceFeed {
  timeline: EvidenceTimelineEntry[];
  clusters: EvidenceCluster[];
  contradictions: EvidenceContradiction[];
  confirmations: EvidenceConfirmation[];
  hiddenPatterns: HiddenPattern[];
}

export function buildEvidenceFeed(signals: RuntimeSignal[]): EvidenceFeed {
  // timeline (limita a 500)
  const timeline: EvidenceTimelineEntry[] = signals.slice(0, 500).map((s) => ({
    at: s.at,
    signalId: s.id,
    kind: s.kind,
    source: s.source,
    phase: s.phase,
    severity: s.severity,
    summary: s.category ?? s.kind,
  }));

  // clusters por session_id (se houver) senão por phase
  const clusterMap = new Map<string, RuntimeSignal[]>();
  for (const s of signals) {
    const key = s.session_id ?? s.phase ?? s.release ?? `kind:${s.kind}`;
    const arr = clusterMap.get(key) ?? [];
    arr.push(s);
    clusterMap.set(key, arr);
  }
  const clusters: EvidenceCluster[] = Array.from(clusterMap.entries())
    .filter(([, arr]) => arr.length >= 2)
    .map(([key, arr]) => ({
      key,
      size: arr.length,
      kinds: Array.from(new Set(arr.map((s) => s.kind))),
      signalIds: arr.map((s) => s.id),
    }));

  // contradictions: hardening_result success + incident high na mesma session
  const contradictions: EvidenceContradiction[] = [];
  for (const [key, arr] of clusterMap.entries()) {
    const hasHardSuccess = arr.some((s) => s.kind === 'hardening_result' && (s.meta as any)?.passed === true);
    const hasHighIncident = arr.some((s) => s.kind === 'incident' && (s.severity === 'high' || s.severity === 'critical'));
    if (hasHardSuccess && hasHighIncident) {
      contradictions.push({
        key,
        reason: 'hardening_success_with_incident',
        signalIds: arr.map((s) => s.id),
      });
    }
  }

  // confirmations: ≥3 engines distintos sobre a mesma key
  const confirmations: EvidenceConfirmation[] = [];
  for (const [key, arr] of clusterMap.entries()) {
    const engines = new Set(arr.map((s) => s.source));
    if (engines.size >= 3) {
      confirmations.push({
        key,
        enginesAgreeing: engines.size,
        kinds: Array.from(new Set(arr.map((s) => s.kind))),
        signalIds: arr.map((s) => s.id),
      });
    }
  }

  // hidden patterns
  const hiddenPatterns: HiddenPattern[] = [];
  // cascade: ≥3 incidents na mesma session em ordem temporal
  for (const [key, arr] of clusterMap.entries()) {
    const inc = arr.filter((s) => s.kind === 'incident').sort((a, b) => a.at - b.at);
    if (inc.length >= 3) {
      hiddenPatterns.push({
        id: 'cascade',
        count: inc.length,
        note: `cascade em ${key}`,
        signalIds: inc.map((s) => s.id),
      });
    }
  }
  // silent_failure: evento 'error' sem incident correspondente
  const errEvents = signals.filter((s) => s.kind === 'event' && s.category === 'error');
  const incPhases = new Set(signals.filter((s) => s.kind === 'incident').map((s) => s.phase));
  const silent = errEvents.filter((s) => s.phase && !incPhases.has(s.phase));
  if (silent.length > 0) {
    hiddenPatterns.push({
      id: 'silent_failure',
      count: silent.length,
      note: 'erros sem incidente registrado',
      signalIds: silent.map((s) => s.id),
    });
  }
  // release_regression: release seguido de incidents em <24h
  const releases = signals.filter((s) => s.kind === 'release' && s.at > 0).sort((a, b) => a.at - b.at);
  for (const r of releases) {
    const window = 1000 * 60 * 60 * 24;
    const after = signals.filter((s) => s.kind === 'incident' && s.at >= r.at && s.at <= r.at + window);
    if (after.length >= 2) {
      hiddenPatterns.push({
        id: 'release_regression',
        count: after.length,
        note: `incidentes pós-release ${r.release ?? r.id}`,
        signalIds: [r.id, ...after.map((s) => s.id)],
      });
    }
  }
  // experiment_collision: mesmo phase com >1 experimento ativo
  const phasesWithExp = new Map<string, Set<string>>();
  for (const s of signals.filter((x) => x.kind === 'experiment' && x.phase && x.experiment)) {
    const set = phasesWithExp.get(s.phase!) ?? new Set();
    set.add(s.experiment!);
    phasesWithExp.set(s.phase!, set);
  }
  for (const [phase, set] of phasesWithExp.entries()) {
    if (set.size > 1) {
      hiddenPatterns.push({
        id: 'experiment_collision',
        count: set.size,
        note: `múltiplos experimentos em ${phase}`,
        signalIds: Array.from(set),
      });
    }
  }

  return { timeline, clusters, contradictions, confirmations, hiddenPatterns };
}

// =====================================================================
// Forensic Reconstruction
// =====================================================================

export interface ReconstructedSession {
  sessionId: string;
  reconstructedTimeline: EvidenceTimelineEntry[];
  probableFailures: string[];
  hiddenTransitions: Array<{ from: string; to: string; gap_ms: number }>;
  confidence: number;     // 0..100
  integrityScore: number; // 0..100
}

export function reconstructOperationalSession(
  signals: RuntimeSignal[],
  sessionId: string,
): ReconstructedSession {
  const own = signals.filter((s) => s.session_id === sessionId).sort((a, b) => a.at - b.at);
  const timeline: EvidenceTimelineEntry[] = own.map((s) => ({
    at: s.at,
    signalId: s.id,
    kind: s.kind,
    source: s.source,
    phase: s.phase,
    severity: s.severity,
    summary: s.category ?? s.kind,
  }));

  const probableFailures: string[] = [];
  for (const s of own) {
    if (s.severity === 'high' || s.severity === 'critical') probableFailures.push(s.id);
    if (s.kind === 'event' && s.category === 'error') probableFailures.push(s.id);
  }

  const hiddenTransitions: Array<{ from: string; to: string; gap_ms: number }> = [];
  for (let i = 1; i < own.length; i += 1) {
    const prev = own[i - 1];
    const curr = own[i];
    if (prev.phase && curr.phase && prev.phase !== curr.phase) {
      const gap = curr.at - prev.at;
      if (gap > 1000 * 60 * 5) {
        hiddenTransitions.push({ from: prev.phase, to: curr.phase, gap_ms: gap });
      }
    }
  }

  const confidence = clamp(
    own.length === 0 ? 0 : 40 + Math.min(60, own.length * 5) - probableFailures.length * 3,
  );
  const integrityScore = clamp(
    own.length === 0 ? 0 : 100 - hiddenTransitions.length * 10 - probableFailures.length * 5,
  );

  return {
    sessionId,
    reconstructedTimeline: timeline,
    probableFailures: Array.from(new Set(probableFailures)),
    hiddenTransitions,
    confidence,
    integrityScore,
  };
}

// =====================================================================
// Systemic Coverage Map
// =====================================================================

export interface SystemicCoverage {
  coveredAreas: SignalSource[];
  blindSpots: SignalSource[];
  weakSignals: SignalSource[];
  unstableZones: string[];
  highConfidenceZones: string[];
  observabilityScore: number;
}

export function computeSystemicCoverage(
  signals: RuntimeSignal[],
  adapter: AdapterOutput,
  quality: SignalQualityReport,
): SystemicCoverage {
  const countBySource = new Map<SignalSource, number>();
  for (const s of signals) countBySource.set(s.source, (countBySource.get(s.source) ?? 0) + 1);

  const coveredAreas: SignalSource[] = [];
  const weakSignals: SignalSource[] = [];
  for (const src of ALL_SOURCES) {
    const n = countBySource.get(src) ?? 0;
    if (n === 0) continue;
    if (n < 3) weakSignals.push(src);
    else coveredAreas.push(src);
  }

  // unstable/high confidence por phase
  const byPhase = new Map<string, { errors: number; total: number }>();
  for (const s of signals) {
    if (!s.phase) continue;
    const slot = byPhase.get(s.phase) ?? { errors: 0, total: 0 };
    slot.total += 1;
    if (s.severity === 'high' || s.severity === 'critical') slot.errors += 1;
    byPhase.set(s.phase, slot);
  }
  const unstableZones: string[] = [];
  const highConfidenceZones: string[] = [];
  for (const [phase, { errors, total }] of byPhase.entries()) {
    const errRate = total === 0 ? 0 : errors / total;
    if (errRate > 0.3) unstableZones.push(phase);
    else if (total >= 5 && errRate < 0.05) highConfidenceZones.push(phase);
  }

  const observabilityScore = clamp(
    (adapter.signalCoverage * 0.4)
    + (quality.scores.signal_quality * 0.3)
    + (quality.scores.forensic_completeness * 0.3)
    - unstableZones.length * 2,
  );

  return {
    coveredAreas,
    blindSpots: adapter.missingSignals,
    weakSignals,
    unstableZones,
    highConfidenceZones,
    observabilityScore,
  };
}
