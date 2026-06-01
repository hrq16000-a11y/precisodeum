import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CELEBRATION_IDS, celebrate } from '@/lib/celebrate';
import { supabase } from '@/integrations/supabase/client';
import {
  startDashboardTimers,
  reportFirstRender,
  attachBlockedClickProbe,
} from '@/lib/dashboardTelemetry';
import { setOnboardingProgress } from '@/lib/onboardingProgressSync';
import { useDashboardState } from '@/hooks/useDashboardState';
import { useMaturityTier } from '@/hooks/useMaturityTier';
import { useFirstContactAutoMission } from '@/hooks/useFirstContactAutoMission';
import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat';
import { useProviderActivityHeartbeat } from '@/hooks/useProviderActivityHeartbeat';
import { useLeadInteractionPing } from '@/hooks/useLeadInteractionPing';
import { usePwaMission } from '@/hooks/usePwaMission';
import { useReferralCapture } from '@/hooks/useReferralCapture';

interface UseDashboardLifecycleArgs {
  user: { id?: string } | null | undefined;
  provider: { id?: string; onboarding_progress?: Record<string, any> } | null | undefined;
  loading: boolean;
  refetchProfile: () => Promise<unknown> | unknown;
  refetchCounters: () => unknown;
  countersError: unknown;
  statsLoaded: boolean;
  profileDone: boolean;
  servicesDone: boolean;
  portfolioDone: boolean;
}

/**
 * useDashboardLifecycle
 * ---------------------
 * Concentra todos os side-effects do `DashboardPage`:
 * - Telemetria (timers, primeiro render, probe de cliques bloqueados)
 * - Heartbeats (presença, atividade do prestador, lead interaction ping)
 * - Missões automáticas (first_contact, PWA install)
 * - Captura de referral pós-login
 * - Registro de visita no servidor + funil exit-intent
 * - Redirect para /login quando sem sessão
 * - Celebração de welcome via ?welcome=1
 * - Toast de erro de contadores
 * - Refetch de contadores em focus/visibility/onboarding-progress
 * - Persistência de `onboarding_progress` quando steps completam
 * - Handler de "Reiniciar assistente"
 *
 * NÃO altera nenhuma lógica — apenas move o que já existia em
 * `DashboardPage.tsx` para um lugar testável e reutilizável.
 */
