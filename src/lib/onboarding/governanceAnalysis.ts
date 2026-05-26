/**
 * Onboarding Governance Analysis · funções puras sobre o registry.
 *
 * Drift detection, dependency graph, blast radius, change impact, lifecycle
 * transitions e documentação determinística. Nada aqui executa ações:
 * apenas lê o registry estático e (opcionalmente) sinais de runtime que o
 * caller injeta (ex.: contagens de eventos por RPC nas últimas 24h).
 *
 * NÃO chama Supabase. NÃO escreve em disco. NÃO usa IA.
 */
import {
  GOVERNANCE_REGISTRY,
  REGISTRY_INDEX,
  type GovernanceItem,
  type GovernanceKind,
  type LifecycleState,
  type RiskLevel,
} from './governanceRegistry';

// ---------------------------------------------------------------------------
// VERSIONING
// ---------------------------------------------------------------------------

export interface ParsedVersion { major: number; minor: number; patch: number; raw: string }

export function parseVersion(v: string): ParsedVersion {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec((v || '').trim());
  if (!m) return { major: 0, minor: 0, patch: 0, raw: v };
  return { major: +m[1], minor: +m[2], patch: +m[3], raw: v };
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a); const pb = parseVersion(b);
  return pa.major - pb.major || pa.minor - pb.minor || pa.patch - pb.patch;
}

export type VersionBump = 'none' | 'patch' | 'minor' | 'major';

export function classifyVersionBump(prev: string, next: string): VersionBump {
  const a = parseVersion(prev); const b = parseVersion(next);
  if (a.major !== b.major) return 'major';
  if (a.minor !== b.minor) return 'minor';
  if (a.patch !== b.patch) return 'patch';
  return 'none';
}

// ---------------------------------------------------------------------------
// DEPENDENCY GRAPH + BLAST RADIUS
// ---------------------------------------------------------------------------

export interface DependencyEdge { from: string; to: string }

/** Constrói grafo dirigido: aresta `from -> to` quando `from` depende de `to`. */
export function buildDependencyGraph(items: GovernanceItem[] = GOVERNANCE_REGISTRY): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  for (const it of items) {
    for (const dep of it.dependencies) {
      edges.push({ from: it.id, to: dep });
    }
  }
  return edges;
}

/** Lista quem depende de `id` (downstream / reverse deps). */
export function findDependents(id: string, items: GovernanceItem[] = GOVERNANCE_REGISTRY): GovernanceItem[] {
  return items.filter((it) => it.dependencies.includes(id));
}

/**
 * Blast radius: conjunto de itens IMPACTADOS se `id` for desligado.
 * BFS reversa via dependents, com proteção contra ciclos.
 */
export function computeBlastRadius(id: string, items: GovernanceItem[] = GOVERNANCE_REGISTRY): {
  impacted: GovernanceItem[];
  estimated_severity: RiskLevel;
} {
  const visited = new Set<string>();
  const queue = [id];
  const out: GovernanceItem[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const dep of findDependents(cur, items)) {
      if (!visited.has(dep.id)) {
        visited.add(dep.id);
        out.push(dep);
        queue.push(dep.id);
      }
    }
  }
  // Severidade derivada do pior risco impactado + size do raio.
  const worst = out.reduce<RiskLevel>((acc, it) => maxRisk(acc, it.risk_level), 'low');
  const severity: RiskLevel =
    out.length === 0 ? 'low'
    : out.length >= 5 ? maxRisk(worst, 'high')
    : worst;
  return { impacted: out, estimated_severity: severity };
}

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}

// ---------------------------------------------------------------------------
// DRIFT DETECTION
// ---------------------------------------------------------------------------

export type DriftKind =
  | 'stale_rule'
  | 'orphan_flag'
  | 'dead_metric'
  | 'unused_threshold'
  | 'abandoned_experiment'
  | 'unused_rpc'
  | 'empty_dashboard';

export interface DriftAlert {
  kind: DriftKind;
  item_id: string;
  reason: string;
  severity: RiskLevel;
}

export interface RuntimeSignals {
  /** id de item → eventos/uso na janela monitorada. */
  usage: Record<string, number>;
  /** Idade em dias da última atualização relevante por item. */
  staleness_days?: Record<string, number>;
  /** Janela de coleta em dias (default 14). */
  window_days?: number;
}

/**
 * Identifica drifts a partir do registry + sinais de runtime opcionais.
 * Quando `signals` for omitido, retorna apenas drifts estruturais
 * (depreciação sem substituto, dependências órfãs, etc.).
 */
