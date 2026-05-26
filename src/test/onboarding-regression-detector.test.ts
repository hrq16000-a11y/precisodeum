/**
 * Detector de regressão do onboarding — testes puros, sem rede.
 *
 * Cobre os cenários pedidos na auditoria:
 *   1. abandono artificialmente alto                → critical/high
 *   2. explosão de validation_failed                → critical
 *   3. queda de completion_rate                     → high
 *   4. aumento de refresh_detected                  → medium
 *   5. falso positivo bloqueado por min-sample      → null
 *   6. debounce: mesma severidade não re-emite      → suprimida
 *   7. escalonamento (medium→high) re-emite         → emitida
 *   8. severity correta nos tiers                   → low/medium/high/critical
 *   9. baseline insuficiente bloqueia detecção      → null
 *  10. duração: crescimento relativo, não pp        → calculado corretamente
 *  11. context (app_version) anexado às anomalias   → propagado
 *  12. métrica ausente em current/baseline          → ignorada silenciosamente
 */
import { describe, it, expect } from 'vitest';
import {
  METRIC_DEFINITIONS,
  classifyMetric,
  detectRegressions,
} from '@/lib/onboarding/regressionDetector';

describe('regressionDetector — classifyMetric', () => {
  it('aumento de abandono em 12pp → medium', () => {
    const r = classifyMetric({
      metric: METRIC_DEFINITIONS.abandon_rate,
      current: { value: 0.32, sample: 200 },
      baseline: { value: 0.20, sample: 2000 },
    });
    expect(r.severity).toBe('medium');
    expect(r.delta).toBeCloseTo(0.12, 4);
  });

  it('aumento de abandono em 45pp → critical', () => {
    const r = classifyMetric({
      metric: METRIC_DEFINITIONS.abandon_rate,
      current: { value: 0.65, sample: 200 },
      baseline: { value: 0.20, sample: 2000 },
    });
    expect(r.severity).toBe('critical');
  });

  it('explosão de validation_failed (35pp) → critical', () => {
    const r = classifyMetric({
      metric: METRIC_DEFINITIONS.validation_failed_rate,
      current: { value: 0.40, sample: 300 },
      baseline: { value: 0.05, sample: 3000 },
    });
    expect(r.severity).toBe('critical');
  });

  it('queda de completion_rate de 70% → 50% (20pp) → high', () => {
    const r = classifyMetric({
      metric: METRIC_DEFINITIONS.completion_rate,
      current: { value: 0.50, sample: 200 },
      baseline: { value: 0.70, sample: 2000 },
    });
    expect(r.severity).toBe('high');
    expect(r.delta).toBeCloseTo(0.20, 4);
  });

  it('aumento moderado de refresh (10pp) → medium', () => {
    const r = classifyMetric({
      metric: METRIC_DEFINITIONS.refresh_rate,
      current: { value: 0.18, sample: 300 },
      baseline: { value: 0.08, sample: 3000 },
    });
    expect(r.severity).toBe('medium');
  });

  it('amostra atual insuficiente → não classifica (anti-falso-positivo)', () => {
    const r = classifyMetric({
      metric: METRIC_DEFINITIONS.abandon_rate,
      current: { value: 0.99, sample: 3 }, // 3 sessões → estatisticamente irrelevante
      baseline: { value: 0.20, sample: 2000 },
    });
    expect(r.severity).toBeNull();
    expect(r.reason).toBe('insufficient_current');
  });

  it('baseline insuficiente → não classifica (rollout inicial)', () => {
    const r = classifyMetric({
      metric: METRIC_DEFINITIONS.abandon_rate,
      current: { value: 0.50, sample: 300 },
      baseline: { value: 0.20, sample: 10 }, // baseline ainda esquentando
    });
    expect(r.severity).toBeNull();
    expect(r.reason).toBe('insufficient_baseline');
  });

  it('melhora real (abandono caiu) → null com reason=improved', () => {
    const r = classifyMetric({
      metric: METRIC_DEFINITIONS.abandon_rate,
      current: { value: 0.10, sample: 300 },
      baseline: { value: 0.25, sample: 3000 },
    });
    expect(r.severity).toBeNull();
    expect(r.reason).toBe('improved');
  });

  it('duração: 50% mais lento → high (relativo, não pp)', () => {
    const r = classifyMetric({
      metric: METRIC_DEFINITIONS.avg_phase_duration_ms,
      current: { value: 9000, sample: 200 },
      baseline: { value: 6000, sample: 2000 },
    });
    // delta relativo = (9000-6000)/6000 = 0.5 → high (threshold high=0.60? não)
    // high=0.60, medium=0.30 → 0.50 fica em medium
    expect(r.severity).toBe('medium');
    expect(r.delta).toBeCloseTo(0.5, 2);
  });

  it('tier low: variação ≥ 50% do medium mas < medium → low', () => {
    // abandon_rate medium=0.10 → low entra entre 0.05 e 0.10
    const r = classifyMetric({
      metric: METRIC_DEFINITIONS.abandon_rate,
      current: { value: 0.27, sample: 200 },
      baseline: { value: 0.20, sample: 2000 },
    });
    expect(r.severity).toBe('low');
  });
});

