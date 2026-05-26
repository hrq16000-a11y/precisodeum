/**
 * Operational Reality Layer · tests
 *
 * Cobre detectores forensicos + scores + graph + correlação.
 */
import { describe, expect, it } from 'vitest';
import {
  buildOperationalTimeline,
  buildRealityGraph,
  buildRealityReport,
  computeFlowTrust,
  computeJourneyIntegrity,
  computeOperationalTruthScore,
  computePersistenceIntegrity,
  computeRecoveryIntegrity,
  computeSessionIntegrity,
  correlateRealitySignals,
  detectDeadNavigation,
  detectHiddenLoops,
  detectImpossibleStates,
  detectIncompleteTransactions,
  detectPartialPersistence,
  detectPersistIntegrityFailure,
  detectPhantomSuccess,
  detectRecoveryIntegrityFailure,
  detectRetryStorm,
  detectSessionFragmentation,
  detectSilentFailures,
  detectStateFragmentation,
  detectToastVsRealityMismatch,
  detectUiVsBackendDivergence,
  detectZombieDraft,
  generateForensicFindings,
  OPERATIONAL_REALITY_POLICY,
  reconstructUserJourney,
  sanitizeMeta,
  type BackendTruth,
  type ForensicEvent,
} from '@/lib/onboarding/operationalReality';

let _i = 0;
function mk(event: string, phase: string | null, opts: Partial<ForensicEvent> = {}): ForensicEvent {
  _i++;
  return {
    id: `e${_i}`,
    created_at: new Date(2026, 0, 1, 12, 0, _i).toISOString(),
    session_id: opts.session_id ?? 's1',
    user_id: opts.user_id ?? 'u1',
    phase,
    event,
    meta: opts.meta ?? null,
    app_version: opts.app_version ?? '1.0.0',
    device_id: opts.device_id ?? 'd1',
  };
}

const BACKEND_EMPTY: BackendTruth = {
  has_provider: false,
  has_service: false,
  onboarding_completed: false,
  has_draft: false,
  draft_envelope_valid: true,
};

describe('OPERATIONAL_REALITY_POLICY', () => {
  it('é frozen e somente leitura', () => {
    expect(Object.isFrozen(OPERATIONAL_REALITY_POLICY)).toBe(true);
    expect(OPERATIONAL_REALITY_POLICY.read_only).toBe(true);
    expect(OPERATIONAL_REALITY_POLICY.allow_mutation).toBe(false);
    expect(OPERATIONAL_REALITY_POLICY.allow_pii_capture).toBe(false);
  });
});

describe('sanitizeMeta', () => {
  it('remove PII e chaves suspeitas', () => {
    const out = sanitizeMeta({ email: 'a@b.com', whatsapp: '11999', count: 3, ok: true, label: 'short' });
    expect(out.email).toBeUndefined();
    expect(out.whatsapp).toBeUndefined();
    expect(out.count).toBe(3);
    expect(out.ok).toBe(true);
    expect(out.label).toBe('short');
  });
  it('descarta strings longas ou com email/telefone', () => {
    const out = sanitizeMeta({ note: 'x'.repeat(200), tag: 'maybe@x', clean: 'fast_3g' });
    expect(out.note).toBeUndefined();
    expect(out.tag).toBeUndefined();
    expect(out.clean).toBe('fast_3g');
  });
});

describe('reconstructUserJourney & buildOperationalTimeline', () => {
  it('agrega refresh/recovery/retries e detecta celebration', () => {
    const events = [
      mk('phase_enter', 'phase2_service'),
      mk('next', 'phase2_service'),
      mk('refresh', 'phase2_service'),
      mk('recovery_used', 'phase2_service'),
      mk('submit', 'phase2_photos'),
      mk('celebration', 'phase3_celebration'),
    ];
    const j = reconstructUserJourney(events);
    expect(j.total_refreshes).toBe(1);
    expect(j.total_recoveries).toBe(1);
    expect(j.total_retries).toBeGreaterThanOrEqual(2);
    expect(j.reached_celebration).toBe(true);
  });

  it('timeline tem relative_ms crescente e flags', () => {
    const tl = buildOperationalTimeline([
      mk('phase_enter', 'p1'),
      mk('recovery_corrupted', 'p1'),
      mk('refresh', 'p1'),
    ]);
    expect(tl[0].relative_ms).toBe(0);
    expect(tl[2].relative_ms).toBeGreaterThan(0);
    expect(tl[1].recovery_flags).toContain('corrupted');
    expect(tl[2].retry_flags).toContain('refresh');
  });
});

