/**
 * useFlowMismatchAudit — auditoria observacional de inconsistência entre
 * `profile.account_type` (DB) e `state.profile.kind` (reducer).
 *
 * PR 17 — Shell Surface Slimming. Extração 1:1 do effect que vivia no
 * `OnboardingV2Shell`. Puramente observacional:
 *   - NÃO altera state, NÃO dispara dispatch, NÃO escreve em storage.
 *   - Só emite evento `error` com `meta.kind = 'flow_mismatch'` quando os
 *     dois sinais divergem.
 *   - Dedup por sessão via fingerprint `${acc}|${kind}|${phase}` em ref.
 *
 * Mantém a fingerprint (e o `resolved_as`) idênticos ao código original —
 * dashboards do `/admin/onboarding-stats` continuam recebendo o mesmo schema.
 */
import { useEffect, useRef } from 'react';
import { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';

interface FlowMismatchAuditInput {
  /** Conteúdo bruto de `profile` (qualquer formato — lemos `.account_type`). */
  readonly profile: unknown;
  /** Kind do reducer (`'pf' | 'pj' | null | undefined`). */
  readonly profileKind: string | null | undefined;
  /** Fase atual (para contexto + fingerprint de dedup). */
  readonly phase: string;
  /** ID do usuário (opcional — passado direto na telemetria). */
  readonly userId?: string | null;
  /** Resolução final do shell (a CONDIÇÃO MESTRE: `isCompany`). */
  readonly isCompany: boolean;
}

export function useFlowMismatchAudit({
  profile,
  profileKind,
  phase,
  userId,
  isCompany,
}: FlowMismatchAuditInput): void {
  const lastFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    const acc = ((profile as any)?.account_type || '').toString().toLowerCase();
    const accIsCompany = acc === 'company' || acc === 'pj';
    const kindIsCompany = profileKind === 'pj';
    if (!acc) return; // profile ainda carregando — sem ruído
    if (accIsCompany === kindIsCompany) return; // consistente

    const fingerprint = `${acc}|${profileKind || 'null'}|${phase}`;
    if (lastFingerprintRef.current === fingerprint) return; // dedup por sessão
    lastFingerprintRef.current = fingerprint;

    void trackOnboardingEvent({
      phase: phase as any,
      event: 'error',
      userId: userId ?? undefined,
      meta: {
        flow: isCompany ? 'company' : 'default',
        kind: 'flow_mismatch',
        account_type: acc,
        profile_kind: profileKind || null,
        resolved_as: isCompany ? 'company' : 'default',
      },
    });
  }, [profile, profileKind, phase, userId, isCompany]);
}

export default useFlowMismatchAudit;
