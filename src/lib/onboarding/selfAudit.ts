/**
 * Self-Auditing Architecture & System Consistency Engine
 * --------------------------------------------------------
 * Camada PURA, READ-ONLY e DETERMINÍSTICA que audita o ecossistema
 * operacional do onboarding.
 *
 * Política de segurança (imutável):
 *  - NÃO altera runtime
 *  - NÃO executa auto-fix
 *  - NÃO modifica banco
 *  - NÃO chama RPCs
 *  - NÃO usa IA / ML
 *
 * Entradas:
 *  - GOVERNANCE_REGISTRY (fonte estática)
 *  - SelfAuditRuntimeSignals (sinais opcionais agregados pela UI)
 *
 * Saídas: findings classificados + score de debt + análise de risco.
 */

import {
  GOVERNANCE_REGISTRY,
  REGISTRY_INDEX,
  type GovernanceItem,
  type GovernanceKind,
  type LifecycleState,
  type RiskLevel,
} from './governanceRegistry';

// ────────────────────────────────────────────────────────────────────────────
// Safety policy (frozen)
// ────────────────────────────────────────────────────────────────────────────
export const SELF_AUDIT_POLICY = Object.freeze({
  allow_auto_fix: false,
  allow_auto_refactor: false,
  allow_auto_delete: false,
  allow_auto_disable: false,
  mode: 'observe_only' as const,
});

// ────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ────────────────────────────────────────────────────────────────────────────
export type AuditSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type AuditCode =
  | 'parity_break'
  | 'threshold_drift'
  | 'telemetry_mismatch'
  | 'telemetry_taxonomy_drift'
  | 'telemetry_payload_missing'
  | 'dashboard_without_data'
  | 'dashboard_missing_source'
  | 'dependency_cycle'
  | 'orphan_consumer'
  | 'dead_dependency'
  | 'stale_rule'
  | 'duplicated_heuristic'
  | 'flag_without_runtime'
  | 'experiment_without_telemetry'
  | 'rpc_without_consumer'
  | 'engine_without_test'
  | 'docs_drift'
  | 'lifecycle_drift'
  | 'owner_missing'
  | 'high_blast_radius_change';

export interface AuditFinding {
  code: AuditCode;
  severity: AuditSeverity;
  itemId: string | null;
  message: string;
  /** Sugestão determinística (NUNCA executada). */
  recommendation: string;
  /** Itens correlatos para investigação. */
  related?: string[];
}

export interface OperationalDebtScore {
  raw: number;          // soma ponderada bruta
  normalized: number;   // 0..100
  band: 'healthy' | 'accumulating' | 'degraded' | 'critical';
  contributors: Array<{ code: AuditCode; count: number; weight: number }>;
}

export interface ArchitecturalRiskScore {
  score: number;        // 0..100 (maior = pior)
  band: 'healthy' | 'attention' | 'risky' | 'critical';
  topCodes: AuditCode[];
}

export interface SelfAuditRuntimeSignals {
  /** Itens (ids do registry) com >0 execuções na janela observada. */
  usedItemIds?: ReadonlyArray<string>;
  /** Eventos de telemetria efetivamente vistos. */
  observedEvents?: ReadonlyArray<string>;
  /** Eventos esperados pelo contrato (ex.: whitelist comportamental). */
  expectedEvents?: ReadonlyArray<string>;
  /** Cards/widgets de dashboard que carregaram com dados não-vazios. */
  populatedDashboardKeys?: ReadonlyArray<string>;
  /** Cards declarados (chaves) — usado para detectar widget vazio. */
  declaredDashboardKeys?: ReadonlyArray<string>;
  /** Map TS-side thresholds (id → value). Comparado com sqlThresholds. */
  tsThresholds?: Readonly<Record<string, number>>;
  /** Map SQL-side thresholds (id → value). */
  sqlThresholds?: Readonly<Record<string, number>>;
  /** Engines TS conhecidos (id → tem suíte de teste?). */
  engineTestCoverage?: Readonly<Record<string, boolean>>;
  /** Janela observada (h). Apenas metadado. */
  windowHours?: number;
}

