/**
 * Runtime Signal Integration Layer & Evidence Correlation Engine
 *
 * Camada PURA e READ-ONLY que fecha o ciclo do ecossistema de onboarding:
 * recebe sinais reais de runtime (RuntimeEvent[] já normalizados pela
 * runtimeGovernance) + o registry estático (GOVERNANCE_REGISTRY) e produz
 * uma malha de **evidência observada** sobre toda a inteligência percebida.
 *
 * Política (frozen):
 *  - APENAS observa. NUNCA muta registry, runtime, flags, banco.
 *  - SEM IA, SEM realtime, SEM novas tabelas, SEM abstrações paralelas.
 *  - Reutiliza tipos e dados das camadas existentes.
 */

import {
  GOVERNANCE_REGISTRY,
  type GovernanceItem,
  type GovernanceKind,
  type LifecycleState,
} from './governanceRegistry';
import type { RuntimeEvent } from './runtimeGovernance';

// ============================================================================
// Política imutável
// ============================================================================

export const EVIDENCE_POLICY = Object.freeze({
  allow_auto_fix: false,
  allow_auto_disable: false,
  allow_mutation: false,
  allow_realtime: false,
  allow_new_tables: false,
  read_only: true,
} as const);

// ============================================================================
// Tipos
// ============================================================================

export type EvidenceSource =
  | 'runtime_event'
  | 'registry_static'
  | 'heuristic_token_match'
  | 'synthetic_fallback'
  | 'config_state';

export type EvidenceQuality = 'strong' | 'medium' | 'weak' | 'none';

export type ProvenanceClass =
  | 'observed'
  | 'observed_proxy'
  | 'declared'
  | 'inferred'
  | 'synthetic'
  | 'empty';

export type TrustBand = 'high' | 'medium' | 'low' | 'unknown';

export interface EvidenceSignal {
  readonly item_id: string;
  readonly source: EvidenceSource;
  readonly quality: EvidenceQuality;
  readonly last_seen_ms: number | null;
  readonly sample_size: number;
  readonly notes?: string;
}

export interface EvidenceCorrelationOptions {
  now?: number;
  window_days?: number;
  min_sample_strong?: number;
  min_sample_medium?: number;
  stale_after_days?: number;
}

const DEFAULTS = Object.freeze({
  window_days: 14,
  min_sample_strong: 30,
  min_sample_medium: 5,
  stale_after_days: 7,
});

const MS_DAY = 86_400_000;

// ============================================================================
// 1. Signal Lineage Map
// ============================================================================

export interface SignalLineageEntry {
  readonly item_id: string;
  readonly kind: GovernanceKind;
  readonly lifecycle: LifecycleState;
  readonly signals: ReadonlyArray<EvidenceSignal>;
  readonly provenance: ProvenanceClass;
  readonly confidence: number;
  readonly trust_band: TrustBand;
  readonly stale: boolean;
}

function pickQuality(
  sample: number,
  opts: { min_sample_strong: number; min_sample_medium: number },
): EvidenceQuality {
  if (sample <= 0) return 'none';
  if (sample >= opts.min_sample_strong) return 'strong';
  if (sample >= opts.min_sample_medium) return 'medium';
  return 'weak';
}

function tokenMatches(itemId: string, eventItemId: string): boolean {
  if (itemId === eventItemId) return false;
  const a = itemId.toLowerCase();
  const b = eventItemId.toLowerCase();
  if (a.length < 4 || b.length < 4) return false;
  return a.includes(b) || b.includes(a);
}

function classifyProvenance(signals: ReadonlyArray<EvidenceSignal>): ProvenanceClass {
  if (signals.length === 0) return 'empty';
  const sources = new Set(signals.map((s) => s.source));
  const hasRuntime = sources.has('runtime_event');
  const hasProxy = sources.has('heuristic_token_match');
  if (hasRuntime && !hasProxy) return 'observed';
  if (hasRuntime || hasProxy) return 'observed_proxy';
  if (sources.has('synthetic_fallback')) return 'synthetic';
  if (sources.has('registry_static') || sources.has('config_state')) return 'declared';
  return 'inferred';
}

function computeConfidence(
  signals: ReadonlyArray<EvidenceSignal>,
  stale: boolean,
): number {
  if (signals.length === 0) return 0;
  const weights: Record<EvidenceSource, number> = {
    runtime_event: 1.0,
    heuristic_token_match: 0.55,
    config_state: 0.35,
    registry_static: 0.25,
    synthetic_fallback: 0.05,
  };
  const qualityMul: Record<EvidenceQuality, number> = {
    strong: 1.0, medium: 0.75, weak: 0.45, none: 0,
  };
  let acc = 0;
  let denom = 0;
  for (const s of signals) {
    const w = weights[s.source];
    acc += w * qualityMul[s.quality];
    denom += w;
  }
  const base = denom > 0 ? acc / denom : 0;
  return Math.max(0, Math.min(1, stale ? base * 0.5 : base));
}

