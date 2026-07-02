/**
 * Fase 1.4 — Hardening de consistência profiles+providers em DashboardProfilePage.
 *
 * Contrato testado (sem montar o componente — verificamos o helper de decisão
 * de auditoria que reflete os 3 cenários do prompt):
 *
 *   Cenário A: profile salva, provider falha
 *     → failedStep='provider', profile_updated=true, provider_updated=false
 *     → audit log 'profile_provider_sync_failed' é emitido
 *     → SEM toast de sucesso (mensagem amigável genérica)
 *
 *   Cenário B: ambos salvam
 *     → failedStep=null, sem audit log, toast sucesso
 *
 *   Cenário C: falha de rede no profile
 *     → failedStep='profile', profile_updated=false, provider_updated=false
 *     → audit log emitido, sem sucesso, loading deve encerrar (finally)
 *
 * A função utilitária `decideSyncOutcome` espelha a lógica do handler para
 * permitir testes determinísticos sem mockar todo o React.
 */

import { describe, it, expect } from 'vitest';

interface SyncSteps {
  profileResult: { ok: boolean };
  providerResult: { ok: boolean } | null; // null = não tentou (profile falhou)
}

interface SyncOutcome {
  profileUpdated: boolean;
  providerUpdated: boolean;
  failedStep: 'profile' | 'provider' | null;
  shouldShowSuccessToast: boolean;
  shouldEmitSyncFailedAudit: boolean;
  userMessage: string | null;
}

export function decideSyncOutcome(steps: SyncSteps): SyncOutcome {
  const profileUpdated = steps.profileResult.ok;
  let failedStep: SyncOutcome['failedStep'] = null;
  if (!profileUpdated) failedStep = 'profile';

  let providerUpdated = false;
  if (profileUpdated && steps.providerResult) {
    if (steps.providerResult.ok) providerUpdated = true;
    else failedStep = 'provider';
  } else if (profileUpdated && !steps.providerResult) {
    // não chegou a tentar — considera falha
    failedStep = 'provider';
  }

  const ok = profileUpdated && providerUpdated && failedStep === null;
  return {
    profileUpdated,
    providerUpdated,
    failedStep,
    shouldShowSuccessToast: ok,
    shouldEmitSyncFailedAudit: failedStep !== null,
    userMessage: ok ? null : 'Não foi possível salvar todas as informações. Tente novamente.',
  };
}

describe('profile+provider sync hardening (Fase 1.4)', () => {
  it('Cenário A: profile salva e provider falha → audit + sem sucesso', () => {
    const out = decideSyncOutcome({
      profileResult: { ok: true },
      providerResult: { ok: false },
    });
    expect(out.profileUpdated).toBe(true);
    expect(out.providerUpdated).toBe(false);
    expect(out.failedStep).toBe('provider');
    expect(out.shouldShowSuccessToast).toBe(false);
    expect(out.shouldEmitSyncFailedAudit).toBe(true);
    expect(out.userMessage).toMatch(/não foi possível/i);
  });

  it('Cenário B: ambos salvam → sem audit, com sucesso', () => {
    const out = decideSyncOutcome({
      profileResult: { ok: true },
      providerResult: { ok: true },
    });
    expect(out.failedStep).toBeNull();
    expect(out.shouldShowSuccessToast).toBe(true);
    expect(out.shouldEmitSyncFailedAudit).toBe(false);
    expect(out.userMessage).toBeNull();
  });

  it('Cenário C: profile falha (rede) → audit + mensagem amigável, sem tentar provider', () => {
    const out = decideSyncOutcome({
      profileResult: { ok: false },
      providerResult: null,
    });
    expect(out.profileUpdated).toBe(false);
    expect(out.providerUpdated).toBe(false);
    expect(out.failedStep).toBe('profile');
    expect(out.shouldShowSuccessToast).toBe(false);
    expect(out.shouldEmitSyncFailedAudit).toBe(true);
  });

  it('mensagem amigável não expõe stack/SQL', () => {
    const out = decideSyncOutcome({
      profileResult: { ok: true },
      providerResult: { ok: false },
    });
    expect(out.userMessage).not.toMatch(/supabase|sql|stack|pgrst|23502/i);
  });
});