export interface SelfAuditReport {
  generated_at: string;
  policy: typeof SELF_AUDIT_POLICY;
  totals: { items: number; findings: number; bySeverity: Record<AuditSeverity, number> };
  findings: AuditFinding[];
  debt: OperationalDebtScore;
  risk: ArchitecturalRiskScore;
}

// ────────────────────────────────────────────────────────────────────────────
// Pesos (heurísticas explícitas, não-ML)
// ────────────────────────────────────────────────────────────────────────────
const SEVERITY_WEIGHT: Record<AuditSeverity, number> = {
  info: 0, low: 1, medium: 3, high: 7, critical: 15,
};

const CODE_WEIGHT: Partial<Record<AuditCode, number>> = {
  parity_break: 10,
  dependency_cycle: 12,
  dashboard_without_data: 4,
  dashboard_missing_source: 6,
  telemetry_mismatch: 6,
  telemetry_taxonomy_drift: 5,
  telemetry_payload_missing: 4,
  threshold_drift: 8,
  orphan_consumer: 3,
  dead_dependency: 4,
  stale_rule: 2,
  duplicated_heuristic: 3,
  flag_without_runtime: 3,
  experiment_without_telemetry: 5,
  rpc_without_consumer: 3,
  engine_without_test: 4,
  docs_drift: 1,
  lifecycle_drift: 2,
  owner_missing: 1,
  high_blast_radius_change: 6,
};

const RISK_LEVEL_MULTIPLIER: Record<RiskLevel, number> = {
  low: 1, medium: 1.5, high: 2.2, critical: 3,
};

// ────────────────────────────────────────────────────────────────────────────
// Auditorias atômicas
// ────────────────────────────────────────────────────────────────────────────

/** 1) Contract drift — itens sem owner / com lifecycle incoerente. */
export function detectContractDrift(items: ReadonlyArray<GovernanceItem> = GOVERNANCE_REGISTRY): AuditFinding[] {
  const out: AuditFinding[] = [];
  for (const it of items) {
    if (!it.owner || it.owner.trim() === '') {
      out.push({
        code: 'owner_missing', severity: 'low', itemId: it.id,
        message: `Item ${it.id} sem owner declarado.`,
        recommendation: 'Atribuir owner em GOVERNANCE_REGISTRY.',
      });
    }
    if (it.lifecycle === 'deprecated' && !it.deprecation_state) {
      out.push({
        code: 'lifecycle_drift', severity: 'medium', itemId: it.id,
        message: `Item ${it.id} marcado deprecated sem deprecation_state.`,
        recommendation: 'Preencher deprecation_state.since e replacement quando houver.',
      });
    }
    if (it.lifecycle === 'archived' && (it.consumers?.length ?? 0) > 0) {
      out.push({
        code: 'lifecycle_drift', severity: 'high', itemId: it.id,
        message: `Item arquivado ${it.id} ainda tem ${it.consumers.length} consumers.`,
        recommendation: 'Migrar consumers para substituto antes de arquivar.',
        related: it.consumers,
      });
    }
  }
  return out;
}

/** 2) Paridade SQL ↔ TS de thresholds. */
export function detectSqlTsParityBreak(
  ts: Readonly<Record<string, number>> = {},
  sql: Readonly<Record<string, number>> = {},
): AuditFinding[] {
  const out: AuditFinding[] = [];
  const keys = new Set([...Object.keys(ts), ...Object.keys(sql)]);
  for (const k of keys) {
    const a = ts[k];
    const b = sql[k];
    if (a === undefined || b === undefined) {
      out.push({
        code: 'parity_break', severity: 'high', itemId: k,
        message: `Threshold "${k}" definido apenas em ${a === undefined ? 'SQL' : 'TS'}.`,
        recommendation: 'Espelhar valor nos dois lados ou remover o lado órfão.',
      });
      continue;
    }
    if (a !== b) {
      out.push({
        code: 'threshold_drift', severity: 'high', itemId: k,
        message: `Threshold "${k}" divergente: TS=${a} vs SQL=${b}.`,
        recommendation: 'Reconciliar valor canônico e bumpar versão do item de governance.',
      });
    }
  }
  return out;
}

