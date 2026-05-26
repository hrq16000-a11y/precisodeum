/**
 * Runtime Governance Signals & Operational Drift Intelligence (Phase 1)
 *
 * Camada pura sobre o registry estático (governanceRegistry) que correlaciona
 * sinais REAIS de runtime (uso, latência, erros, freshness) para produzir:
 *
 *  - drift intelligence (orphan_rpc, dead_flag, dead_metric, zombie_experiment,
 *    stale_threshold, unused_engine, dashboard_without_data, telemetry_drop,
 *    degraded_signal_quality, silent_failure_pattern)
 *  - signal health score por categoria (telemetry/rpc/governance/experiment/
 *    runtime/dashboard) com bucket healthy/warning/degraded/critical
 *  - runtime blast radius baseado em frequência observada
 *  - decay classification (stale/decaying/abandoned)
 *  - coverage map (áreas monitoradas vs cegas)
 *  - timeline operacional por item
 *
 * Política:
 *  - APENAS observa, classifica e recomenda.
 *  - PROIBIDO auto-delete/auto-disable/auto-prune/auto-cleanup/auto-refactor.
 *  - Pure functions. Sem Supabase. Sem fetch. Sem IA.
 *  - Sample size guards anti-falso-positivo.
 */
import {
  GOVERNANCE_REGISTRY,
  type GovernanceItem,
  type GovernanceKind,
  type RiskLevel,
} from './governanceRegistry';

// ============================================================================
// Tipos · Runtime Usage Snapshot
// ============================================================================

/** Snapshot agregado de uso de um item. Sem payloads sensíveis. */
export interface RuntimeUsageSnapshot {
  item_id: string;
  /** Última vez observado (ISO). null se nunca. */
  last_used_at: string | null;
  /** Quantas execuções/leituras na janela. */
  execution_count: number;
  /** Sessões/IPs distintos (proxy de alcance). */
  unique_sessions: number;
  /** 0..1 — proporção de execuções com erro. */
  error_rate: number;
  /** Latência média em ms (0 quando irrelevante). */
  avg_latency_ms: number;
}

export interface AggregateOptions {
  /** Janela em dias considerada na agregação. Default 14. */
  window_days?: number;
  /** "Agora" injetável para testes determinísticos. */
  now?: number;
}

/** Evento mínimo aceito pelo agregador (todas as fontes normalizam para aqui). */
export interface RuntimeEvent {
  item_id: string;
  ts: number;             // epoch ms
  session_id?: string | null;
  /** true se o evento representa falha (erro server-side, exceção, timeout). */
  is_error?: boolean;
  /** latência observada em ms (opcional). */
  latency_ms?: number;
}

const DEFAULT_WINDOW_DAYS = 14;
const MS_PER_DAY = 86_400_000;

/** Agrega eventos brutos em snapshots por item_id (pure). */
export function aggregateRuntimeSnapshot(
  events: ReadonlyArray<RuntimeEvent>,
  opts: AggregateOptions = {},
): Map<string, RuntimeUsageSnapshot> {
  const windowDays = Math.max(1, opts.window_days ?? DEFAULT_WINDOW_DAYS);
  const now = opts.now ?? Date.now();
  const cutoff = now - windowDays * MS_PER_DAY;

  const byId = new Map<string, {
    count: number;
    errors: number;
    latencies: number[];
    sessions: Set<string>;
    lastTs: number;
  }>();

  for (const ev of events) {
    if (!ev || !ev.item_id || ev.ts < cutoff) continue;
    let bucket = byId.get(ev.item_id);
    if (!bucket) {
      bucket = { count: 0, errors: 0, latencies: [], sessions: new Set(), lastTs: 0 };
      byId.set(ev.item_id, bucket);
    }
    bucket.count++;
    if (ev.is_error) bucket.errors++;
    if (typeof ev.latency_ms === 'number' && ev.latency_ms >= 0) bucket.latencies.push(ev.latency_ms);
    if (ev.session_id) bucket.sessions.add(ev.session_id);
    if (ev.ts > bucket.lastTs) bucket.lastTs = ev.ts;
  }

  const out = new Map<string, RuntimeUsageSnapshot>();
  for (const [id, b] of byId) {
    const avgLatency = b.latencies.length
      ? Math.round(b.latencies.reduce((s, n) => s + n, 0) / b.latencies.length)
      : 0;
    out.set(id, {
      item_id: id,
      last_used_at: b.lastTs ? new Date(b.lastTs).toISOString() : null,
      execution_count: b.count,
      unique_sessions: b.sessions.size,
      error_rate: b.count ? Math.min(1, b.errors / b.count) : 0,
      avg_latency_ms: avgLatency,
    });
  }
  return out;
}

