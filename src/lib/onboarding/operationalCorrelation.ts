/**
 * Cross-Engine Correlation Layer
 *
 * Engine pura/determinística que correlaciona findings já produzidos por
 * outras engines (Reality, Memory, Hardening, Evidence, SelfAudit,
 * Governance). NÃO faz IO, NÃO faz fetch, NÃO toca persistência, NÃO altera
 * o onboarding real.
 *
 * Saída read-only: incidentes correlacionados, cadeias de propagação,
 * padrões sistêmicos, matriz de confiança e entropia operacional global.
 *
 * IMPORTANTE
 *  - Sem hooks React aqui.
 *  - Sem dependências de outras engines (tipos próprios mínimos).
 *  - Fail-soft: entradas vazias/undefined produzem snapshot vazio coerente.
 *  - Determinístico: mesmo input -> mesmo output.
 */

// ============================================================================
// Tipos públicos
// ============================================================================

export type CorrelationSeverity = 'low' | 'medium' | 'high' | 'critical';

export type CorrelationEngine =
  | 'reality'
  | 'memory'
  | 'hardening'
  | 'evidence'
  | 'self_audit'
  | 'governance';

/** Forma mínima exigida de qualquer finding de qualquer engine. */
export interface CorrelationFinding {
  /** id estável dentro da engine de origem */
  id: string;
  /** detector/tipo (ex: 'partial_persistence', 'hydration_race') */
  detector: string;
  /** fase do onboarding (quando aplicável) */
  phase?: string;
  /** sessão envolvida (quando aplicável) */
  sessionId?: string;
  /** release/versão observada (quando aplicável) */
  release?: string;
  /** severidade local da engine */
  severity?: CorrelationSeverity;
  /** confiança local 0..1 */
  confidence?: number;
  /** timestamp ISO (ordenação determinística) */
  observedAt?: string;
  /** tokens livres p/ matching cruzado (ex: ['recovery','retry']) */
  tags?: string[];
}

export type RealityFinding = CorrelationFinding;
export type MemoryFinding = CorrelationFinding;
export type HardeningFinding = CorrelationFinding;
export type EvidenceFinding = CorrelationFinding;
export type SelfAuditFinding = CorrelationFinding;
export type GovernanceFinding = CorrelationFinding;

export interface CorrelationInput {
  reality?: RealityFinding[];
  memory?: MemoryFinding[];
  hardening?: HardeningFinding[];
  evidence?: EvidenceFinding[];
  selfAudit?: SelfAuditFinding[];
  governance?: GovernanceFinding[];
}

export type CorrelatedPattern =
  | 'cascading_persistence_failure'
  | 'correlated_recovery_break'
  | 'systemic_navigation_instability'
  | 'fragmented_session_cluster'
  | 'governance_runtime_divergence'
  | 'telemetry_truth_mismatch'
  | 'chronic_retry_amplification'
  | 'hidden_partial_persistence'
  | 'multi_engine_consensus_failure'
  | 'operational_entropy_spike';

export interface CorrelatedIncident {
  id: string;
  pattern: CorrelatedPattern;
  severity: CorrelationSeverity;
  confidence: number; // 0..1
  supportingEngines: CorrelationEngine[];
  conflictingEngines: CorrelationEngine[];
  findingIds: string[];
  phases: string[];
  sessions: string[];
  rationale: string;
}

export type PropagationNodeKind =
  | 'reality'
  | 'memory'
  | 'hardening'
  | 'evidence'
  | 'governance'
  | 'self_audit'
  | 'release'
  | 'experiment'
  | 'telemetry'
  | 'persistence';

export type PropagationEdgeKind =
  | 'causes'
  | 'amplifies'
  | 'masks'
  | 'fragments'
  | 'delays'
  | 'corrupts'
  | 'retries'
  | 'diverges';

export interface PropagationNode {
  id: string;
  kind: PropagationNodeKind;
  label: string;
}

