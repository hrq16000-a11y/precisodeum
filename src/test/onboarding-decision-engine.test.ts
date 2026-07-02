/**
 * Decision Engine — testes determinísticos.
 * Cobre: correlação, prioridade, confidence, dedupe, causal chains,
 * experiment regression, mobile-only, false-positive (sample baixo),
 * ranking, suggested actions, impact estimation.
 */
import { describe, it, expect } from 'vitest';
import {
  analyzeOperationalState,
  computeGlobalOperationalScore,
  dedupeDiagnostics,
  generateForensicSummary,
  rankOperationalPriorities,
  type DecisionInput,
  type Diagnostic,
  type FunnelPhaseSignal,
} from '@/lib/onboarding/decisionEngine';

const basePhase = (overrides: Partial<FunnelPhaseSignal> = {}): FunnelPhaseSignal => ({
  phase: 'phase2_service',
  enters: 200,
  exits: 200,
  completes: 180,
  abandons: 20,
  refreshes: 5,
  recoveries: 1,
  validation_failed: 5,
  autosave_failed: 1,
  regressions: 0,
  unique_sessions: 200,
  unique_users: 180,
  median_duration_s: 30,
  ...overrides,
});

const baseInput = (overrides: Partial<DecisionInput> = {}): DecisionInput => ({
  funnel: [basePhase()],
  window_hours: 24,
  ...overrides,
});

describe('analyzeOperationalState', () => {
  it('estado saudável → nenhum diagnóstico', () => {
    expect(analyzeOperationalState(baseInput())).toEqual([]);
  });

  it('detecta hydration_break (refresh+corruption combinados)', () => {
    const out = analyzeOperationalState(
      baseInput({
        funnel: [basePhase({ refreshes: 50, recoveries: 15, unique_sessions: 200 })],
      }),
    );
    const d = out.find((x) => x.kind === 'hydration_break');
    expect(d).toBeDefined();
    expect(d?.severity).toMatch(/high|critical/);
    expect(d?.suggested_actions.length).toBeGreaterThan(0);
  });

  it('NÃO detecta hydration_break com amostra abaixo do mínimo (false-positive guard)', () => {
    const out = analyzeOperationalState(
      baseInput({
        funnel: [basePhase({ refreshes: 10, recoveries: 5, unique_sessions: 10, enters: 10 })],
      }),
    );
    expect(out.find((x) => x.kind === 'hydration_break')).toBeUndefined();
  });

  it('detecta ux_confusion combinando validation_failed alto + rage_clicks', () => {
    const out = analyzeOperationalState(
      baseInput({
        funnel: [basePhase({ validation_failed: 80, enters: 200 })],
        behavioral: [{ phase: 'phase2_service', rage_clicks: 12, hesitations: 5, repeated_validation_errors: 10, problematic_fields: ['cep', 'whatsapp'] }],
      }),
    );
    const d = out.find((x) => x.kind === 'ux_confusion');
    expect(d).toBeDefined();
    expect(d?.confidence).toBe('high'); // tem problematic_fields
    expect(d?.explanation).toContain('cep');
  });

  it('detecta friction_block por abandono alto', () => {
    const out = analyzeOperationalState(
      baseInput({ funnel: [basePhase({ enters: 200, abandons: 120, completes: 80 })] }),
    );
    const d = out.find((x) => x.kind === 'friction_block');
    expect(d).toBeDefined();
    expect(d?.severity).toBe('critical');
    expect(d?.priority).toBe('critical');
  });

  it('detecta completion_collapse com experiment running → aponta o experimento', () => {
    const out = analyzeOperationalState(
      baseInput({
        funnel: [basePhase({ enters: 300, completes: 60, abandons: 240 })],
        experiments: [{ key: 'exp_x', status: 'running', variant_count: 2, affected_phase: 'phase2_service' }],
      }),
    );
    const d = out.find((x) => x.kind === 'completion_collapse');
    expect(d).toBeDefined();
    expect(d?.suspected_root_cause).toContain('exp_x');
    expect(d?.suggested_actions[0]).toContain('exp_x');
  });

  it('detecta experiment_regression e marca priority=critical', () => {
    const out = analyzeOperationalState(
      baseInput({
        experiments: [{ key: 'cta_v2', status: 'running', variant_count: 2, completion_drop_pp: 22 }],
      }),
    );
    const d = out.find((x) => x.kind === 'experiment_regression');
    expect(d).toBeDefined();
    expect(d?.priority).toBe('critical');
    expect(d?.severity).toBe('critical');
  });

  it('detecta release_regression comparando candidato vs baseline', () => {
    const out = analyzeOperationalState(
      baseInput({
        releases: [
          { app_version: '2.4.17', release_channel: 'stable', unique_sessions: 500, completes: 400, abandons: 100, validation_failures: 10, autosave_failures: 2, completion_rate: 0.80 },
          { app_version: '2.4.18', release_channel: 'beta', unique_sessions: 200, completes: 100, abandons: 100, validation_failures: 30, autosave_failures: 5, completion_rate: 0.50 },
        ],
      }),
    );
    const d = out.find((x) => x.kind === 'release_regression');
    expect(d).toBeDefined();
    expect(d?.severity).toBe('critical');
    expect(d?.suggested_actions.some((a) => a.toLowerCase().includes('bloquear'))).toBe(true);
  });

  it('detecta mobile_degradation (assimetria mobile vs desktop)', () => {
    const out = analyzeOperationalState(
      baseInput({
        behavioral: [
          { phase: 'phase2_service', rage_clicks: 50, hesitations: 0, repeated_validation_errors: 0, device: 'mobile' },
          { phase: 'phase2_service', rage_clicks: 5, hesitations: 0, repeated_validation_errors: 0, device: 'desktop' },
        ],
      }),
    );
    expect(out.find((x) => x.kind === 'mobile_degradation')).toBeDefined();
  });

  it('NÃO detecta mobile_degradation sem dado desktop (evita falso positivo)', () => {
    const out = analyzeOperationalState(
      baseInput({
        behavioral: [
          { phase: 'phase2_service', rage_clicks: 50, hesitations: 0, repeated_validation_errors: 0, device: 'mobile' },
        ],
      }),
    );
    expect(out.find((x) => x.kind === 'mobile_degradation')).toBeUndefined();
  });

  it('detecta incident_cluster com >=3 incidents abertos', () => {
    const out = analyzeOperationalState(
      baseInput({
        incidents: [
          { id: 'i1', status: 'open', severity: 'high', category: 'x', opened_at: 't' },
          { id: 'i2', status: 'open', severity: 'critical', category: 'y', opened_at: 't' },
          { id: 'i3', status: 'open', severity: 'medium', category: 'z', opened_at: 't' },
        ],
      }),
    );
    const d = out.find((x) => x.kind === 'incident_cluster');
    expect(d).toBeDefined();
    expect(d?.severity).toBe('critical');
  });

  it('estima usuários afetados/hora a partir da janela', () => {
    const out = analyzeOperationalState(
      baseInput({
        funnel: [basePhase({ enters: 200, abandons: 120, completes: 80 })],
        window_hours: 10,
      }),
    );
    const d = out.find((x) => x.kind === 'friction_block');
    expect(d?.est_users_affected_per_hour).toBe(12); // 120/10
  });

  it('gera causal chain quando há release suspeito + hydration', () => {
    const out = analyzeOperationalState(
      baseInput({
        funnel: [basePhase({ refreshes: 50, recoveries: 15 })],
        releases: [
          { app_version: '2.5.0', release_channel: 'beta', unique_sessions: 100, completes: 30, abandons: 70, validation_failures: 5, autosave_failures: 0, completion_rate: 0.30 },
        ],
      }),
    );
    const d = out.find((x) => x.kind === 'hydration_break');
    expect(d?.causal_chain?.length).toBeGreaterThan(0);
    expect(d?.causal_chain?.[0].from).toContain('release:2.5.0');
  });
});