// ============================================================================
// Drift Intelligence
// ============================================================================

export type RuntimeDriftKind =
  | 'orphan_rpc'
  | 'dead_flag'
  | 'dead_metric'
  | 'zombie_experiment'
  | 'stale_threshold'
  | 'unused_engine'
  | 'dashboard_without_data'
  | 'telemetry_drop'
  | 'degraded_signal_quality'
  | 'silent_failure_pattern';

export interface RuntimeDriftAlert {
  kind: RuntimeDriftKind;
  item_id: string;
  severity: RiskLevel;
  reason: string;
  /** Métricas auxiliares para o dashboard. */
  meta?: Record<string, number | string | null>;
}

export interface DriftDetectionOptions {
  /** Janela considerada (deve bater com a do snapshot). Default 14. */
  window_days?: number;
  /** Min de execuções para considerar o item "vivo". Default 1. */
  min_exec_for_alive?: number;
  /** Threshold de error_rate para silent_failure / degraded. Default 0.2 (20%). */
  error_rate_critical?: number;
  /** Latência média (ms) considerada degradada. Default 1500. */
  latency_degraded_ms?: number;
  /** Min sessões distintas exigidas em telemetria. Default 3. */
  min_sessions_for_signal?: number;
  /** Janela anterior para comparação de "drop". Default = mesma janela. */
  previous_snapshot?: Map<string, RuntimeUsageSnapshot>;
  /** Drop ≥ esta fração entre janelas dispara telemetry_drop. Default 0.6. */
  telemetry_drop_ratio?: number;
}

const DRIFT_DEFAULTS: Required<Omit<DriftDetectionOptions, 'previous_snapshot'>> = {
  window_days: DEFAULT_WINDOW_DAYS,
  min_exec_for_alive: 1,
  error_rate_critical: 0.2,
  latency_degraded_ms: 1500,
  min_sessions_for_signal: 3,
  telemetry_drop_ratio: 0.6,
};

/**
 * Mapeia GovernanceKind → RuntimeDriftKind para o caso "sem uso na janela".
 * Retorna null quando o kind não tem regra dedicada.
 */
function deadKindFor(kind: GovernanceKind): RuntimeDriftKind | null {
  switch (kind) {
    case 'rpc': return 'orphan_rpc';
    case 'feature_flag': return 'dead_flag';
    case 'telemetry_contract': return 'dead_metric';
    case 'threshold': return 'stale_threshold';
    case 'engine': return 'unused_engine';
    case 'dashboard': return 'dashboard_without_data';
    case 'experiment_constraint': return 'zombie_experiment';
    default: return null;
  }
}

/** Severidade default por kind para o caso de "sem uso". */
function deadSeverityFor(kind: GovernanceKind): RiskLevel {
  switch (kind) {
    case 'telemetry_contract': return 'high';
    case 'rpc':
    case 'engine': return 'medium';
    default: return 'low';
  }
}