function bandFromConfidence(c: number): TrustBand {
  if (c <= 0) return 'unknown';
  if (c >= 0.75) return 'high';
  if (c >= 0.45) return 'medium';
  return 'low';
}

export function buildSignalLineage(
  events: ReadonlyArray<RuntimeEvent>,
  options: EvidenceCorrelationOptions = {},
  registry: ReadonlyArray<GovernanceItem> = GOVERNANCE_REGISTRY,
): SignalLineageEntry[] {
  const now = options.now ?? Date.now();
  const opts = {
    min_sample_strong: options.min_sample_strong ?? DEFAULTS.min_sample_strong,
    min_sample_medium: options.min_sample_medium ?? DEFAULTS.min_sample_medium,
  };
  const staleAfter = (options.stale_after_days ?? DEFAULTS.stale_after_days) * MS_DAY;

  const exactById = new Map<string, { count: number; last: number }>();
  for (const ev of events) {
    const cur = exactById.get(ev.item_id) ?? { count: 0, last: 0 };
    cur.count += 1;
    if (ev.ts > cur.last) cur.last = ev.ts;
    exactById.set(ev.item_id, cur);
  }

  const tokenById = new Map<string, { count: number; last: number }>();
  for (const item of registry) {
    if (exactById.has(item.id)) continue;
    let count = 0;
    let last = 0;
    for (const [evId, agg] of exactById) {
      if (tokenMatches(item.id, evId)) {
        count += agg.count;
        if (agg.last > last) last = agg.last;
      }
    }
    if (count > 0) tokenById.set(item.id, { count, last });
  }

  return registry.map((item) => {
    const signals: EvidenceSignal[] = [];

    const exact = exactById.get(item.id);
    if (exact) {
      signals.push({
        item_id: item.id,
        source: 'runtime_event',
        quality: pickQuality(exact.count, opts),
        last_seen_ms: exact.last,
        sample_size: exact.count,
      });
    }

    const proxy = tokenById.get(item.id);
    if (proxy && !exact) {
      signals.push({
        item_id: item.id,
        source: 'heuristic_token_match',
        quality: pickQuality(proxy.count, opts),
        last_seen_ms: proxy.last,
        sample_size: proxy.count,
        notes: 'proxy via token-match (sem evento exato)',
      });
    }

    signals.push({
      item_id: item.id,
      source: 'registry_static',
      quality: 'medium',
      last_seen_ms: null,
      sample_size: 0,
    });

    if ((item.kind === 'feature_flag' || item.kind === 'threshold') && !exact && !proxy) {
      signals.push({
        item_id: item.id,
        source: 'config_state',
        quality: 'weak',
        last_seen_ms: null,
        sample_size: 0,
        notes: 'flag/threshold declarada sem evidência de leitura runtime',
      });
    }

    const lastSeen = signals.reduce<number | null>((acc, s) => {
      if (s.last_seen_ms == null) return acc;
      return acc == null ? s.last_seen_ms : Math.max(acc, s.last_seen_ms);
    }, null);
    const stale = lastSeen == null ? true : now - lastSeen > staleAfter;
    const confidence = computeConfidence(signals, stale);
    const provenance = classifyProvenance(signals);

    return {
      item_id: item.id,
      kind: item.kind,
      lifecycle: item.lifecycle,
      signals,
      provenance,
      confidence,
      trust_band: bandFromConfidence(confidence),
      stale,
    };
  });
}

// ============================================================================
// 2. Cross-Engine Evidence Graph
// ============================================================================

export interface EvidenceGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: 'depends_on' | 'consumed_by';
  readonly propagated_confidence: number;
}

export interface EvidenceGraph {
  readonly nodes: ReadonlyArray<{ id: string; confidence: number; band: TrustBand }>;
  readonly edges: ReadonlyArray<EvidenceGraphEdge>;
}

export function buildEvidenceGraph(
  lineage: ReadonlyArray<SignalLineageEntry>,
  registry: ReadonlyArray<GovernanceItem> = GOVERNANCE_REGISTRY,
): EvidenceGraph {
  const byId = new Map(lineage.map((l) => [l.item_id, l] as const));
  const nodes = lineage.map((l) => ({
    id: l.item_id, confidence: l.confidence, band: l.trust_band,
  }));
  const edges: EvidenceGraphEdge[] = [];
  for (const item of registry) {
    const me = byId.get(item.id);
    if (!me) continue;
    for (const dep of item.dependencies) {
      const other = byId.get(dep);
      if (!other) continue;
      edges.push({
        from: item.id, to: dep, relation: 'depends_on',
        propagated_confidence: Math.min(me.confidence, other.confidence),
      });
    }
  }
  return { nodes, edges };
}

