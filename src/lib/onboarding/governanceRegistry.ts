/**
 * Onboarding Governance Registry · fonte única de governança
 *
 * Catálogo determinístico de todos os artefatos operacionais do onboarding:
 * engines, thresholds, feature flags, heurísticas, experimentos, regras de
 * incidente, health scores, contratos de telemetria.
 *
 * É o substrato para drift detection, blast radius, lifecycle e documentação
 * automática. NÃO altera runtime. NÃO modifica banco. NÃO executa ações.
 *
 * Política:
 *  - Toda mudança em engine/threshold/flag DEVE espelhar aqui (bump `version`).
 *  - `consumers` lista as superfícies que dependem do item — chave para
 *    detectar orfãos e calcular blast radius.
 *  - `lifecycle` controla visibilidade e alertas de deprecação.
 */

export type GovernanceKind =
  | 'engine'
  | 'threshold'
  | 'feature_flag'
  | 'heuristic'
  | 'experiment_constraint'
  | 'incident_rule'
  | 'health_score'
  | 'telemetry_contract'
  | 'rpc'
  | 'dashboard';

export type LifecycleState =
  | 'experimental'
  | 'active'
  | 'stable'
  | 'deprecated'
  | 'disabled'
  | 'archived';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface GovernanceItem {
  id: string;
  kind: GovernanceKind;
  title: string;
  owner: string;
  version: string;            // semver simplificado: "1.0.0"
  created_at: string;         // ISO
  updated_at: string;         // ISO
  lifecycle: LifecycleState;
  risk_level: RiskLevel;
  /** IDs de outros itens dos quais este depende. */
  dependencies: string[];
  /** Caminhos/superfícies que consomem este item (dashboards, RPCs, hooks). */
  consumers: string[];
  /** Estado de depreciação (opcional). */
  deprecation_state?: {
    since: string;            // ISO
    replacement?: string;     // id substituto
    sunset?: string;          // ISO
    notes?: string;
  };
  /** Descrição curta, determinística. */
  description: string;
  /** Tags livres para filtros. */
  tags?: string[];
}

const NOW = '2026-05-26T00:00:00Z';

/**
 * Registry estático. Atualizar SEMPRE que um engine/threshold/flag mudar.
 * Mantido pequeno e legível de propósito — não é banco, é contrato.
 */