export interface PropagationEdge {
  from: string;
  to: string;
  kind: PropagationEdgeKind;
  weight: number; // 0..1
}

export interface PropagationChain {
  id: string;
  nodeIds: string[];
  depth: number;
  severity: CorrelationSeverity;
  confidence: number;
}

export interface SystemicPattern {
  pattern: CorrelatedPattern;
  occurrences: number;
  engines: CorrelationEngine[];
  severity: CorrelationSeverity;
}

export interface ConfidenceMatrixRow {
  engine: CorrelationEngine;
  findings: number;
  avgConfidence: number; // 0..1
  agreementScore: number; // 0..1
  contradictionScore: number; // 0..1
}

export interface OperationalPropagationGraph {
  nodes: PropagationNode[];
  edges: PropagationEdge[];
  depth: number;
  convergence: number; // 0..1 (quantas cadeias terminam no mesmo cluster)
  divergence: number; // 0..1 (quantas cadeias se separam)
  isolatedClusters: number;
  systemicHotspots: string[]; // node ids
}

export interface CorrelationSnapshot {
  correlatedIncidents: CorrelatedIncident[];
  propagationChains: PropagationChain[];
  systemicPatterns: SystemicPattern[];
  confidenceMatrix: ConfidenceMatrixRow[];
  propagationGraph: OperationalPropagationGraph;
  scores: {
    operational_entropy: number; // 0..100 (alto = ruim)
    systemic_stability: number; // 0..100 (alto = bom)
    correlation_confidence: number; // 0..100
    runtime_cohesion: number; // 0..100
  };
}

export interface OperationalConsensus {
  agreement_score: number; // 0..1
  contradiction_score: number; // 0..1
  supporting_engines: CorrelationEngine[];
  conflicting_engines: CorrelationEngine[];
  evidence_strength: number; // 0..1
  severity: CorrelationSeverity;
  pattern: CorrelatedPattern | null;
  confidence: number; // 0..1
}

export interface ImpactForecastInput {
  affectedAreas: string[];
  severity: CorrelationSeverity;
  blastRadius?: number;
}

export interface ImpactForecast {
  estimatedRisk: CorrelationSeverity;
  affectedFlows: string[];
  likelyRegressions: string[];
  propagationProbability: number; // 0..1
  confidence: number; // 0..1
}

// ============================================================================
// Policy
// ============================================================================

export const CORRELATION_POLICY = Object.freeze({
  allow_auto_mitigation: false,
  allow_runtime_mutation: false,
  allow_realtime: false,
  allow_ai: false,
  allow_new_tables: false,
  read_only: true,
});

const SEVERITY_RANK: Record<CorrelationSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const RANK_SEVERITY: CorrelationSeverity[] = ['low', 'low', 'medium', 'high', 'critical'];

function escalate(a: CorrelationSeverity, b: CorrelationSeverity): CorrelationSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