// ============================================================================
// 3. Confidence Propagation & Downgrade
// ============================================================================

export interface ConfidencePropagationResult {
  readonly item_id: string;
  readonly original: number;
  readonly effective: number;
  readonly downgraded: boolean;
  readonly downgrade_reason?: string;
}

export function propagateConfidence(
  lineage: ReadonlyArray<SignalLineageEntry>,
  registry: ReadonlyArray<GovernanceItem> = GOVERNANCE_REGISTRY,
): ConfidencePropagationResult[] {
  const byId = new Map(lineage.map((l) => [l.item_id, l] as const));
  const regById = new Map(registry.map((r) => [r.id, r] as const));
  return lineage.map((l) => {
    const reg = regById.get(l.item_id);
    if (!reg || reg.dependencies.length === 0) {
      return { item_id: l.item_id, original: l.confidence, effective: l.confidence, downgraded: false };
    }
    let minDep = 1;
    let worstId: string | null = null;
    for (const d of reg.dependencies) {
      const dep = byId.get(d);
      if (!dep) continue;
      if (dep.confidence < minDep) { minDep = dep.confidence; worstId = d; }
    }
    const effective = Math.max(0, Math.min(1, l.confidence * 0.7 + minDep * 0.3));
    const downgraded = effective < l.confidence - 0.05;
    return {
      item_id: l.item_id,
      original: l.confidence,
      effective,
      downgraded,
      downgrade_reason: downgraded && worstId ? `dependency ${worstId} confidence=${minDep.toFixed(2)}` : undefined,
    };
  });
}

// ============================================================================
// 4. Truth Score por item
// ============================================================================

export interface RuntimeTruthScore {
  readonly item_id: string;
  readonly score: number;
  readonly band: TrustBand;
  readonly provenance: ProvenanceClass;
  readonly stale: boolean;
  readonly contributors: ReadonlyArray<string>;
}

export function computeTruthScores(
  lineage: ReadonlyArray<SignalLineageEntry>,
  propagation: ReadonlyArray<ConfidencePropagationResult>,
): RuntimeTruthScore[] {
  const propById = new Map(propagation.map((p) => [p.item_id, p] as const));
  const provenanceMul: Record<ProvenanceClass, number> = {
    observed: 1.0,
    observed_proxy: 0.85,
    inferred: 0.7,
    declared: 0.55,
    synthetic: 0.25,
    empty: 0,
  };
  return lineage.map((l) => {
    const eff = propById.get(l.item_id)?.effective ?? l.confidence;
    const stalePenalty = l.stale ? 0.7 : 1;
    const score = Math.round(eff * 100 * stalePenalty * provenanceMul[l.provenance]);
    const contributors: string[] = [];
    if (l.provenance === 'synthetic') contributors.push('sinal apenas sintético');
    if (l.provenance === 'declared') contributors.push('apenas declaração de registry');
    if (l.stale) contributors.push('sinal stale');
    if (eff < l.confidence - 0.05) contributors.push('downgrade por dependência fraca');
    if (contributors.length === 0) contributors.push('observação direta consistente');
    return {
      item_id: l.item_id,
      score: Math.max(0, Math.min(100, score)),
      band: bandFromConfidence(score / 100),
      provenance: l.provenance,
      stale: l.stale,
      contributors,
    };
  });
}

// ============================================================================
// 5. Source Reliability Ranking
// ============================================================================

export interface SourceReliability {
  readonly source: EvidenceSource;
  readonly items_supported: number;
  readonly avg_quality: number;
  readonly reliability_score: number;
}

export function rankSourceReliability(
  lineage: ReadonlyArray<SignalLineageEntry>,
): SourceReliability[] {
  const qNum: Record<EvidenceQuality, number> = { strong: 1, medium: 0.7, weak: 0.4, none: 0 };
  const trust: Record<EvidenceSource, number> = {
    runtime_event: 1, heuristic_token_match: 0.6, config_state: 0.4,
    registry_static: 0.3, synthetic_fallback: 0.1,
  };
  const agg = new Map<EvidenceSource, { items: number; q: number }>();
  for (const l of lineage) {
    for (const s of l.signals) {
      const cur = agg.get(s.source) ?? { items: 0, q: 0 };
      cur.items += 1;
      cur.q += qNum[s.quality];
      agg.set(s.source, cur);
    }
  }
  return Array.from(agg.entries()).map(([source, a]) => {
    const avgQ = a.items > 0 ? a.q / a.items : 0;
    return {
      source,
      items_supported: a.items,
      avg_quality: avgQ,
      reliability_score: Math.max(0, Math.min(1, avgQ * trust[source])),
    };
  });
}