describe('detectPhantomSuccess', () => {
  it('flagra UI completion sem provider', () => {
    const j = reconstructUserJourney([mk('celebration', 'phase3_celebration')]);
    const f = detectPhantomSuccess(j, BACKEND_EMPTY);
    expect(f.some((x) => x.kind === 'phantom_success' && x.severity === 'critical')).toBe(true);
  });
});

describe('detectSilentFailures', () => {
  it('toast_success com persist_failed', () => {
    const j = reconstructUserJourney([mk('toast_success', 'p1'), mk('persist_failed', 'p1')]);
    expect(detectSilentFailures(j, BACKEND_EMPTY).length).toBeGreaterThan(0);
  });
});

describe('detectPartialPersistence', () => {
  it('provider sem service', () => {
    const out = detectPartialPersistence({ ...BACKEND_EMPTY, has_provider: true });
    expect(out.some((x) => x.kind === 'partial_persistence')).toBe(true);
  });
  it('completed sem service => impossible_state', () => {
    const out = detectPartialPersistence({ ...BACKEND_EMPTY, onboarding_completed: true });
    expect(out.some((x) => x.kind === 'impossible_state' && x.severity === 'critical')).toBe(true);
  });
});

describe('detectZombieDraft', () => {
  it('recovery_used com envelope inválido', () => {
    const j = reconstructUserJourney([mk('recovery_used', 'p1')]);
    const out = detectZombieDraft(j, { ...BACKEND_EMPTY, draft_envelope_valid: false });
    expect(out.some((x) => x.kind === 'zombie_draft')).toBe(true);
  });
});

describe('detectHiddenLoops', () => {
  it('alternância A↔B detectada', () => {
    const events = [
      mk('next', 'A'), mk('back', 'B'), mk('next', 'A'), mk('back', 'B'),
      mk('next', 'A'), mk('back', 'B'),
    ];
    const j = reconstructUserJourney(events);
    expect(detectHiddenLoops(j).length).toBeGreaterThan(0);
  });
  it('fase muito visitada vira loop high', () => {
    const events = Array.from({ length: 6 }, () => mk('next', 'A'));
    const j = reconstructUserJourney(events);
    const out = detectHiddenLoops(j);
    expect(out.some((x) => x.severity === 'high')).toBe(true);
  });
});

describe('detectRetryStorm', () => {
  it('5+ retries em janela curta', () => {
    const events = Array.from({ length: 6 }, () => mk('submit', 'p1'));
    const j = reconstructUserJourney(events);
    expect(detectRetryStorm(j).length).toBeGreaterThan(0);
  });
});

describe('detectDeadNavigation', () => {
  it('3+ next sem mudar de fase', () => {
    const events = [
      mk('phase_enter', 'p1'),
      mk('next', 'p1'), mk('next', 'p1'), mk('next', 'p1'),
    ];
    const j = reconstructUserJourney(events);
    expect(detectDeadNavigation(j).length).toBeGreaterThan(0);
  });
});

describe('detectToastVsRealityMismatch', () => {
  it('toast sem qualquer evidência operacional', () => {
    const j = reconstructUserJourney([mk('toast_success', 'p1')]);
    expect(detectToastVsRealityMismatch(j, BACKEND_EMPTY).length).toBeGreaterThan(0);
  });
});

describe('detectUiVsBackendDivergence', () => {
  it('UI completion mas backend incompleto', () => {
    const j = reconstructUserJourney([mk('completion', 'done')]);
    expect(detectUiVsBackendDivergence(j, BACKEND_EMPTY).length).toBeGreaterThan(0);
  });
});

describe('detectImpossibleStates', () => {
  it('celebration sem submit/next', () => {
    const j = reconstructUserJourney([mk('celebration', 'phase3_celebration')]);
    expect(detectImpossibleStates(j, null).some((x) => x.kind === 'impossible_state')).toBe(true);
  });
});

describe('detectSessionFragmentation', () => {
  it('múltiplos devices', () => {
    const events = [
      mk('next', 'p1', { session_id: 's1', device_id: 'd1' }),
      mk('next', 'p1', { session_id: 's2', device_id: 'd2' }),
      mk('next', 'p1', { session_id: 's3', device_id: 'd3' }),
    ];
    expect(detectSessionFragmentation(events).length).toBeGreaterThan(0);
  });
});