function severityFromScore(score: number): CorrelationSeverity {
  if (score >= 0.85) return 'critical';
  if (score >= 0.65) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function safeArr<T>(a: T[] | undefined): T[] {
  return Array.isArray(a) ? a.filter(Boolean) : [];
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  let s = 0;
  for (const n of nums) s += n;
  return s / nums.length;
}

// ============================================================================
// Normalização
// ============================================================================

interface NormFinding extends Required<Pick<CorrelationFinding, 'id' | 'detector'>> {
  engine: CorrelationEngine;
  phase: string;
  sessionId: string;
  release: string;
  severity: CorrelationSeverity;
  confidence: number;
  observedAt: string;
  tags: string[];
}

function normalize(engine: CorrelationEngine, list: CorrelationFinding[] | undefined): NormFinding[] {
  const out: NormFinding[] = [];
  for (const f of safeArr(list)) {
    if (!f || typeof f.id !== 'string' || typeof f.detector !== 'string') continue;
    out.push({
      engine,
      id: f.id,
      detector: f.detector,
      phase: f.phase ?? '',
      sessionId: f.sessionId ?? '',
      release: f.release ?? '',
      severity: f.severity ?? 'low',
      confidence: clamp01(f.confidence ?? 0.5),
      observedAt: f.observedAt ?? '',
      tags: uniq(safeArr(f.tags)).map((t) => String(t).toLowerCase()),
    });
  }
  // ordenação determinística
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function normalizeAll(input: CorrelationInput): NormFinding[] {
  return [
    ...normalize('reality', input.reality),
    ...normalize('memory', input.memory),
    ...normalize('hardening', input.hardening),
    ...normalize('evidence', input.evidence),
    ...normalize('self_audit', input.selfAudit),
    ...normalize('governance', input.governance),
  ];
}

// ============================================================================
// Detectores de padrões correlacionados
// ============================================================================

const DETECTOR_TOKENS: Record<CorrelatedPattern, string[]> = {
  cascading_persistence_failure: ['persistence', 'partial_persistence', 'incomplete_transaction'],
  correlated_recovery_break: ['recovery', 'recovery_integrity_failure', 'broken_chain'],
  systemic_navigation_instability: ['dead_navigation', 'navigation', 'phase_jump'],
  fragmented_session_cluster: ['session_fragmentation', 'state_fragmentation'],
  governance_runtime_divergence: ['governance', 'runtime', 'divergence', 'flag_without_runtime'],
  telemetry_truth_mismatch: ['telemetry', 'truth', 'evidence', 'taxonomy_drift'],
  chronic_retry_amplification: ['retry', 'retry_storm', 'amplified'],
  hidden_partial_persistence: ['partial_persistence', 'phantom_success', 'silent_failure'],
  multi_engine_consensus_failure: ['consensus', 'mismatch', 'contradiction'],
  operational_entropy_spike: ['entropy', 'spike', 'instability'],
};

function matchesPattern(f: NormFinding, pattern: CorrelatedPattern): boolean {
  const tokens = DETECTOR_TOKENS[pattern];
  const hay = `${f.detector} ${f.tags.join(' ')}`.toLowerCase();
  return tokens.some((t) => hay.includes(t));
}

function buildCorrelatedIncidents(all: NormFinding[]): CorrelatedIncident[] {
  const incidents: CorrelatedIncident[] = [];
  const patterns = Object.keys(DETECTOR_TOKENS) as CorrelatedPattern[];

  for (const pattern of patterns) {
    const matched = all.filter((f) => matchesPattern(f, pattern));
    if (matched.length === 0) continue;
    const engines = uniq(matched.map((m) => m.engine));
    // multi-engine pattern: precisa de pelo menos 2 engines OU 3+ findings
    if (engines.length < 2 && matched.length < 3) continue;

    const confidence = clamp01(avg(matched.map((m) => m.confidence)) * (0.6 + 0.1 * engines.length));
    const sev = matched.reduce<CorrelationSeverity>(
      (acc, m) => escalate(acc, m.severity),
      'low',
    );

    incidents.push({
      id: `inc:${pattern}:${matched.length}:${engines.sort().join(',')}`,
      pattern,
      severity: sev,
      confidence,
      supportingEngines: engines.sort(),
      conflictingEngines: [],
      findingIds: matched.map((m) => `${m.engine}:${m.id}`).sort(),
      phases: uniq(matched.map((m) => m.phase).filter(Boolean)).sort(),
      sessions: uniq(matched.map((m) => m.sessionId).filter(Boolean)).sort(),
      rationale:
        `${matched.length} findings across ${engines.length} engine(s) match ` +
        `pattern "${pattern}". Severity escalated to ${sev}.`,
    });
  }

  // multi_engine_consensus_failure: contradição quando engines discordam
  // sobre a mesma sessão (severidades opostas).
  const bySession = new Map<string, NormFinding[]>();
  for (const f of all) {
    if (!f.sessionId) continue;
    const arr = bySession.get(f.sessionId) ?? [];
    arr.push(f);
    bySession.set(f.sessionId, arr);
  }
  for (const [sessionId, group] of Array.from(bySession.entries()).sort((a, b) =>
    a[0] < b[0] ? -1 : 1,
  )) {
    const engines = uniq(group.map((g) => g.engine));
    if (engines.length < 2) continue;
    const sevs = uniq(group.map((g) => g.severity));
    const hasLow = sevs.includes('low');
    const hasHigh = sevs.includes('high') || sevs.includes('critical');
    if (!(hasLow && hasHigh)) continue;
    incidents.push({
      id: `inc:contradiction:${sessionId}`,
      pattern: 'multi_engine_consensus_failure',
      severity: 'high',
      confidence: 0.7,
      supportingEngines: engines.filter((e) => group.some((g) => g.engine === e && SEVERITY_RANK[g.severity] >= 3)),
      conflictingEngines: engines.filter((e) => group.some((g) => g.engine === e && g.severity === 'low')),
      findingIds: group.map((g) => `${g.engine}:${g.id}`).sort(),
      phases: uniq(group.map((g) => g.phase).filter(Boolean)).sort(),
      sessions: [sessionId],
      rationale: `Engines disagree on session ${sessionId}: ${engines.join(', ')}.`,
    });
  }

  return incidents.sort((a, b) =>
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || (a.id < b.id ? -1 : 1),
  );
}

// ============================================================================
// Confidence matrix + consensus
// ============================================================================

function buildConfidenceMatrix(
  all: NormFinding[],
  incidents: CorrelatedIncident[],
): ConfidenceMatrixRow[] {
  const engines: CorrelationEngine[] = ['reality', 'memory', 'hardening', 'evidence', 'self_audit', 'governance'];
  return engines.map((engine) => {
    const own = all.filter((f) => f.engine === engine);
    const agreements = incidents.filter((i) => i.supportingEngines.includes(engine)).length;
    const conflicts = incidents.filter((i) => i.conflictingEngines.includes(engine)).length;
    const total = Math.max(1, incidents.length);
    return {
      engine,
      findings: own.length,
      avgConfidence: clamp01(avg(own.map((o) => o.confidence))),
      agreementScore: clamp01(agreements / total),
      contradictionScore: clamp01(conflicts / total),
    };
  });
}

export function computeOperationalConsensus(input: CorrelationInput): OperationalConsensus {
  const all = normalizeAll(input);
  const incidents = buildCorrelatedIncidents(all);
  const engines = uniq(all.map((a) => a.engine));
  const supporting = uniq(incidents.flatMap((i) => i.supportingEngines));
  const conflicting = uniq(incidents.flatMap((i) => i.conflictingEngines));

  const top = incidents[0] ?? null;
  const agreement_score = engines.length
    ? clamp01(supporting.length / Math.max(1, engines.length))
    : 0;
  const contradiction_score = engines.length
    ? clamp01(conflicting.length / Math.max(1, engines.length))
    : 0;
  const evidence_strength = clamp01(avg(all.map((a) => a.confidence)));
  const severity = top?.severity ?? 'low';
  const confidence = top
    ? clamp01(top.confidence * (1 - contradiction_score * 0.3))
    : 0;

  return {
    agreement_score,
    contradiction_score,
    supporting_engines: supporting.sort(),
    conflicting_engines: conflicting.sort(),
    evidence_strength,
    severity,
    pattern: top?.pattern ?? null,
    confidence,
  };
}

// ============================================================================
// Propagation graph
// ============================================================================

function engineToNodeKind(e: CorrelationEngine): PropagationNodeKind {
  switch (e) {
    case 'reality':
      return 'reality';
    case 'memory':
      return 'memory';
    case 'hardening':
      return 'hardening';
    case 'evidence':
      return 'evidence';
    case 'governance':
      return 'governance';
    case 'self_audit':
      return 'self_audit';
  }
}

function pickEdgeKind(detector: string): PropagationEdgeKind {
  const d = detector.toLowerCase();
  if (d.includes('retry')) return 'retries';
  if (d.includes('amplif')) return 'amplifies';
  if (d.includes('mask') || d.includes('phantom')) return 'masks';
  if (d.includes('fragment')) return 'fragments';
  if (d.includes('delay')) return 'delays';
  if (d.includes('corrupt')) return 'corrupts';
  if (d.includes('diverg') || d.includes('mismatch')) return 'diverges';
  return 'causes';
}

export function buildOperationalPropagationGraph(
  input: CorrelationInput,
): OperationalPropagationGraph {
  const all = normalizeAll(input);
  if (all.length === 0) {
    return {
      nodes: [],
      edges: [],
      depth: 0,
      convergence: 0,
      divergence: 0,
      isolatedClusters: 0,
      systemicHotspots: [],
    };
  }

  const nodeMap = new Map<string, PropagationNode>();
  const addNode = (id: string, kind: PropagationNodeKind, label: string) => {
    if (!nodeMap.has(id)) nodeMap.set(id, { id, kind, label });
  };

  // nó por engine + nó por release + nó por persistência/telemetria implícitos
  for (const f of all) {
    const engineId = `engine:${f.engine}`;
    addNode(engineId, engineToNodeKind(f.engine), f.engine);
    if (f.release) addNode(`release:${f.release}`, 'release', f.release);
    if (f.detector.includes('persist')) addNode('persistence', 'persistence', 'persistence');
    if (f.detector.includes('telem') || f.detector.includes('evidence'))
      addNode('telemetry', 'telemetry', 'telemetry');
  }

  // edges entre engines que compartilham fase ou sessão
  const edges: PropagationEdge[] = [];
  const seenEdge = new Set<string>();
  const pushEdge = (from: string, to: string, kind: PropagationEdgeKind, weight: number) => {
    const key = `${from}->${to}:${kind}`;
    if (seenEdge.has(key) || from === to) return;
    seenEdge.add(key);
    edges.push({ from, to, kind, weight: clamp01(weight) });
  };

  const groupByKey = (keyFn: (f: NormFinding) => string) => {
    const m = new Map<string, NormFinding[]>();
    for (const f of all) {
      const k = keyFn(f);
      if (!k) continue;
      const arr = m.get(k) ?? [];
      arr.push(f);
      m.set(k, arr);
    }
    return m;
  };

  for (const [, group] of groupByKey((f) => f.sessionId)) {
    const engines = uniq(group.map((g) => g.engine)).sort();
    for (let i = 0; i < engines.length; i++) {
      for (let j = i + 1; j < engines.length; j++) {
        const a = group.find((g) => g.engine === engines[i])!;
        const b = group.find((g) => g.engine === engines[j])!;
        pushEdge(`engine:${a.engine}`, `engine:${b.engine}`, pickEdgeKind(a.detector), 0.6);
      }
    }
  }
  for (const [, group] of groupByKey((f) => f.phase)) {
    const engines = uniq(group.map((g) => g.engine)).sort();
    for (let i = 0; i < engines.length; i++) {
      for (let j = i + 1; j < engines.length; j++) {
        pushEdge(`engine:${engines[i]}`, `engine:${engines[j]}`, 'causes', 0.4);
      }
    }
  }
  for (const f of all) {
    if (f.release) pushEdge(`release:${f.release}`, `engine:${f.engine}`, 'causes', 0.5);
    if (f.detector.includes('persist'))
      pushEdge(`engine:${f.engine}`, 'persistence', 'corrupts', 0.5);
    if (f.detector.includes('telem') || f.detector.includes('evidence'))
      pushEdge(`engine:${f.engine}`, 'telemetry', 'diverges', 0.5);
  }

  const nodes = Array.from(nodeMap.values()).sort((a, b) => (a.id < b.id ? -1 : 1));

  // métricas estruturais determinísticas
  const adjacency = new Map<string, Set<string>>();
  for (const n of nodes) adjacency.set(n.id, new Set());
  for (const e of edges) {
    adjacency.get(e.from)?.add(e.to);
    adjacency.get(e.to)?.add(e.from);
  }
  // BFS para clusters isolados
  const visited = new Set<string>();
  let clusters = 0;
  let maxDepth = 0;
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    clusters++;
    const queue: Array<[string, number]> = [[n.id, 0]];
    visited.add(n.id);
    while (queue.length) {
      const [cur, d] = queue.shift()!;
      if (d > maxDepth) maxDepth = d;
      for (const nb of adjacency.get(cur) ?? []) {
        if (visited.has(nb)) continue;
        visited.add(nb);
        queue.push([nb, d + 1]);
      }
    }
  }

  // hotspots: nós com grau >= 3
  const hotspots = nodes
    .filter((n) => (adjacency.get(n.id)?.size ?? 0) >= 3)
    .map((n) => n.id)
    .sort();

  const totalEdges = edges.length;
  const convergence = nodes.length ? clamp01(hotspots.length / Math.max(1, nodes.length)) : 0;
  const divergence = totalEdges
    ? clamp01(clusters / Math.max(1, nodes.length))
    : 0;

  return {
    nodes,
    edges: edges.sort((a, b) => (a.from + a.to + a.kind).localeCompare(b.from + b.to + b.kind)),
    depth: maxDepth,
    convergence,
    divergence,
    isolatedClusters: clusters,
    systemicHotspots: hotspots,
  };
}

// ============================================================================
// Chains
// ============================================================================

function buildPropagationChains(
  incidents: CorrelatedIncident[],
  graph: OperationalPropagationGraph,
): PropagationChain[] {
  if (!incidents.length || !graph.nodes.length) return [];
  // chain = sequência de engines envolvidas num incidente, ancorada nos nós engine:*
  return incidents
    .map((inc, idx) => {
      const nodeIds = inc.supportingEngines.map((e) => `engine:${e}`);
      const depth = Math.max(0, nodeIds.length - 1);
      return {
        id: `chain:${idx}:${inc.pattern}`,
        nodeIds,
        depth,
        severity: inc.severity,
        confidence: inc.confidence,
      };
    })
    .filter((c) => c.nodeIds.length > 0);
}

function buildSystemicPatterns(incidents: CorrelatedIncident[]): SystemicPattern[] {
  const m = new Map<CorrelatedPattern, SystemicPattern>();
  for (const inc of incidents) {
    const existing = m.get(inc.pattern);
    if (existing) {
      existing.occurrences += 1;
      existing.engines = uniq([...existing.engines, ...inc.supportingEngines]).sort() as CorrelationEngine[];
      existing.severity = escalate(existing.severity, inc.severity);
    } else {
      m.set(inc.pattern, {
        pattern: inc.pattern,
        occurrences: 1,
        engines: [...inc.supportingEngines].sort() as CorrelationEngine[],
        severity: inc.severity,
      });
    }
  }
  return Array.from(m.values()).sort(
    (a, b) => b.occurrences - a.occurrences || (a.pattern < b.pattern ? -1 : 1),
  );
}

// ============================================================================
// Scores globais
// ============================================================================

function computeScores(
  all: NormFinding[],
  incidents: CorrelatedIncident[],
  graph: OperationalPropagationGraph,
  matrix: ConfidenceMatrixRow[],
): CorrelationSnapshot['scores'] {
  if (all.length === 0) {
    return {
      operational_entropy: 0,
      systemic_stability: 100,
      correlation_confidence: 0,
      runtime_cohesion: 100,
    };
  }

  // entropy: pesado por severidade crítica + clusters isolados + contradições
  const critical = incidents.filter((i) => i.severity === 'critical').length;
  const high = incidents.filter((i) => i.severity === 'high').length;
  const contradictions = incidents.filter((i) => i.pattern === 'multi_engine_consensus_failure').length;
  const fragmentation = graph.isolatedClusters > 1 ? graph.isolatedClusters - 1 : 0;
  const hiddenLoops = all.filter((a) => a.detector.toLowerCase().includes('loop')).length;
  const cascades = all.filter((a) => a.detector.toLowerCase().includes('cascad')).length;

  const entropyRaw =
    critical * 18 +
    high * 9 +
    contradictions * 12 +
    fragmentation * 6 +
    hiddenLoops * 5 +
    cascades * 5;
  const operational_entropy = clamp100(entropyRaw);

  const systemic_stability = clamp100(100 - operational_entropy * 0.9);

  const avgConfidence = avg(matrix.map((r) => r.avgConfidence));
  const avgAgreement = avg(matrix.map((r) => r.agreementScore));
  const correlation_confidence = clamp100((avgConfidence * 0.6 + avgAgreement * 0.4) * 100);

  const enginesActive = uniq(all.map((a) => a.engine)).length;
  const cohesion = enginesActive >= 4 ? 100 : enginesActive * 22;
  const runtime_cohesion = clamp100(cohesion - operational_entropy * 0.3);

  return {
    operational_entropy,
    systemic_stability,
    correlation_confidence,
    runtime_cohesion,
  };
}

// ============================================================================
// Entrypoint
// ============================================================================

export function correlateOperationalFindings(input: CorrelationInput | undefined | null): CorrelationSnapshot {
  const safe: CorrelationInput = input ?? {};
  const all = normalizeAll(safe);
  const incidents = buildCorrelatedIncidents(all);
  const graph = buildOperationalPropagationGraph(safe);
  const chains = buildPropagationChains(incidents, graph);
  const patterns = buildSystemicPatterns(incidents);
  const matrix = buildConfidenceMatrix(all, incidents);
  const scores = computeScores(all, incidents, graph, matrix);

  return {
    correlatedIncidents: incidents,
    propagationChains: chains,
    systemicPatterns: patterns,
    confidenceMatrix: matrix,
    propagationGraph: graph,
    scores,
  };
}

// ============================================================================
// Change impact forecast (heurística determinística)
// ============================================================================

const REGRESSION_HINTS: Record<string, string[]> = {
  persistence: ['draft_loss', 'partial_save', 'recovery_break'],
  recovery: ['stale_recovery', 'broken_chain'],
  navigation: ['dead_navigation', 'phase_jump'],
  telemetry: ['event_loss', 'taxonomy_drift'],
  governance: ['flag_without_runtime', 'orphan_rpc'],
  hardening: ['retry_storm', 'hydration_race'],
  reality: ['phantom_success', 'silent_failure'],
  memory: ['recurrence_blindspot'],
  evidence: ['truth_mismatch'],
};

export function forecastOperationalImpact(input: ImpactForecastInput): ImpactForecast {
  const areas = uniq(safeArr(input?.affectedAreas).map((a) => String(a).toLowerCase()));
  const severity = input?.severity ?? 'low';
  const blast = clamp01((input?.blastRadius ?? 0) / 10);

  const affectedFlows = areas.length ? areas : [];
  const likelyRegressions = uniq(
    areas.flatMap((a) => {
      const key = Object.keys(REGRESSION_HINTS).find((k) => a.includes(k));
      return key ? REGRESSION_HINTS[key] : [];
    }),
  ).sort();

  const baseProb =
    SEVERITY_RANK[severity] / 4 * 0.6 + Math.min(1, areas.length / 4) * 0.3 + blast * 0.1;
  const propagationProbability = clamp01(baseProb);

  const estimatedRiskRank = Math.min(
    4,
    SEVERITY_RANK[severity] + (likelyRegressions.length >= 3 ? 1 : 0),
  );
  const estimatedRisk = RANK_SEVERITY[estimatedRiskRank];

  const confidence = clamp01(0.4 + areas.length * 0.1 + (likelyRegressions.length ? 0.2 : 0));

  return {
    estimatedRisk,
    affectedFlows,
    likelyRegressions,
    propagationProbability,
    confidence,
  };
}