export function detectRuntimeDrifts(
  items: ReadonlyArray<GovernanceItem>,
  snapshots: Map<string, RuntimeUsageSnapshot>,
  opts: DriftDetectionOptions = {},
): RuntimeDriftAlert[] {
  const cfg = { ...DRIFT_DEFAULTS, ...opts };
  const prev = opts.previous_snapshot;
  const out: RuntimeDriftAlert[] = [];

  for (const it of items) {
    if (it.lifecycle === 'archived' || it.lifecycle === 'experimental') continue;
    const snap = snapshots.get(it.id);
    const used = snap?.execution_count ?? 0;
    const sessions = snap?.unique_sessions ?? 0;
    const errRate = snap?.error_rate ?? 0;
    const lat = snap?.avg_latency_ms ?? 0;

    // ---- "dead" patterns (sem uso na janela) -----------------------------
    if (used < cfg.min_exec_for_alive) {
      const dk = deadKindFor(it.kind);
      if (dk && it.lifecycle === 'active') {
        out.push({
          kind: dk,
          item_id: it.id,
          severity: deadSeverityFor(it.kind),
          reason: `Sem execução em ${cfg.window_days}d.`,
          meta: { execution_count: 0, window_days: cfg.window_days },
        });
      }
      continue;
    }

    // ---- degraded signal quality (telemetria) ----------------------------
    if (it.kind === 'telemetry_contract' && sessions < cfg.min_sessions_for_signal) {
      out.push({
        kind: 'degraded_signal_quality',
        item_id: it.id,
        severity: 'medium',
        reason: `Apenas ${sessions} sessões distintas — sinal pode ser ruído.`,
        meta: { unique_sessions: sessions, min_required: cfg.min_sessions_for_signal },
      });
    }

    // ---- silent failure (alto erro mas sem alerta upstream) --------------
    if (errRate >= cfg.error_rate_critical && (it.kind === 'rpc' || it.kind === 'engine')) {
      out.push({
        kind: 'silent_failure_pattern',
        item_id: it.id,
        severity: errRate >= 0.5 ? 'critical' : 'high',
        reason: `Error rate ${(errRate * 100).toFixed(1)}% acima do limite.`,
        meta: { error_rate: Number(errRate.toFixed(3)) },
      });
    }

    // ---- degraded latency ------------------------------------------------
    if (it.kind === 'rpc' && lat >= cfg.latency_degraded_ms) {
      out.push({
        kind: 'degraded_signal_quality',
        item_id: it.id,
        severity: lat >= cfg.latency_degraded_ms * 2 ? 'high' : 'medium',
        reason: `Latência média ${lat}ms ≥ ${cfg.latency_degraded_ms}ms.`,
        meta: { avg_latency_ms: lat },
      });
    }

    // ---- telemetry_drop (queda entre janelas) ----------------------------
    if (prev && it.kind === 'telemetry_contract') {
      const before = prev.get(it.id)?.execution_count ?? 0;
      if (before >= 10 && used < before * (1 - cfg.telemetry_drop_ratio)) {
        out.push({
          kind: 'telemetry_drop',
          item_id: it.id,
          severity: 'high',
          reason: `Eventos caíram de ${before} → ${used} (≥${Math.round(cfg.telemetry_drop_ratio * 100)}%).`,
          meta: { previous: before, current: used },
        });
      }
    }
  }
  return out;
}

// ============================================================================
// Signal Health Score
// ============================================================================

export type HealthBucket = 'healthy' | 'warning' | 'degraded' | 'critical';

export interface CategoryHealth {
  category: 'telemetry' | 'rpc' | 'governance' | 'experiment' | 'runtime' | 'dashboard';
  score: number;          // 0..100
  bucket: HealthBucket;
  sample_size: number;
  reasons: string[];
}

export interface SignalHealthReport {
  overall_score: number;
  overall_bucket: HealthBucket;
  categories: CategoryHealth[];
}

function bucketOf(score: number): HealthBucket {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'warning';
  if (score >= 40) return 'degraded';
  return 'critical';
}

const CATEGORY_BY_KIND: Record<GovernanceKind, CategoryHealth['category']> = {
  engine: 'runtime',
  threshold: 'governance',
  feature_flag: 'governance',
  heuristic: 'runtime',
  experiment_constraint: 'experiment',
  incident_rule: 'governance',
  health_score: 'governance',
  telemetry_contract: 'telemetry',
  rpc: 'rpc',
  dashboard: 'dashboard',
};

export function computeSignalHealthScore(
  items: ReadonlyArray<GovernanceItem>,
  snapshots: Map<string, RuntimeUsageSnapshot>,
  drifts: ReadonlyArray<RuntimeDriftAlert> = [],
): SignalHealthReport {
  const groups = new Map<CategoryHealth['category'], GovernanceItem[]>();
  for (const it of items) {
    if (it.lifecycle === 'archived') continue;
    const cat = CATEGORY_BY_KIND[it.kind];
    const arr = groups.get(cat) ?? [];
    arr.push(it);
    groups.set(cat, arr);
  }
  const driftById = new Map<string, RuntimeDriftAlert[]>();
  for (const d of drifts) {
    const arr = driftById.get(d.item_id) ?? [];
    arr.push(d);
    driftById.set(d.item_id, arr);
  }

  const categories: CategoryHealth[] = [];
  for (const [cat, list] of groups) {
    if (list.length === 0) continue;
    let alive = 0;
    let degraded = 0;
    const reasons: string[] = [];
    for (const it of list) {
      const snap = snapshots.get(it.id);
      const used = (snap?.execution_count ?? 0) > 0;
      if (used) alive++;
      const itemDrifts = driftById.get(it.id) ?? [];
      if (itemDrifts.some((d) => d.severity === 'critical' || d.severity === 'high')) degraded++;
    }
    const aliveRatio = alive / list.length;
    const degradedRatio = degraded / list.length;
    // Score: 70% peso "vivo", 30% penalidade de degradação.
    const raw = Math.round(aliveRatio * 70 + (1 - degradedRatio) * 30);
    const score = Math.max(0, Math.min(100, raw));
    if (alive < list.length) reasons.push(`${list.length - alive} item(ns) sem uso observado`);
    if (degraded > 0) reasons.push(`${degraded} alerta(s) alto/crítico ativo(s)`);
    categories.push({
      category: cat,
      score,
      bucket: bucketOf(score),
      sample_size: list.length,
      reasons,
    });
  }

  const totalSample = categories.reduce((s, c) => s + c.sample_size, 0);
  const overall = totalSample
    ? Math.round(categories.reduce((s, c) => s + c.score * c.sample_size, 0) / totalSample)
    : 0;
  return {
    overall_score: overall,
    overall_bucket: bucketOf(overall),
    categories: categories.sort((a, b) => a.category.localeCompare(b.category)),
  };
}