/** 3) Telemetry contract audit. */
export function detectTelemetryMismatch(
  observed: ReadonlyArray<string> = [],
  expected: ReadonlyArray<string> = [],
): AuditFinding[] {
  const out: AuditFinding[] = [];
  const obs = new Set(observed);
  const exp = new Set(expected);
  for (const e of exp) {
    if (!obs.has(e)) {
      out.push({
        code: 'telemetry_payload_missing', severity: 'medium', itemId: e,
        message: `Evento esperado "${e}" não foi observado.`,
        recommendation: 'Confirmar se o emissor está montado ou se renomearam o evento.',
      });
    }
  }
  for (const e of obs) {
    if (!exp.has(e)) {
      out.push({
        code: 'telemetry_taxonomy_drift', severity: 'low', itemId: e,
        message: `Evento "${e}" emitido fora do contrato whitelisted.`,
        recommendation: 'Registrar no contrato de telemetria ou remover emissão.',
      });
    }
  }
  // Naming collision: mesmo nome com variações de case
  const lower = new Map<string, string[]>();
  for (const e of [...obs, ...exp]) {
    const k = e.toLowerCase();
    const arr = lower.get(k) ?? [];
    arr.push(e);
    lower.set(k, arr);
  }
  for (const [k, arr] of lower) {
    const uniq = Array.from(new Set(arr));
    if (uniq.length > 1) {
      out.push({
        code: 'telemetry_mismatch', severity: 'medium', itemId: k,
        message: `Colisão de naming: ${uniq.join(' / ')}.`,
        recommendation: 'Padronizar para snake_case minúsculo.',
      });
    }
  }
  return out;
}

/** 4) Dashboard ↔ data-source. */
export function detectDashboardMismatch(
  declared: ReadonlyArray<string> = [],
  populated: ReadonlyArray<string> = [],
): AuditFinding[] {
  const out: AuditFinding[] = [];
  const pop = new Set(populated);
  for (const key of declared) {
    if (!pop.has(key)) {
      out.push({
        code: 'dashboard_without_data', severity: 'medium', itemId: key,
        message: `Widget "${key}" declarado mas nunca populado na janela.`,
        recommendation: 'Verificar RPC fonte / filtros / volume mínimo.',
      });
    }
  }
  // Dashboards do registry cujos consumers apontam RPC inexistente.
  for (const dash of GOVERNANCE_REGISTRY.filter((i) => i.kind === 'dashboard')) {
    for (const dep of dash.dependencies) {
      if (!REGISTRY_INDEX.has(dep)) {
        out.push({
          code: 'dashboard_missing_source', severity: 'high', itemId: dash.id,
          message: `Dashboard ${dash.id} depende de "${dep}" ausente do registry.`,
          recommendation: 'Registrar a fonte ou remover dependência morta.',
          related: [dep],
        });
      }
    }
  }
  return out;
}

/** 5) Dependency graph — ciclos + dependências mortas + orfãos. */
export function detectDependencyCycles(items: ReadonlyArray<GovernanceItem> = GOVERNANCE_REGISTRY): AuditFinding[] {
  const out: AuditFinding[] = [];
  const idx = new Map(items.map((i) => [i.id, i]));
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];

  function visit(id: string): string[] | null {
    const c = color.get(id) ?? WHITE;
    if (c === GRAY) {
      const start = stack.indexOf(id);
      return stack.slice(start >= 0 ? start : 0).concat(id);
    }
    if (c === BLACK) return null;
    color.set(id, GRAY);
    stack.push(id);
    const node = idx.get(id);
    if (node) {
      for (const dep of node.dependencies) {
        const cyc = visit(dep);
        if (cyc) return cyc;
      }
    }
    stack.pop();
    color.set(id, BLACK);
    return null;
  }

  const seen = new Set<string>();
  for (const it of items) {
    const cyc = visit(it.id);
    if (cyc) {
      const key = [...cyc].sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          code: 'dependency_cycle', severity: 'critical', itemId: it.id,
          message: `Ciclo detectado: ${cyc.join(' → ')}.`,
          recommendation: 'Quebrar dependência circular invertendo um dos vínculos.',
          related: cyc,
        });
      }
    }
  }

  // Dead dependencies (apontam para id inexistente)
  for (const it of items) {
    for (const dep of it.dependencies) {
      if (!idx.has(dep)) {
        out.push({
          code: 'dead_dependency', severity: 'medium', itemId: it.id,
          message: `Dependência morta: ${it.id} → ${dep}.`,
          recommendation: 'Remover dependência ou registrar o alvo.',
          related: [dep],
        });
      }
    }
  }

  return out;
}