describe('dedupeDiagnostics', () => {
  it('mantém o de maior severity por id', () => {
    const a: Diagnostic = { id: 'x', kind: 'ux_confusion', severity: 'low', priority: 'low', confidence: 'low', affected_phases: [], suspected_root_cause: '', explanation: '', suggested_actions: [], est_users_affected_per_hour: 0, est_completion_loss_pp: 0, signals: {} };
    const b: Diagnostic = { ...a, severity: 'critical' };
    const out = dedupeDiagnostics([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe('critical');
  });
});

describe('rankOperationalPriorities', () => {
  it('critical antes de high antes de medium', () => {
    const items: Diagnostic[] = [
      { id: 'a', kind: 'ux_confusion', severity: 'medium', priority: 'medium', confidence: 'low', affected_phases: [], suspected_root_cause: '', explanation: '', suggested_actions: [], est_users_affected_per_hour: 0, est_completion_loss_pp: 1, signals: {} },
      { id: 'b', kind: 'friction_block', severity: 'critical', priority: 'critical', confidence: 'high', affected_phases: [], suspected_root_cause: '', explanation: '', suggested_actions: [], est_users_affected_per_hour: 0, est_completion_loss_pp: 30, signals: {} },
      { id: 'c', kind: 'sync_conflict', severity: 'high', priority: 'high', confidence: 'medium', affected_phases: [], suspected_root_cause: '', explanation: '', suggested_actions: [], est_users_affected_per_hour: 0, est_completion_loss_pp: 5, signals: {} },
    ];
    const out = rankOperationalPriorities(items);
    expect(out.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('generateForensicSummary', () => {
  it('agrega top abandonos, releases arriscados e campos com fricção', () => {
    const summary = generateForensicSummary(
      baseInput({
        funnel: [
          basePhase({ phase: 'p1', abandons: 50 }),
          basePhase({ phase: 'p2', abandons: 30 }),
          basePhase({ phase: 'p3', abandons: 80 }),
        ],
        behavioral: [
          { phase: 'p1', rage_clicks: 0, hesitations: 0, repeated_validation_errors: 0, problematic_fields: ['cep', 'cep', 'whatsapp'] },
        ],
      }),
    );
    expect(summary.top_abandonment_causes[0].phase).toBe('p3');
    expect(summary.most_friction_fields[0]).toBe('cep');
  });
});

describe('computeGlobalOperationalScore', () => {
  it('100 quando vazio', () => expect(computeGlobalOperationalScore([])).toBe(100));
  it('penaliza diagnósticos críticos mais que medium', () => {
    const crit: Diagnostic = { id: 'a', kind: 'ux_confusion', severity: 'critical', priority: 'critical', confidence: 'high', affected_phases: [], suspected_root_cause: '', explanation: '', suggested_actions: [], est_users_affected_per_hour: 0, est_completion_loss_pp: 0, signals: {} };
    const med: Diagnostic = { ...crit, severity: 'medium', priority: 'medium' };
    expect(computeGlobalOperationalScore([crit])).toBeLessThan(computeGlobalOperationalScore([med]));
  });
});