// ============================================================================
// Runtime Blast Radius (baseado em frequência observada)
// ============================================================================

export interface RuntimeBlastEntry {
  consumer_id: string;
  observed_executions: number;
  share_pct: number;   // % do total de uso do alvo
  severity: RiskLevel;
}

export interface RuntimeBlastReport {
  target: string;
  total_observed: number;
  affected: RuntimeBlastEntry[];
  /** Frase pronta para UI. */
  summary: string;
}

export function computeRuntimeBlastRadius(
  itemId: string,
  items: ReadonlyArray<GovernanceItem> = GOVERNANCE_REGISTRY,
  snapshots: Map<string, RuntimeUsageSnapshot>,
): RuntimeBlastReport {
  const idx = new Map(items.map((it) => [it.id, it]));
  const target = idx.get(itemId);
  const totalTarget = snapshots.get(itemId)?.execution_count ?? 0;
  if (!target) {
    return { target: itemId, total_observed: 0, affected: [], summary: 'Item desconhecido.' };
  }
  // Dependentes diretos = quem declara o alvo em `dependencies`.
  const deps = items.filter((it) => it.dependencies.includes(itemId));
  const totalAll = deps.reduce((s, d) => s + (snapshots.get(d.id)?.execution_count ?? 0), 0) || 1;

  const affected: RuntimeBlastEntry[] = deps.map((d) => {
    const exec = snapshots.get(d.id)?.execution_count ?? 0;
    const share = (exec / totalAll) * 100;
    let sev: RiskLevel = 'low';
    if (share >= 60) sev = 'critical';
    else if (share >= 30) sev = 'high';
    else if (share >= 10) sev = 'medium';
    return {
      consumer_id: d.id,
      observed_executions: exec,
      share_pct: Number(share.toFixed(1)),
      severity: sev,
    };
  }).sort((a, b) => b.observed_executions - a.observed_executions);

  const topShare = affected[0]?.share_pct ?? 0;
  const summary = affected.length
    ? `Desligar "${target.title}" afetaria ${affected.length} consumidor(es); mais impactado responde por ${topShare.toFixed(1)}% do uso observado.`
    : `Nenhum consumidor com uso observado depende de "${target.title}".`;

  return { target: itemId, total_observed: totalTarget, affected, summary };
}

// ============================================================================
// Decay Detection
// ============================================================================

export type DecayState = 'fresh' | 'stale' | 'decaying' | 'abandoned';

export interface DecayClassification {
  item_id: string;
  state: DecayState;
  days_since_use: number | null;
  reason: string;
}

export interface DecayOptions {
  now?: number;
  stale_days?: number;       // default 30
  decaying_days?: number;    // default 60
  abandoned_days?: number;   // default 90
}

export function classifyDecay(
  items: ReadonlyArray<GovernanceItem>,
  snapshots: Map<string, RuntimeUsageSnapshot>,
  opts: DecayOptions = {},
): DecayClassification[] {
  const now = opts.now ?? Date.now();
  const stale = opts.stale_days ?? 30;
  const decaying = opts.decaying_days ?? 60;
  const abandoned = opts.abandoned_days ?? 90;
  const out: DecayClassification[] = [];

  for (const it of items) {
    if (it.lifecycle === 'archived' || it.lifecycle === 'experimental') continue;
    const snap = snapshots.get(it.id);
    const lastIso = snap?.last_used_at ?? null;
    const days = lastIso ? Math.floor((now - new Date(lastIso).getTime()) / MS_PER_DAY) : null;

    let state: DecayState = 'fresh';
    let reason = 'Uso recente observado.';
    if (days === null) {
      state = 'abandoned';
      reason = 'Nunca observado em runtime na janela analisada.';
    } else if (days >= abandoned) {
      state = 'abandoned';
      reason = `Sem uso há ${days}d (≥ ${abandoned}d).`;
    } else if (days >= decaying) {
      state = 'decaying';
      reason = `Sem uso há ${days}d (≥ ${decaying}d).`;
    } else if (days >= stale) {
      state = 'stale';
      reason = `Sem uso há ${days}d (≥ ${stale}d).`;
    }
    out.push({ item_id: it.id, state, days_since_use: days, reason });
  }
  return out;
}