/** 6) Governance consistency: flags/experiments/rpcs vs runtime. */
export function detectGovernanceInconsistency(
  signals: SelfAuditRuntimeSignals,
  items: ReadonlyArray<GovernanceItem> = GOVERNANCE_REGISTRY,
): AuditFinding[] {
  const out: AuditFinding[] = [];
  const used = new Set(signals.usedItemIds ?? []);
  for (const it of items) {
    if (it.lifecycle !== 'active' && it.lifecycle !== 'stable' && it.lifecycle !== 'experimental') continue;
    const isCandidate: GovernanceKind[] = ['feature_flag', 'experiment_constraint', 'rpc'];
    if (!isCandidate.includes(it.kind)) continue;
    if (used.size > 0 && !used.has(it.id)) {
      const code: AuditCode =
        it.kind === 'feature_flag' ? 'flag_without_runtime'
        : it.kind === 'experiment_constraint' ? 'experiment_without_telemetry'
        : 'rpc_without_consumer';
      out.push({
        code, severity: 'low', itemId: it.id,
        message: `${it.kind} ${it.id} ativo no registry, sem uso observado na janela.`,
        recommendation: 'Validar se ainda é necessário; considerar deprecated.',
      });
    }
  }
  return out;
}

/** 7) Operational debt — orfãos, stale, duplicação, engines sem teste. */
export function detectOperationalDebt(
  signals: SelfAuditRuntimeSignals,
  items: ReadonlyArray<GovernanceItem> = GOVERNANCE_REGISTRY,
): AuditFinding[] {
  const out: AuditFinding[] = [];
  const idx = new Map(items.map((i) => [i.id, i]));
  const consumersByTarget = new Map<string, string[]>();
  for (const it of items) {
    for (const dep of it.dependencies) {
      const arr = consumersByTarget.get(dep) ?? [];
      arr.push(it.id);
      consumersByTarget.set(dep, arr);
    }
  }

  for (const it of items) {
    // orphan consumer: consumers declarados mas item nunca usado
    if ((it.consumers?.length ?? 0) > 0 && signals.usedItemIds && !signals.usedItemIds.includes(it.id)) {
      out.push({
        code: 'orphan_consumer', severity: 'low', itemId: it.id,
        message: `${it.id} declara ${it.consumers.length} consumer(s) mas não foi exercitado.`,
        recommendation: 'Validar se consumers ainda dependem ou se a engine ficou inerte.',
      });
    }
    // stale rule: regra de incidente/heurística sem updates há "muito tempo"
    if ((it.kind === 'incident_rule' || it.kind === 'heuristic')) {
      const ageDays = ageInDays(it.updated_at);
      if (ageDays > 180) {
        out.push({
          code: 'stale_rule', severity: 'low', itemId: it.id,
          message: `${it.kind} ${it.id} sem atualização há ${ageDays} dias.`,
          recommendation: 'Revisar relevância e recalibrar thresholds se necessário.',
        });
      }
    }
  }

  // duplicated_heuristic: títulos repetidos entre heurísticas
  const titleMap = new Map<string, string[]>();
  for (const it of items.filter((i) => i.kind === 'heuristic')) {
    const k = it.title.trim().toLowerCase();
    const arr = titleMap.get(k) ?? [];
    arr.push(it.id);
    titleMap.set(k, arr);
  }
  for (const [t, ids] of titleMap) {
    if (ids.length > 1) {
      out.push({
        code: 'duplicated_heuristic', severity: 'medium', itemId: ids[0],
        message: `Heurísticas duplicadas com título "${t}": ${ids.join(', ')}.`,
        recommendation: 'Consolidar em uma única heurística canônica.',
        related: ids,
      });
    }
  }

  // engines sem testes
  if (signals.engineTestCoverage) {
    for (const it of items.filter((i) => i.kind === 'engine')) {
      if (signals.engineTestCoverage[it.id] === false) {
        out.push({
          code: 'engine_without_test', severity: 'medium', itemId: it.id,
          message: `Engine ${it.id} sem suíte de testes.`,
          recommendation: 'Adicionar cobertura mínima (happy/edge/safety).',
        });
      }
    }
  }

  return out;
}