export function useDashboardLifecycle({
  user,
  provider,
  loading,
  refetchProfile,
  refetchCounters,
  countersError,
  statsLoaded,
  profileDone,
  servicesDone,
  portfolioDone,
}: UseDashboardLifecycleArgs) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  const { registerVisit } = useDashboardState();
  useMaturityTier();
  useFirstContactAutoMission();
  usePresenceHeartbeat(user?.id, !!provider?.id);
  useProviderActivityHeartbeat(user?.id);
  useLeadInteractionPing();
  usePwaMission(user?.id, provider?.id);
  useReferralCapture(user?.id);

  // ─── Telemetria: timers + primeiro render + probe de clique bloqueado ─────
  useEffect(() => {
    const stopTimers = startDashboardTimers();
    const detachProbe = attachBlockedClickProbe();
    return () => {
      stopTimers();
      detachProbe();
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      reportFirstRender({ has_provider: !!provider?.id });
    }
  }, [loading, provider?.id]);

  // ─── Registra visita + funil exit-intent ──────────────────────────────────
  useEffect(() => {
    if (user?.id) {
      void registerVisit();
      void import('@/lib/exitIntentTelemetry').then((m) =>
        m.maybeTrackPostSignupConversion(user.id!),
      );
    }
  }, [user?.id, registerVisit]);

  // ─── Welcome celebration ──────────────────────────────────────────────────
  useEffect(() => {
    if (searchParams.get('welcome') !== '1') return;
    if (!provider || !statsLoaded) return;
    setWelcomeOpen(true);
    celebrate({ intensity: 'big', id: CELEBRATION_IDS.welcomeOnboarding(user?.id) });
    const params = new URLSearchParams(searchParams);
    params.delete('welcome');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams, user?.id, provider, statsLoaded]);

  // ─── Redirect para /login quando sem sessão ───────────────────────────────
  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => navigate('/login', { replace: true }), 200);
      return () => clearTimeout(timer);
    }
  }, [loading, user, navigate]);

  // ─── Toast de erro de contadores ──────────────────────────────────────────
  useEffect(() => {
    if (!countersError) return;
    toast.error('Não foi possível carregar suas estatísticas', {
      description: 'Verifique sua conexão e tente novamente.',
      action: { label: 'Recarregar', onClick: () => refetchCounters() },
      duration: 10000,
    });
  }, [countersError, refetchCounters]);

  // ─── Refetch contadores em focus / visibility / onboarding-progress ───────
  useEffect(() => {
    const trigger = () => refetchCounters();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') trigger();
    };
    window.addEventListener('focus', trigger);
    document.addEventListener('visibilitychange', onVisibility);
    const onProgress = () => trigger();
    window.addEventListener('onboarding-progress-changed', onProgress);
    return () => {
      window.removeEventListener('focus', trigger);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('onboarding-progress-changed', onProgress);
    };
  }, [refetchCounters]);

  // ─── Persist onboarding_progress quando steps completam ───────────────────
  useEffect(() => {
    if (!provider?.id) return;
    const current = (provider?.onboarding_progress as Record<string, boolean>) || {};
    const updates: Record<string, boolean> = {};
    if (profileDone && !current.profile) updates.profile = true;
    if (servicesDone && !current.services) updates.services = true;
    if (portfolioDone && !current.portfolio) updates.portfolio = true;
    const allDone = profileDone && servicesDone && portfolioDone;
    if (allDone && !current.completed) updates.completed = true;

    if (Object.keys(updates).length === 0) return;

    void setOnboardingProgress(provider.id, updates, {
      source: 'dashboard_page_step_complete',
      currentProgress: current,
    });
  }, [provider?.id, profileDone, servicesDone, portfolioDone]);

  // ─── Handler: reiniciar assistente ────────────────────────────────────────
  const handleResetOnboarding = useCallback(async () => {
    if (!user?.id) return;
    if (
      !window.confirm(
        'Reiniciar o assistente? Seus dados (nome, telefone, cidade) serão preservados.',
      )
    )
      return;
    try {
      const [{ error: profErr }, { error: metaErr }] = await Promise.all([
        supabase
          .from('profiles')
          .update({
            profile_type: null,
            role: null,
            onboarding_completed: false,
          } as any)
          .eq('id', user.id),
        supabase.auth.updateUser({
          data: { profile_type_chosen: false, profile_type: null },
        }),
      ]);
      if (profErr || metaErr) throw profErr || metaErr;
      try {
        const keysToRemove = [
          'onboarding_wizard_state',
          'pending_referral_code',
          'auth_redirect',
          'pending_signup_profile_type',
        ];
        keysToRemove.forEach((k) => {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        });
        Object.keys(localStorage)
          .filter((k) => k.startsWith('onboarding_') || k.startsWith('wizard_'))
          .forEach((k) => localStorage.removeItem(k));
        Object.keys(sessionStorage)
          .filter(
            (k) =>
              k.startsWith('onboarding_') ||
              k.startsWith('wizard_') ||
              k.startsWith('pending_'),
          )
          .forEach((k) => sessionStorage.removeItem(k));
      } catch {
        /* storage may be unavailable */
      }
      await refetchProfile();
      toast.success('Assistente reiniciado. Recarregando...');
      setTimeout(() => (window.location.href = '/dashboard'), 600);
    } catch (e) {
      console.error('[Reset Onboarding]', e);
      toast.error('Não foi possível reiniciar o cadastro.');
    }
  }, [user?.id, refetchProfile]);

  return {
    navigate,
    welcomeOpen,
    setWelcomeOpen,
    handleResetOnboarding,
  };
}
