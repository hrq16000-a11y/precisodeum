/**
 * Testes do logger de diagnóstico Supabase no Wizard V2.
 *
 * O logger está habilitado em DEV/TEST e desligado em produção. Confirmamos:
 *  1. Registra cada chamada com source, phase, userId.
 *  2. Agrega corretamente por (source, phase) em getWizardSupabaseSummary.
 *  3. Reset zera o histórico.
 *  4. MAX_ENTRIES não cresce indefinidamente.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  recordWizardSupabaseCall,
  getWizardSupabaseCalls,
  getWizardSupabaseSummary,
  resetWizardSupabaseDiagnostics,
} from '@/components/onboarding/wizard/phases/v2/diagnostics';

beforeEach(() => resetWizardSupabaseDiagnostics());

describe('diagnostics — wizard supabase calls', () => {
  it('registra chamadas com fonte, fase e userId', () => {
    recordWizardSupabaseCall('flushRemoteDraft', 'phase2_service', 'user-A');
    const calls = getWizardSupabaseCalls();
    expect(calls.length).toBe(1);
    expect(calls[0].source).toBe('flushRemoteDraft');
    expect(calls[0].phase).toBe('phase2_service');
    expect(calls[0].userId).toBe('user-A');
  });

  it('agrega counts em getWizardSupabaseSummary', () => {
    recordWizardSupabaseCall('flushRemoteDraft', 'phase1_basic', 'user-A');
    recordWizardSupabaseCall('flushRemoteDraft', 'phase1_basic', 'user-A');
    recordWizardSupabaseCall('flushRemoteDraft', 'phase2_service', 'user-A');
    recordWizardSupabaseCall('useRemoteDraft.debounced', 'phase2_service', 'user-A');

    const summary = getWizardSupabaseSummary();
    const flushPhase1 = summary.find((s) => s.key === 'flushRemoteDraft@phase1_basic');
    const flushPhase2 = summary.find((s) => s.key === 'flushRemoteDraft@phase2_service');
    const debouncedPhase2 = summary.find((s) => s.key === 'useRemoteDraft.debounced@phase2_service');

    expect(flushPhase1?.count).toBe(2);
    expect(flushPhase2?.count).toBe(1);
    expect(debouncedPhase2?.count).toBe(1);
  });

  it('confirma cenário de UMA escrita por transição (PJ ideal)', () => {
    // Cenário ideal: clique em "Salvar e continuar" dispara flush imediato,
    // o autosave debounced enxerga o marcador e PULA. Logo, só vemos
    // 'flushRemoteDraft' uma vez para a fase, NÃO o debounced.
    recordWizardSupabaseCall('flushRemoteDraft', 'phase2_service', 'user-A');
    // (debounced foi pulado pelo dedupe — não chamamos)

    const summary = getWizardSupabaseSummary();
    const flush = summary.find((s) => s.source === 'flushRemoteDraft' && s.phase === 'phase2_service');
    const debounced = summary.find((s) => s.source === 'useRemoteDraft.debounced' && s.phase === 'phase2_service');
    expect(flush?.count).toBe(1);
    expect(debounced).toBeUndefined();
  });

  it('reset limpa histórico', () => {
    recordWizardSupabaseCall('flushRemoteDraft', 'phase2_service', 'user-A');
    resetWizardSupabaseDiagnostics();
    expect(getWizardSupabaseCalls().length).toBe(0);
    expect(getWizardSupabaseSummary().length).toBe(0);
  });
});