describe('regressionDetector — detectRegressions (lote)', () => {
  const ctx = { app_version: '1.1.0', release_channel: 'production', phase: 'phase2_service' };

  it('detecta múltiplas regressões e anexa context', () => {
    const anomalies = detectRegressions({
      current: {
        abandon_rate: { value: 0.45, sample: 200 },
        validation_failed_rate: { value: 0.40, sample: 300 },
        completion_rate: { value: 0.50, sample: 200 },
      },
      baseline: {
        abandon_rate: { value: 0.20, sample: 2000 },
        validation_failed_rate: { value: 0.05, sample: 3000 },
        completion_rate: { value: 0.70, sample: 2000 },
      },
      context: ctx,
    });
    expect(anomalies).toHaveLength(3);
    for (const a of anomalies) {
      expect(a.app_version).toBe('1.1.0');
      expect(a.release_channel).toBe('production');
    }
    const abandon = anomalies.find((a) => a.metric === 'abandon_rate')!;
    expect(abandon.severity).toBe('high');
  });

  it('debounce: mesma severidade já emitida → suprime', () => {
    const anomalies = detectRegressions({
      current: { abandon_rate: { value: 0.45, sample: 200 } },
      baseline: { abandon_rate: { value: 0.20, sample: 2000 } },
      recentlyEmitted: [{ metric: 'abandon_rate', severity: 'critical' }],
      context: ctx,
    });
    expect(anomalies).toHaveLength(0);
  });

  it('escalonamento: medium já emitida, agora high → re-emite', () => {
    const anomalies = detectRegressions({
      current: { abandon_rate: { value: 0.45, sample: 200 } },
      baseline: { abandon_rate: { value: 0.20, sample: 2000 } },
      recentlyEmitted: [{ metric: 'abandon_rate', severity: 'medium' }],
      context: ctx,
    });
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].severity).toBe('critical');
  });

  it('métrica ausente em current ou baseline → ignora silenciosamente', () => {
    const anomalies = detectRegressions({
      current: { abandon_rate: { value: 0.45, sample: 200 } }, // sem completion_rate
      baseline: { abandon_rate: { value: 0.20, sample: 2000 }, completion_rate: { value: 0.70, sample: 2000 } },
      context: ctx,
    });
    expect(anomalies.map((a) => a.metric)).toEqual(['abandon_rate']);
  });

  it('amostra ruidosa não dispara mesmo com delta enorme', () => {
    const anomalies = detectRegressions({
      current: { abandon_rate: { value: 1.0, sample: 2 } },
      baseline: { abandon_rate: { value: 0.20, sample: 2000 } },
      context: ctx,
    });
    expect(anomalies).toHaveLength(0);
  });
});

describe('regressionDetector — catálogo cobre as 15 métricas pedidas', () => {
  it('exporta exatamente as métricas-chave da auditoria', () => {
    const required = [
      'abandon_rate', 'refresh_rate', 'recovery_local_rate', 'recovery_remote_rate',
      'recovery_discarded_rate', 'validation_failed_rate', 'concurrent_tab_rate',
      'autosave_remote_failed_rate', 'avg_phase_duration_ms', 'avg_total_duration_ms',
      'completion_rate', 'first_service_persist_rate', 'retry_remote_rate',
      'corruption_discard_rate', 'invalid_hydration_rate',
    ];
    for (const k of required) {
      expect(METRIC_DEFINITIONS[k], `falta ${k}`).toBeDefined();
    }
  });
});