// ============================================================================
// 6. Findings (contradição / stale / orphan / broken-chain / blindspot /
//    false-confidence / empty-state / synthetic-only)
// ============================================================================

export type DetectionKind =
  | 'contradiction'
  | 'stale_signal'
  | 'orphan_telemetry'
  | 'broken_chain'
  | 'blindspot'
  | 'false_confidence'
  | 'empty_state'
  | 'synthetic_only';

export interface EvidenceFinding {
  readonly kind: DetectionKind;
  readonly item_id: string | null;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly message: string;
}

export function detectEvidenceFindings(
  lineage: ReadonlyArray<SignalLineageEntry>,
  events: ReadonlyArray<RuntimeEvent>,
  registry: ReadonlyArray<GovernanceItem> = GOVERNANCE_REGISTRY,
): EvidenceFinding[] {
  const out: EvidenceFinding[] = [];
  const byId = new Map(lineage.map((l) => [l.item_id, l] as const));
  const regById = new Map(registry.map((r) => [r.id, r] as const));

  for (const l of lineage) {
    const reg = regById.get(l.item_id);

    if (reg && (reg.lifecycle === 'active' || reg.lifecycle === 'stable')) {
      const hasRuntime = l.signals.some((s) => s.source === 'runtime_event' && s.sample_size > 0);
      if (!hasRuntime) {
        out.push({
          kind: 'contradiction', item_id: l.item_id, severity: 'warning',
          message: `${l.item_id}: lifecycle=${reg.lifecycle} mas sem evidência runtime exata`,
        });
      }
    }

    if (l.stale && l.signals.some((s) => s.last_seen_ms != null)) {
      out.push({
        kind: 'stale_signal', item_id: l.item_id, severity: 'warning',
        message: `${l.item_id}: último sinal observado fora da janela de freshness`,
      });
    }

    if (l.provenance === 'empty') {
      out.push({
        kind: 'empty_state', item_id: l.item_id, severity: 'info',
        message: `${l.item_id}: sem nenhum sinal — nem runtime nem registry`,
      });
    }

    if (l.provenance === 'synthetic') {
      out.push({
        kind: 'synthetic_only', item_id: l.item_id, severity: 'critical',
        message: `${l.item_id}: confiança baseada APENAS em fallback sintético`,
      });
    }

    if (l.trust_band === 'high' && (l.provenance === 'declared' || l.provenance === 'synthetic')) {
      out.push({
        kind: 'false_confidence', item_id: l.item_id, severity: 'critical',
        message: `${l.item_id}: confiança alta sem evidência observada`,
      });
    }

    if (reg) {
      for (const d of reg.dependencies) {
        const dep = byId.get(d);
        if (!dep) {
          out.push({
            kind: 'broken_chain', item_id: l.item_id, severity: 'warning',
            message: `${l.item_id}: dependência ${d} ausente do lineage`,
          });
        } else if (dep.trust_band === 'unknown' || dep.trust_band === 'low') {
          out.push({
            kind: 'broken_chain', item_id: l.item_id, severity: 'warning',
            message: `${l.item_id}: dependência ${d} com trust=${dep.trust_band}`,
          });
        }
      }
    }
  }

  // orphan_telemetry
  const knownIds = new Set(registry.map((r) => r.id));
  const matchedByToken = new Set<string>();
  for (const item of registry) {
    for (const ev of events) {
      if (tokenMatches(item.id, ev.item_id)) matchedByToken.add(ev.item_id);
    }
  }
  const seenEv = new Set<string>();
  for (const ev of events) {
    if (seenEv.has(ev.item_id)) continue;
    seenEv.add(ev.item_id);
    if (!knownIds.has(ev.item_id) && !matchedByToken.has(ev.item_id)) {
      out.push({
        kind: 'orphan_telemetry', item_id: ev.item_id, severity: 'info',
        message: `evento "${ev.item_id}" não mapeia para nenhum item de governance`,
      });
    }
  }

  // blindspot
  for (const item of registry) {
    if (item.kind !== 'dashboard' && item.kind !== 'telemetry_contract') continue;
    const l = byId.get(item.id);
    const observed = l?.signals.some((s) => s.source === 'runtime_event') ?? false;
    if (!observed) {
      out.push({
        kind: 'blindspot', item_id: item.id, severity: 'warning',
        message: `${item.kind} ${item.id}: nenhuma observação runtime — área operacionalmente cega`,
      });
    }
  }

  return out;
}