// ============================================================================
// Operational Coverage Map
// ============================================================================

export interface CoverageEntry {
  kind: GovernanceKind;
  total: number;
  monitored: number;
  blind: number;
  coverage_pct: number;
  blind_items: string[];
}

export interface CoverageReport {
  entries: CoverageEntry[];
  overall_coverage_pct: number;
  blind_total: number;
}

export function buildCoverageMap(
  items: ReadonlyArray<GovernanceItem>,
  snapshots: Map<string, RuntimeUsageSnapshot>,
): CoverageReport {
  const byKind = new Map<GovernanceKind, GovernanceItem[]>();
  for (const it of items) {
    if (it.lifecycle === 'archived') continue;
    const arr = byKind.get(it.kind) ?? [];
    arr.push(it);
    byKind.set(it.kind, arr);
  }
  const entries: CoverageEntry[] = [];
  let totalAll = 0;
  let monitoredAll = 0;
  for (const [kind, list] of byKind) {
    const blindItems = list.filter((it) => (snapshots.get(it.id)?.execution_count ?? 0) === 0);
    const monitored = list.length - blindItems.length;
    const pct = list.length ? Math.round((monitored / list.length) * 100) : 0;
    entries.push({
      kind,
      total: list.length,
      monitored,
      blind: blindItems.length,
      coverage_pct: pct,
      blind_items: blindItems.map((it) => it.id),
    });
    totalAll += list.length;
    monitoredAll += monitored;
  }
  entries.sort((a, b) => a.coverage_pct - b.coverage_pct);
  return {
    entries,
    overall_coverage_pct: totalAll ? Math.round((monitoredAll / totalAll) * 100) : 0,
    blind_total: totalAll - monitoredAll,
  };
}

// ============================================================================
// Governance Timeline
// ============================================================================

export interface TimelineEvent {
  ts: string;             // ISO
  kind:
    | 'created'
    | 'last_execution'
    | 'last_incident'
    | 'last_regression'
    | 'last_experiment'
    | 'last_read';
  label: string;
}

export interface TimelineMarkers {
  last_incident_at?: string | null;
  last_regression_at?: string | null;
  last_experiment_at?: string | null;
  last_read_at?: string | null;
}

export function buildGovernanceTimeline(
  item: GovernanceItem,
  snapshot: RuntimeUsageSnapshot | undefined,
  markers: TimelineMarkers = {},
): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { ts: item.created_at, kind: 'created', label: `Criado (v${item.version})` },
  ];
  if (snapshot?.last_used_at) {
    events.push({ ts: snapshot.last_used_at, kind: 'last_execution', label: `Última execução (${snapshot.execution_count} no período)` });
  }
  if (markers.last_incident_at) events.push({ ts: markers.last_incident_at, kind: 'last_incident', label: 'Último incidente' });
  if (markers.last_regression_at) events.push({ ts: markers.last_regression_at, kind: 'last_regression', label: 'Última regressão' });
  if (markers.last_experiment_at) events.push({ ts: markers.last_experiment_at, kind: 'last_experiment', label: 'Último experimento' });
  if (markers.last_read_at) events.push({ ts: markers.last_read_at, kind: 'last_read', label: 'Última leitura' });
  return events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}

// ============================================================================
// Safety guard · documentação executável
// ============================================================================

/**
 * Este módulo é EXCLUSIVAMENTE observacional. Qualquer função que tente
 * mutar registry, banco ou estado runtime deve ser rejeitada em code review.
 *
 * Allowed verbs: aggregate, detect, compute, classify, build.
 * Forbidden verbs: delete, disable, prune, cleanup, refactor, mutate.
 */
export const RUNTIME_GOVERNANCE_POLICY = Object.freeze({
  read_only: true,
  side_effects: 'none' as const,
  allowed_verbs: ['aggregate', 'detect', 'compute', 'classify', 'build'] as const,
  forbidden_actions: ['auto_delete', 'auto_disable', 'auto_prune', 'auto_cleanup', 'auto_refactor'] as const,
});