export function detectDrift(
  signals: RuntimeSignals = { usage: {} },
  items: GovernanceItem[] = GOVERNANCE_REGISTRY,
): DriftAlert[] {
  const alerts: DriftAlert[] = [];
  const idx = new Map(items.map((it) => [it.id, it]));
  const usage = signals.usage || {};
  const stale = signals.staleness_days || {};

  for (const it of items) {
    // Dependência apontando para id inexistente → estrutural.
    for (const dep of it.dependencies) {
      if (!idx.has(dep)) {
        alerts.push({ kind: 'stale_rule', item_id: it.id, reason: `Dependência inexistente: ${dep}`, severity: 'high' });
      }
    }
    // Deprecation sem replacement nem sunset → risco.
    if (it.lifecycle === 'deprecated' && !it.deprecation_state?.replacement && !it.deprecation_state?.sunset) {
      alerts.push({ kind: 'stale_rule', item_id: it.id, reason: 'Deprecated sem replacement nem sunset.', severity: 'medium' });
    }

    // Sinais de runtime: só checa quando temos dados de uso.
    if (Object.keys(usage).length === 0) continue;
    const used = usage[it.id] ?? 0;
    const old = stale[it.id] ?? 0;

    if (it.kind === 'feature_flag' && used === 0 && it.lifecycle !== 'experimental' && it.lifecycle !== 'archived') {
      alerts.push({ kind: 'orphan_flag', item_id: it.id, reason: 'Flag sem leitura registrada na janela.', severity: 'low' });
    }
    if (it.kind === 'threshold' && used === 0 && it.lifecycle === 'active') {
      alerts.push({ kind: 'unused_threshold', item_id: it.id, reason: 'Threshold sem consumo na janela.', severity: 'low' });
    }
    if (it.kind === 'rpc' && used === 0 && it.lifecycle === 'active') {
      alerts.push({ kind: 'unused_rpc', item_id: it.id, reason: 'RPC sem invocação na janela.', severity: 'medium' });
    }
    if (it.kind === 'dashboard' && used === 0 && it.lifecycle === 'active') {
      alerts.push({ kind: 'empty_dashboard', item_id: it.id, reason: 'Dashboard sem acessos na janela.', severity: 'low' });
    }
    if (it.kind === 'telemetry_contract' && used === 0) {
      alerts.push({ kind: 'dead_metric', item_id: it.id, reason: 'Contrato de telemetria sem eventos na janela.', severity: 'high' });
    }
    if (it.kind === 'engine' && it.tags?.includes('experiment') && old >= 30) {
      alerts.push({ kind: 'abandoned_experiment', item_id: it.id, reason: 'Sem atualização há ≥30 dias.', severity: 'low' });
    }
  }
  return alerts;
}

// ---------------------------------------------------------------------------
// CHANGE IMPACT ANALYZER
// ---------------------------------------------------------------------------

export type ChangeAction = 'disable' | 'remove' | 'rollback' | 'edit_threshold';

export interface ChangeImpact {
  target: string;
  action: ChangeAction;
  affected_items: GovernanceItem[];
  affected_consumers: string[];
  observability_loss: string[];
  estimated_risk: RiskLevel;
  reversible: boolean;
}

export function analyzeChangeImpact(
  targetId: string,
  action: ChangeAction,
  items: GovernanceItem[] = GOVERNANCE_REGISTRY,
): ChangeImpact {
  const target = REGISTRY_INDEX.get(targetId);
  if (!target) {
    return { target: targetId, action, affected_items: [], affected_consumers: [], observability_loss: [], estimated_risk: 'low', reversible: true };
  }
  const blast = computeBlastRadius(targetId, items);
  const consumers = new Set<string>();
  for (const it of [target, ...blast.impacted]) {
    it.consumers.forEach((c) => consumers.add(c));
  }
  const observabilityLoss: string[] = [];
  if (target.kind === 'telemetry_contract') observabilityLoss.push(`Perda de eventos: ${target.title}`);
  if (target.kind === 'engine') observabilityLoss.push(`Engine desligada: ${target.title}`);
  for (const dep of blast.impacted) {
    if (dep.kind === 'health_score') observabilityLoss.push(`Health score afetado: ${dep.title}`);
    if (dep.kind === 'dashboard') observabilityLoss.push(`Dashboard impactado: ${dep.title}`);
  }
  const reversible = action !== 'remove';
  // Risco: pior entre risco do alvo e do blast radius. `remove` agrava em 1.
  let risk = maxRisk(target.risk_level, blast.estimated_severity);
  if (action === 'remove') risk = bumpRisk(risk);
  return {
    target: targetId,
    action,
    affected_items: blast.impacted,
    affected_consumers: [...consumers].sort(),
    observability_loss: observabilityLoss,
    estimated_risk: risk,
    reversible,
  };
}