export const GOVERNANCE_REGISTRY: GovernanceItem[] = [
  // -------------------- ENGINES --------------------
  {
    id: 'engine.regression_detector',
    kind: 'engine',
    title: 'Onboarding Regression Detector',
    owner: 'onboarding-ops',
    version: '1.0.0',
    created_at: NOW,
    updated_at: NOW,
    lifecycle: 'active',
    risk_level: 'high',
    dependencies: ['threshold.regression.min_sample', 'feature_flag.regression_watch_enabled', 'telemetry.onboarding_events'],
    consumers: ['/admin/onboarding-ops#alerts', 'cron.detect_onboarding_regressions'],
    description: 'Detecta anomalias por métrica e severidade. Sem ML.',
    tags: ['observability'],
  },
  {
    id: 'engine.auto_response',
    kind: 'engine',
    title: 'Auto-Response Engine',
    owner: 'onboarding-ops',
    version: '1.0.0',
    created_at: NOW,
    updated_at: NOW,
    lifecycle: 'active',
    risk_level: 'high',
    dependencies: ['engine.regression_detector', 'feature_flag.auto_response_enabled'],
    consumers: ['/admin/onboarding-ops#incidents'],
    description: 'Mitiga regressões automaticamente via ações seguras (não destrutivas).',
  },
  {
    id: 'engine.release_gatekeeper',
    kind: 'engine',
    title: 'Release Gatekeeper',
    owner: 'release',
    version: '1.0.0',
    created_at: NOW,
    updated_at: NOW,
    lifecycle: 'active',
    risk_level: 'high',
    dependencies: ['threshold.release.completion_drop_pp'],
    consumers: ['/admin/onboarding-ops#gatekeeper'],
    description: 'Avalia health score por release e bloqueia regressões antes do deploy.',
  },
  {
    id: 'engine.behavioral_funnel',
    kind: 'engine',
    title: 'Behavioral Funnel Intelligence',
    owner: 'product-analytics',
    version: '1.0.0',
    created_at: NOW,
    updated_at: NOW,
    lifecycle: 'active',
    risk_level: 'medium',
    dependencies: ['telemetry.behavioral_events', 'threshold.friction.hesitation_ms'],
    consumers: ['/admin/onboarding-ops#behavior'],
    description: 'Detecta hesitação, rage-click, idle, validation loops.',
  },
  {
    id: 'engine.experiment',
    kind: 'engine',
    title: 'Experiment Engine',
    owner: 'product-analytics',
    version: '1.0.0',
    created_at: NOW,
    updated_at: NOW,
    lifecycle: 'active',
    risk_level: 'medium',
    dependencies: [
      'feature_flag.experiments_enabled',
      'experiment_constraint.safe_whitelist',
      'threshold.experiment.kill_switch_completion_drop_pp',
    ],
    consumers: ['/admin/onboarding-ops#experiments', 'cron.evaluate_experiments_kill_switch'],
    description: 'A/B determinístico (FNV-1a), kill-switch heurístico.',
  },
  {
    id: 'engine.decision_intelligence',
    kind: 'engine',
    title: 'Decision Intelligence Engine',
    owner: 'onboarding-ops',
    version: '1.0.0',
    created_at: NOW,
    updated_at: NOW,
    lifecycle: 'active',
    risk_level: 'low',
    dependencies: ['engine.regression_detector', 'engine.behavioral_funnel', 'engine.experiment'],
    consumers: ['/admin/onboarding-ops#intelligence'],
    description: 'Correlaciona sinais e produz diagnósticos templated.',
  },
  {
    id: 'engine.business_impact',
    kind: 'engine',
    title: 'Business Impact Engine',
    owner: 'product-analytics',
    version: '1.0.0',
    created_at: NOW,
    updated_at: NOW,
    lifecycle: 'active',
    risk_level: 'low',
    dependencies: ['rpc.admin_onboarding_ops_funnel', 'rpc.admin_onboarding_release_compare'],
    consumers: ['/admin/onboarding-ops#executive'],
    description: 'Traduz funnel/releases em impacto de negócio heurístico.',
  },

  // -------------------- THRESHOLDS --------------------
  { id: 'threshold.regression.min_sample', kind: 'threshold', title: 'Regression Min Sample', owner: 'onboarding-ops', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'medium', dependencies: [], consumers: ['engine.regression_detector'], description: 'Mínimo de eventos por métrica para classificar regressão.' },
  { id: 'threshold.regression.debounce_hours', kind: 'threshold', title: 'Regression Debounce', owner: 'onboarding-ops', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'low', dependencies: [], consumers: ['engine.regression_detector'], description: 'Janela mínima entre duas detecções iguais (6h).' },
  { id: 'threshold.release.completion_drop_pp', kind: 'threshold', title: 'Release Completion Drop (pp)', owner: 'release', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'high', dependencies: [], consumers: ['engine.release_gatekeeper'] , description: 'Queda em pp que aciona block de release.' },
  { id: 'threshold.friction.hesitation_ms', kind: 'threshold', title: 'Hesitation Window (ms)', owner: 'product-analytics', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'low', dependencies: [], consumers: ['engine.behavioral_funnel'], description: '≥8000ms entre interações conta como hesitação.' },
  { id: 'threshold.experiment.kill_switch_completion_drop_pp', kind: 'threshold', title: 'Experiment Kill Switch (pp)', owner: 'product-analytics', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'high', dependencies: [], consumers: ['engine.experiment'], description: 'Queda em pp na variant que aciona auto-disable.' },
  { id: 'threshold.business.min_sample_for_estimate', kind: 'threshold', title: 'Business Min Sample', owner: 'product-analytics', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'low', dependencies: [], consumers: ['engine.business_impact'], description: 'Amostra mínima para estimar perda de conversão (50).' },

  // -------------------- FEATURE FLAGS --------------------
  { id: 'feature_flag.regression_watch_enabled', kind: 'feature_flag', title: 'site_settings.onboarding_regression_watch_enabled', owner: 'onboarding-ops', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'medium', dependencies: [], consumers: ['engine.regression_detector', 'cron.detect_onboarding_regressions'], description: 'Liga/desliga o cron de detecção (default OFF).' },
  { id: 'feature_flag.auto_response_enabled', kind: 'feature_flag', title: 'site_settings.onboarding_auto_response_enabled', owner: 'onboarding-ops', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'high', dependencies: [], consumers: ['engine.auto_response'], description: 'Habilita ações automáticas de mitigação.' },
  { id: 'feature_flag.experiments_enabled', kind: 'feature_flag', title: 'site_settings.onboarding_experiments_enabled', owner: 'product-analytics', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'high', dependencies: [], consumers: ['engine.experiment'], description: 'Master flag de A/B. Default OFF.' },
  { id: 'feature_flag.experiments_auto_kill_enabled', kind: 'feature_flag', title: 'site_settings.onboarding_experiments_auto_kill_enabled', owner: 'product-analytics', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'medium', dependencies: ['feature_flag.experiments_enabled'], consumers: ['cron.evaluate_experiments_kill_switch'], description: 'Liga kill-switch automático.' },

  // -------------------- HEURÍSTICAS --------------------
  { id: 'heuristic.health_weights', kind: 'heuristic', title: 'Business Health Weights', owner: 'product-analytics', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'low', dependencies: [], consumers: ['engine.business_impact'], description: '7 dimensões pesadas (completion 25, abandon 20, friction 15, release 15, recovery 10, incident 10, experiment 5).' },
  { id: 'heuristic.friction_weights', kind: 'heuristic', title: 'Friction Score Weights', owner: 'product-analytics', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'low', dependencies: [], consumers: ['engine.behavioral_funnel'], description: 'abandons=30, hesitation/rage=15, multi-submit=10.' },
  { id: 'heuristic.lead_conversion_ratio', kind: 'heuristic', title: 'Completed→Lead Ratio', owner: 'product-analytics', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'low', dependencies: [], consumers: ['engine.business_impact'], description: 'Ratio 0.35 — abstração de produto, não financeiro.' },

  // -------------------- EXPERIMENT CONSTRAINTS --------------------
  { id: 'experiment_constraint.safe_whitelist', kind: 'experiment_constraint', title: 'Safe Experiment Whitelist', owner: 'product-analytics', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'stable', risk_level: 'critical', dependencies: [], consumers: ['engine.experiment'], description: 'copy/label/helper_text/cta_wording/progress_indicator/visual_order/spacing_layout/microinteraction. Proíbe persistence/reducer/recovery/validation_core.' },

  // -------------------- INCIDENT RULES --------------------
  { id: 'incident_rule.completion_collapse', kind: 'incident_rule', title: 'Completion Collapse', owner: 'onboarding-ops', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'critical', dependencies: ['engine.regression_detector'], consumers: ['engine.auto_response'], description: 'Queda ≥15pp em 1h aciona incidente crítico.' },
  { id: 'incident_rule.hydration_break', kind: 'incident_rule', title: 'Hydration Break', owner: 'onboarding-ops', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'high', dependencies: ['engine.decision_intelligence'], consumers: ['engine.auto_response'], description: 'Spike de refresh + recovery corrupto.' },

  // -------------------- HEALTH SCORES --------------------
  { id: 'health_score.business', kind: 'health_score', title: 'Business Health Score', owner: 'product-analytics', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'low', dependencies: ['heuristic.health_weights'], consumers: ['/admin/onboarding-ops#executive'], description: 'Score 0–100 consolidado. Bandas excellent/healthy/warning/degraded/critical.' },
  { id: 'health_score.operational', kind: 'health_score', title: 'Operational Health Score', owner: 'onboarding-ops', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'low', dependencies: ['heuristic.health_weights'], consumers: ['/admin/onboarding-ops#executive'], description: 'Subset focado em fricção/recovery/incident/release.' },

  // -------------------- TELEMETRY CONTRACTS --------------------
  { id: 'telemetry.onboarding_events', kind: 'telemetry_contract', title: 'onboarding_events', owner: 'onboarding-ops', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'stable', risk_level: 'critical', dependencies: [], consumers: ['engine.regression_detector', 'engine.behavioral_funnel', 'engine.experiment', 'rpc.admin_onboarding_ops_funnel'], description: 'Tabela de eventos do wizard. meta.flow obrigatório.' },
  { id: 'telemetry.behavioral_events', kind: 'telemetry_contract', title: 'Behavioral Events Whitelist', owner: 'product-analytics', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'medium', dependencies: ['telemetry.onboarding_events'], consumers: ['engine.behavioral_funnel'], description: 'hesitation/idle_pause/rage_click/validation_repeat. Throttle 2s.' },

  // -------------------- RPCs --------------------
  { id: 'rpc.admin_onboarding_ops_funnel', kind: 'rpc', title: 'admin_onboarding_ops_funnel', owner: 'onboarding-ops', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'medium', dependencies: ['telemetry.onboarding_events'], consumers: ['/admin/onboarding-ops#funnel', 'engine.business_impact'], description: 'Agrega funil por fase, janela em horas.' },
  { id: 'rpc.admin_onboarding_release_compare', kind: 'rpc', title: 'admin_onboarding_release_compare', owner: 'release', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'medium', dependencies: ['telemetry.onboarding_events'], consumers: ['/admin/onboarding-ops#releases', 'engine.business_impact'], description: 'Compara métricas por app_version.' },
  { id: 'rpc.admin_onboarding_session_timeline', kind: 'rpc', title: 'admin_onboarding_session_timeline', owner: 'onboarding-ops', version: '1.0.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'low', dependencies: ['telemetry.onboarding_events'], consumers: ['/admin/onboarding-ops#forensics'], description: 'Timeline forense por session_id.' },

  // -------------------- DASHBOARDS --------------------
  { id: 'dashboard.onboarding_ops', kind: 'dashboard', title: '/admin/onboarding-ops', owner: 'onboarding-ops', version: '1.4.0', created_at: NOW, updated_at: NOW, lifecycle: 'active', risk_level: 'low', dependencies: ['rpc.admin_onboarding_ops_funnel', 'rpc.admin_onboarding_release_compare'], consumers: [], description: 'Central com tabs: executive/funnel/heatmap/behavior/releases/gatekeeper/forensics/alerts/incidents/experiments/intelligence/governance.' },
];

/** Lookup O(1) por id. */
export const REGISTRY_INDEX: Map<string, GovernanceItem> = new Map(
  GOVERNANCE_REGISTRY.map((it) => [it.id, it]),
);

export function getItem(id: string): GovernanceItem | undefined {
  return REGISTRY_INDEX.get(id);
}

export function listByKind(kind: GovernanceKind): GovernanceItem[] {
  return GOVERNANCE_REGISTRY.filter((it) => it.kind === kind);
}

export function listByLifecycle(state: LifecycleState): GovernanceItem[] {
  return GOVERNANCE_REGISTRY.filter((it) => it.lifecycle === state);
}