describe('detectRecoveryIntegrityFailure', () => {
  it('recovery_corrupted >0', () => {
    const j = reconstructUserJourney([mk('recovery_corrupted', 'p1')]);
    expect(detectRecoveryIntegrityFailure(j).length).toBeGreaterThan(0);
  });
});

describe('detectIncompleteTransactions', () => {
  it('submit sem persist/completion subsequente', () => {
    const j = reconstructUserJourney([mk('submit', 'p1')]);
    expect(detectIncompleteTransactions(j).length).toBeGreaterThan(0);
  });
});

describe('detectStateFragmentation', () => {
  it('muitas fases + refreshes', () => {
    const events = [
      mk('next', 'p1'), mk('next', 'p2'), mk('next', 'p3'),
      mk('next', 'p4'), mk('next', 'p5'), mk('next', 'p6'),
      mk('refresh', 'p6'), mk('refresh', 'p6'),
    ];
    const j = reconstructUserJourney(events);
    expect(detectStateFragmentation(j).length).toBeGreaterThan(0);
  });
});

describe('detectPersistIntegrityFailure (broken_chain)', () => {
  it('só persist_failed', () => {
    const j = reconstructUserJourney([mk('persist_failed', 'p1'), mk('persist_failed', 'p1')]);
    expect(detectPersistIntegrityFailure(j).some((x) => x.kind === 'broken_chain')).toBe(true);
  });
});

describe('scores', () => {
  it('truth score degrada com phantom + silent', () => {
    const events = [mk('toast_success', 'p1'), mk('celebration', 'phase3_celebration')];
    const { findings } = generateForensicFindings(events, BACKEND_EMPTY);
    expect(computeOperationalTruthScore(findings)).toBeLessThan(60);
  });
  it('clean journey ⇒ scores altos', () => {
    const j = reconstructUserJourney([mk('phase_enter', 'p1'), mk('next', 'p2')]);
    expect(computePersistenceIntegrity(j, null, [])).toBe(100);
    expect(computeRecoveryIntegrity(j, [])).toBe(100);
    expect(computeFlowTrust(j, [])).toBe(100);
    expect(computeSessionIntegrity(j.events, [])).toBe(100);
  });
  it('computeJourneyIntegrity agrega', () => {
    const r = buildRealityReport([mk('celebration', 'phase3_celebration')], BACKEND_EMPTY);
    const s = computeJourneyIntegrity(r);
    expect(s.operational_truth_score).toBeLessThan(100);
  });
});

describe('reality graph', () => {
  it('produz nodes/edges deterministicamente', () => {
    const j = reconstructUserJourney([mk('phase_enter', 'p1'), mk('next', 'p1'), mk('refresh', 'p1')]);
    const g = buildRealityGraph(j);
    expect(g.nodes.length).toBeGreaterThan(0);
    expect(g.edges.length).toBeGreaterThan(0);
    expect(g.edges.some((e) => e.kind === 'retry')).toBe(true);
  });
});

describe('correlateRealitySignals', () => {
  it('aponta release causal quando há finding alto e versão única', () => {
    const events = [mk('celebration', 'phase3_celebration', { app_version: '2.0.0' })];
    const r = buildRealityReport(events, BACKEND_EMPTY);
    const c = correlateRealitySignals(r.journey, r.findings, {
      active_experiments: ['exp-a'],
      open_incidents: ['inc-1'],
      runtime_drift_items: ['drift-x'],
    });
    expect(c.causal_release).toBe('2.0.0');
    expect(c.suspect_experiments).toContain('exp-a');
  });
});

describe('buildRealityReport (E2E)', () => {
  it('phantom success + zombie draft detectados em conjunto', () => {
    const events = [
      mk('recovery_used', 'phase2_service'),
      mk('toast_success', 'phase2_service'),
      mk('celebration', 'phase3_celebration'),
    ];
    const r = buildRealityReport(events, { ...BACKEND_EMPTY, draft_envelope_valid: false, has_draft: true });
    const kinds = new Set(r.findings.map((f) => f.kind));
    expect(kinds.has('phantom_success')).toBe(true);
    expect(kinds.has('zombie_draft')).toBe(true);
    expect(r.scores.operational_truth_score).toBeLessThan(70);
  });
});