function bumpRisk(r: RiskLevel): RiskLevel {
  if (r === 'low') return 'medium';
  if (r === 'medium') return 'high';
  return 'critical';
}

// ---------------------------------------------------------------------------
// LIFECYCLE TRANSITIONS
// ---------------------------------------------------------------------------

/** Matriz de transições permitidas. Reversíveis quando possível. */
export const LIFECYCLE_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  experimental: ['active', 'disabled', 'archived'],
  active: ['stable', 'deprecated', 'disabled'],
  stable: ['deprecated', 'disabled'],
  deprecated: ['archived', 'disabled', 'active'],
  disabled: ['active', 'archived'],
  archived: [],
};

export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  return LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface RollbackPlan {
  item_id: string;
  current_version: string;
  target_version: string;
  bump: VersionBump;
  reversible: boolean;
  warnings: string[];
}

export function simulateRollback(itemId: string, targetVersion: string): RollbackPlan {
  const it = REGISTRY_INDEX.get(itemId);
  if (!it) return { item_id: itemId, current_version: '0.0.0', target_version: targetVersion, bump: 'none', reversible: false, warnings: ['Item desconhecido.'] };
  const bump = classifyVersionBump(targetVersion, it.version);
  const warnings: string[] = [];
  if (compareVersions(targetVersion, it.version) > 0) warnings.push('Versão alvo é mais nova que a atual.');
  if (it.lifecycle === 'archived') warnings.push('Item está arquivado — rollback não recomendado.');
  if (bump === 'major') warnings.push('Rollback major: revisar dependentes.');
  return {
    item_id: itemId,
    current_version: it.version,
    target_version: targetVersion,
    bump,
    reversible: it.lifecycle !== 'archived',
    warnings,
  };
}

// ---------------------------------------------------------------------------
// SUMMARIES / DOC ENGINE (determinístico, sem IA)
// ---------------------------------------------------------------------------

export interface GovernanceSummary {
  totals: Record<GovernanceKind, number>;
  by_lifecycle: Record<LifecycleState, number>;
  top_risk: GovernanceItem[];
  drift_count: number;
  orphan_count: number;
  notes: string[];
}

export function buildGovernanceSummary(drift: DriftAlert[], items: GovernanceItem[] = GOVERNANCE_REGISTRY): GovernanceSummary {
  const totals = items.reduce<Record<GovernanceKind, number>>((acc, it) => {
    acc[it.kind] = (acc[it.kind] || 0) + 1;
    return acc;
  }, {} as Record<GovernanceKind, number>);
  const by_lifecycle = items.reduce<Record<LifecycleState, number>>((acc, it) => {
    acc[it.lifecycle] = (acc[it.lifecycle] || 0) + 1;
    return acc;
  }, {} as Record<LifecycleState, number>);
  const top_risk = [...items]
    .filter((it) => it.risk_level === 'critical' || it.risk_level === 'high')
    .sort((a, b) => RISK_ORDER[b.risk_level] - RISK_ORDER[a.risk_level])
    .slice(0, 8);
  const orphan_count = drift.filter((d) => d.kind === 'orphan_flag' || d.kind === 'unused_rpc' || d.kind === 'unused_threshold').length;
  const notes: string[] = [];
  if (drift.length === 0) notes.push('Sem drifts detectados na janela.');
  else notes.push(`${drift.length} drifts detectados (${orphan_count} relacionados a uso).`);
  const deprecated = by_lifecycle.deprecated || 0;
  if (deprecated > 0) notes.push(`${deprecated} itens em deprecation.`);
  return { totals, by_lifecycle, top_risk, drift_count: drift.length, orphan_count, notes };
}

export interface OperationalDoc {
  title: string;
  generated_at: string;
  sections: { heading: string; bullets: string[] }[];
}

/** Gera doc operacional determinística (templated). */
export function generateOperationalDoc(items: GovernanceItem[] = GOVERNANCE_REGISTRY): OperationalDoc {
  const sections: OperationalDoc['sections'] = [];
  const groups: GovernanceKind[] = ['engine', 'health_score', 'threshold', 'feature_flag', 'heuristic', 'experiment_constraint', 'incident_rule', 'telemetry_contract', 'rpc', 'dashboard'];
  for (const g of groups) {
    const list = items.filter((it) => it.kind === g);
    if (list.length === 0) continue;
    sections.push({
      heading: g.replace(/_/g, ' '),
      bullets: list.map((it) => `${it.title} · v${it.version} · ${it.lifecycle} · risco ${it.risk_level}`),
    });
  }
  return {
    title: 'Onboarding Operational Governance — Snapshot',
    generated_at: new Date().toISOString(),
    sections,
  };
}