/** 8) Docs drift — itens sem descrição mínima. */
export function detectDocsDrift(items: ReadonlyArray<GovernanceItem> = GOVERNANCE_REGISTRY): AuditFinding[] {
  const out: AuditFinding[] = [];
  for (const it of items) {
    if (!it.description || it.description.trim().length < 20) {
      out.push({
        code: 'docs_drift', severity: 'low', itemId: it.id,
        message: `Item ${it.id} com descrição insuficiente.`,
        recommendation: 'Escrever 1–2 frases explicando intent + escopo.',
      });
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Change Risk Analyzer
// ────────────────────────────────────────────────────────────────────────────
export interface ChangeProposal {
  kind: GovernanceKind;
  /** id do alvo já existente, OU undefined se for novo. */
  targetId?: string;
  /** Para itens novos, dependências propostas. */
  proposedDependencies?: ReadonlyArray<string>;
  /** Descrição livre — só usada na explicação. */
  intent?: string;
}

export interface ChangeRiskReport {
  proposal: ChangeProposal;
  affectedDependents: string[];   // BFS downstream do alvo
  blastRadius: number;            // |affectedDependents|
  debtPotential: AuditSeverity;
  observabilityImpact: 'none' | 'low' | 'medium' | 'high';
  notes: string[];
}

export function analyzeChangeRisk(
  proposal: ChangeProposal,
  items: ReadonlyArray<GovernanceItem> = GOVERNANCE_REGISTRY,
): ChangeRiskReport {
  const idx = new Map(items.map((i) => [i.id, i]));
  const reverse = new Map<string, string[]>();
  for (const it of items) {
    for (const dep of it.dependencies) {
      const arr = reverse.get(dep) ?? [];
      arr.push(it.id);
      reverse.set(dep, arr);
    }
  }
  const affected: string[] = [];
  const seen = new Set<string>();
  function walk(id: string) {
    for (const cons of reverse.get(id) ?? []) {
      if (seen.has(cons)) continue;
      seen.add(cons);
      affected.push(cons);
      walk(cons);
    }
  }
  if (proposal.targetId && idx.has(proposal.targetId)) walk(proposal.targetId);

  const blast = affected.length;
  const target = proposal.targetId ? idx.get(proposal.targetId) : undefined;
  const baseRisk: RiskLevel = target?.risk_level ?? 'medium';
  const mult = RISK_LEVEL_MULTIPLIER[baseRisk];
  const debtScore = blast * mult;
  const debtPotential: AuditSeverity =
    debtScore >= 30 ? 'critical'
    : debtScore >= 15 ? 'high'
    : debtScore >= 6 ? 'medium'
    : debtScore >= 2 ? 'low'
    : 'info';

  const observabilityImpact: ChangeRiskReport['observabilityImpact'] =
    proposal.kind === 'telemetry_contract' ? 'high'
    : proposal.kind === 'dashboard' ? 'medium'
    : proposal.kind === 'rpc' || proposal.kind === 'engine' ? 'medium'
    : 'low';

  const notes: string[] = [];
  if (blast >= 5) notes.push(`Blast radius alto (${blast} dependentes): coordene rollout.`);
  if (baseRisk === 'critical') notes.push('Alvo é critical — exige aprovação dupla e canary.');
  if (proposal.proposedDependencies?.some((d) => !idx.has(d))) notes.push('Proposta inclui dependências inexistentes no registry.');
  if (proposal.kind === 'threshold' || proposal.kind === 'heuristic') notes.push('Reaudite parity_break após o merge.');

  return { proposal, affectedDependents: affected, blastRadius: blast, debtPotential, observabilityImpact, notes };
}

// ────────────────────────────────────────────────────────────────────────────
// Score agregado
// ────────────────────────────────────────────────────────────────────────────
export function computeDebtScore(findings: ReadonlyArray<AuditFinding>): OperationalDebtScore {
  const contribMap = new Map<AuditCode, { count: number; weight: number }>();
  let raw = 0;
  for (const f of findings) {
    const w = (CODE_WEIGHT[f.code] ?? 1) * SEVERITY_WEIGHT[f.severity];
    raw += w;
    const ex = contribMap.get(f.code) ?? { count: 0, weight: 0 };
    ex.count += 1; ex.weight += w;
    contribMap.set(f.code, ex);
  }
  // saturação suave: 100 quando raw ≥ 200
  const normalized = Math.max(0, Math.min(100, Math.round((raw / 200) * 100)));
  const band: OperationalDebtScore['band'] =
    normalized >= 75 ? 'critical'
    : normalized >= 50 ? 'degraded'
    : normalized >= 20 ? 'accumulating'
    : 'healthy';
  const contributors = Array.from(contribMap.entries())
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.weight - a.weight);
  return { raw, normalized, band, contributors };
}

export function computeArchitecturalRisk(findings: ReadonlyArray<AuditFinding>): ArchitecturalRiskScore {
  let score = 0;
  const codeCount = new Map<AuditCode, number>();
  for (const f of findings) {
    const w = SEVERITY_WEIGHT[f.severity];
    // ciclos e parity_break pesam o dobro no risco arquitetural
    const arch = f.code === 'dependency_cycle' || f.code === 'parity_break' ? 2 : 1;
    score += w * arch;
    codeCount.set(f.code, (codeCount.get(f.code) ?? 0) + 1);
  }
  const normalized = Math.max(0, Math.min(100, Math.round((score / 150) * 100)));
  const band: ArchitecturalRiskScore['band'] =
    normalized >= 70 ? 'critical'
    : normalized >= 45 ? 'risky'
    : normalized >= 20 ? 'attention'
    : 'healthy';
  const topCodes = Array.from(codeCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
  return { score: normalized, band, topCodes };
}

// ────────────────────────────────────────────────────────────────────────────
// Orquestrador principal
// ────────────────────────────────────────────────────────────────────────────
export function auditConsistency(
  signals: SelfAuditRuntimeSignals = {},
  now: () => Date = () => new Date(),
): SelfAuditReport {
  const findings: AuditFinding[] = [
    ...detectContractDrift(),
    ...detectDependencyCycles(),
    ...detectSqlTsParityBreak(signals.tsThresholds, signals.sqlThresholds),
    ...detectTelemetryMismatch(signals.observedEvents, signals.expectedEvents),
    ...detectDashboardMismatch(signals.declaredDashboardKeys, signals.populatedDashboardKeys),
    ...detectGovernanceInconsistency(signals),
    ...detectOperationalDebt(signals),
    ...detectDocsDrift(),
  ];

  const bySeverity: Record<AuditSeverity, number> = {
    info: 0, low: 0, medium: 0, high: 0, critical: 0,
  };
  for (const f of findings) bySeverity[f.severity] += 1;

  return {
    generated_at: now().toISOString(),
    policy: SELF_AUDIT_POLICY,
    totals: { items: GOVERNANCE_REGISTRY.length, findings: findings.length, bySeverity },
    findings,
    debt: computeDebtScore(findings),
    risk: computeArchitecturalRisk(findings),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Utilitários
// ────────────────────────────────────────────────────────────────────────────
function ageInDays(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

export function explainFinding(f: AuditFinding): string {
  return `[${f.severity.toUpperCase()}] ${f.code}: ${f.message} → ${f.recommendation}`;
}

// Re-export tipos compartilhados úteis ao consumir o engine
export type { LifecycleState };