// ============================================================================
// 7. Runtime Coverage Matrix
// ============================================================================

export interface CoverageMatrixEntry {
  readonly kind: GovernanceKind;
  readonly total: number;
  readonly observed: number;
  readonly proxy: number;
  readonly declared_only: number;
  readonly empty: number;
  readonly coverage_ratio: number;
}

export function buildCoverageMatrix(
  lineage: ReadonlyArray<SignalLineageEntry>,
): CoverageMatrixEntry[] {
  type Mut = {
    kind: GovernanceKind; total: number; observed: number; proxy: number;
    declared_only: number; empty: number;
  };
  const byKind = new Map<GovernanceKind, Mut>();
  for (const l of lineage) {
    const cur = byKind.get(l.kind) ?? {
      kind: l.kind, total: 0, observed: 0, proxy: 0, declared_only: 0, empty: 0,
    };
    cur.total += 1;
    if (l.provenance === 'observed') cur.observed += 1;
    else if (l.provenance === 'observed_proxy' || l.provenance === 'inferred') cur.proxy += 1;
    else if (l.provenance === 'declared') cur.declared_only += 1;
    else if (l.provenance === 'empty' || l.provenance === 'synthetic') cur.empty += 1;
    byKind.set(l.kind, cur);
  }
  return Array.from(byKind.values()).map((c) => ({
    ...c,
    coverage_ratio: c.total > 0 ? c.observed / c.total : 0,
  }));
}

// ============================================================================
// 8. Cross-layer consistency audit
// ============================================================================

export interface CrossLayerAuditEntry {
  readonly item_id: string;
  readonly lifecycle: LifecycleState;
  readonly provenance: ProvenanceClass;
  readonly verdict: 'aligned' | 'over-declared' | 'under-declared' | 'inconsistent';
  readonly note: string;
}

export function auditCrossLayer(
  lineage: ReadonlyArray<SignalLineageEntry>,
): CrossLayerAuditEntry[] {
  return lineage.map((l) => {
    const isObserved = l.provenance === 'observed' || l.provenance === 'observed_proxy';
    let verdict: CrossLayerAuditEntry['verdict'] = 'aligned';
    let note = 'declaração coerente com observação';
    if ((l.lifecycle === 'active' || l.lifecycle === 'stable') && !isObserved) {
      verdict = 'over-declared';
      note = 'declarado ativo mas sem evidência runtime';
    } else if (
      (l.lifecycle === 'deprecated' || l.lifecycle === 'disabled' || l.lifecycle === 'archived') &&
      isObserved
    ) {
      verdict = 'under-declared';
      note = 'declarado deprecated/disabled mas ainda observado em runtime';
    } else if (l.provenance === 'synthetic') {
      verdict = 'inconsistent';
      note = 'evidência sintética — confiança não auditável';
    }
    return { item_id: l.item_id, lifecycle: l.lifecycle, provenance: l.provenance, verdict, note };
  });
}

// ============================================================================
// 9. Aggregate convenience
// ============================================================================

export interface EvidenceReport {
  readonly lineage: ReadonlyArray<SignalLineageEntry>;
  readonly graph: EvidenceGraph;
  readonly propagation: ReadonlyArray<ConfidencePropagationResult>;
  readonly truth: ReadonlyArray<RuntimeTruthScore>;
  readonly sources: ReadonlyArray<SourceReliability>;
  readonly findings: ReadonlyArray<EvidenceFinding>;
  readonly coverage: ReadonlyArray<CoverageMatrixEntry>;
  readonly audit: ReadonlyArray<CrossLayerAuditEntry>;
}

export function buildEvidenceReport(
  events: ReadonlyArray<RuntimeEvent>,
  options: EvidenceCorrelationOptions = {},
  registry: ReadonlyArray<GovernanceItem> = GOVERNANCE_REGISTRY,
): EvidenceReport {
  const lineage = buildSignalLineage(events, options, registry);
  const graph = buildEvidenceGraph(lineage, registry);
  const propagation = propagateConfidence(lineage, registry);
  const truth = computeTruthScores(lineage, propagation);
  const sources = rankSourceReliability(lineage);
  const findings = detectEvidenceFindings(lineage, events, registry);
  const coverage = buildCoverageMatrix(lineage);
  const audit = auditCrossLayer(lineage);
  return { lineage, graph, propagation, truth, sources, findings, coverage, audit };
}
