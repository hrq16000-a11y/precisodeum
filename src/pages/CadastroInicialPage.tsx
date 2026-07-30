import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import WizardShell from '@/components/onboarding/wizard/WizardShell';
import {
  detectConcurrentTab,
  forceClaimCurrentTabLeadership,
  isTabLeader,
  startTabHeartbeat,
  startTabLeaderElection,
} from '@/components/onboarding/wizard/phases/v2/crossTabSync';
import { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';
import { getOnboardingReviewSection, isOnboardingReviewMode } from '@/lib/onboardingAccess';
import { ctDebug } from '@/lib/crossTabDebug';

/**
 * /cadastro-inicial — porta única do onboarding (V3 + V2 fundidos).
 *
 * Substitui /cadastro-bet e /onboarding-v2 (mantidos como redirects durante
 * a Fase A da fusão estrutural).
 *
 * G3 (Hardening): redireciona para /login somente após o Auth ter realmente
 * estabilizado, preserva ?next=, e avisa o utilizador quando há rascunho
 * salvo para que ele saiba que o progresso não foi perdido.
 */

/**
 * Chave atual (V3 — versão de ruptura). Mantida em sincronia com
 * `useOnboardingV2Draft.ts` e `flushDraft.ts`.
 */
const CURRENT_DRAFT_KEY = 'onboarding_v3_institutional_final';

/** Chaves consideradas "draft válido" para fins de UX (avisos pós-login). */
const DRAFT_STORAGE_KEYS = [
  CURRENT_DRAFT_KEY,
  'bet_wizard_draft_v1',
] as const;

/**
 * Chaves LEGADAS de rascunho que devem ser purgadas no primeiro boot da V3.
 * Inclui prefixos para chaves dinâmicas (ex.: `service_wizard_draft_v1:<id>`).
 */
const LEGACY_DRAFT_KEYS_EXACT = [
  'onboarding_v2_draft_v1',
  'wizard_state_v1',
  'wizard-state-v1',
  'bet_draft_v1',
] as const;
const LEGACY_DRAFT_KEY_PREFIXES = [
  'service_wizard_draft_v1:',
] as const;

/** Flag idempotente — purga única por dispositivo. */
const PURGE_FLAG = 'onboarding_purge_v3_done';

/**
 * Remove rascunhos antigos uma única vez para evitar que o Reducer atual
 * tente "misturar" payloads de versões bugadas com a estrutura V3.
 * Idempotente: marca a flag e nunca mais roda nesse dispositivo.
 */
function purgeLegacyDraftsOnce(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(PURGE_FLAG) === '1') return;
    // Chaves exatas
    for (const key of LEGACY_DRAFT_KEYS_EXACT) {
      try { window.localStorage.removeItem(key); } catch { /* noop */ }
    }
    // Chaves dinâmicas (varredura única do storage)
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (LEGACY_DRAFT_KEY_PREFIXES.some((p) => k.startsWith(p))) toRemove.push(k);
    }
    for (const k of toRemove) {
      try { window.localStorage.removeItem(k); } catch { /* noop */ }
    }
    window.localStorage.setItem(PURGE_FLAG, '1');
  } catch { /* fail-soft */ }
}

function hasLocalDraft(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return DRAFT_STORAGE_KEYS.some((key) => {
      const raw = window.localStorage.getItem(key);
      return typeof raw === 'string' && raw.length > 2;
    });
  } catch {
    return false;
  }
}

/** Inspeciona o rascunho local para extrair sinais úteis para telemetria. */
function inspectLocalDraft(): { exists: boolean; phase: string | null; savedAt: number | null; key: string | null } {
  if (typeof window === 'undefined') return { exists: false, phase: null, savedAt: null, key: null };
  try {
    for (const key of DRAFT_STORAGE_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw || raw.length <= 2) continue;
      try {
        const parsed = JSON.parse(raw);
        const phase =
          (parsed && typeof parsed === 'object' && (parsed.phase || parsed?.state?.phase)) || null;
        const savedAt = (parsed && typeof parsed === 'object' && parsed.savedAt) || null;
        return { exists: true, phase: phase ? String(phase) : null, savedAt, key };
      } catch {
        return { exists: true, phase: null, savedAt: null, key };
      }
    }
    return { exists: false, phase: null, savedAt: null, key: null };
  } catch {
    return { exists: false, phase: null, savedAt: null, key: null };
  }
}


export default function CadastroInicialPage() {
  const { user, profile, loading, refetchProfile } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const reviewMode = isOnboardingReviewMode(location.search);
  const reviewSection = getOnboardingReviewSection(location.search);

  // PURGA ÚNICA das chaves antigas — roda no primeiro boot e nunca mais.
  // Garante que o reducer atual nunca tente "mesclar" payloads bugados.
  const purgedRef = useRef(false);
  if (!purgedRef.current) {
    purgedRef.current = true;
    purgeLegacyDraftsOnce();
  }

  // PRIORIDADE DE SHELL: se o perfil é PJ/empresa (account_type=company),
  // sinalizamos via sessionStorage para que o BetModeShell e o restante do
  // wizard ignorem qualquer resquício do fluxo V2 padrão e usem estritamente
  // o fluxo Institucional/Bet.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const accountType = ((profile as any)?.account_type || '').toString().toLowerCase();
    const isCompany = accountType === 'company' || accountType === 'pj';
    try {
      window.sessionStorage.setItem(
        'onboarding_current_flow',
        isCompany ? 'company' : 'default',
      );
    } catch { /* noop */ }
  }, [profile]);


  // "Settled" guard: aguarda um tick após `loading=false` para distinguir
  // o estado inicial (Auth ainda hidratando) de uma sessão de fato ausente.
  // Evita o flicker que expulsava o utilizador antes do token ser lido.
  const [authSettled, setAuthSettled] = useState(false);
  // Failsafe: se o auth não resolver em até 6s, libera o `loginRedirect`
  // declarativo (caso não haja sessão). O WizardShell já está em tela
  // desde o primeiro frame, então isto NÃO bloqueia visualmente nada —
  // apenas evita que um auth travado mantenha a rota indefinidamente
  // sem decidir entre logado/anônimo.
  useEffect(() => {
    if (loading) {
      setAuthSettled(false);
      const fail = window.setTimeout(() => setAuthSettled(true), 6000);
      return () => window.clearTimeout(fail);
    }
    const t = window.setTimeout(() => setAuthSettled(true), 60);
    return () => window.clearTimeout(t);
  }, [loading]);


  // Decisão de redirect: PURA, sem side-effects. Se o utilizador está
  // realmente sem sessão (`authSettled && !user`), montamos a URL de login
  // preservando `?next=` e renderizamos `<Navigate>` declarativo.
  const loginRedirect = useMemo(() => {
    if (loading || !authSettled || user) return null;
    const nextParam =
      params.get('next') || `${location.pathname}${location.search || ''}` || '/cadastro-inicial';
    return `/login?next=${encodeURIComponent(nextParam)}`;
  }, [loading, authSettled, user, params, location.pathname, location.search]);

  // FIX 4: prestador que JÁ concluiu o onboarding nunca pode ficar preso
  // aqui — redireciona direto para o dashboard (exceto em modo revisão
  // explícito via ?mode=review ou ?section=).
  const completedRedirect = useMemo(() => {
    if (loading || !authSettled || !user || !profile) return null;
    if (reviewMode || reviewSection) return null;
    if ((profile as any)?.onboarding_completed === true) {
      const next = params.get('next');
      return next && next.startsWith('/') ? next : '/dashboard';
    }
    return null;
  }, [loading, authSettled, user, profile, reviewMode, reviewSection, params]);

  // Side-effect ÚNICO de UX: ao logar de volta, se houver rascunho salvo,
  // avisar que o progresso foi recuperado. Dispara uma vez por aba.
  const welcomeShownRef = useRef(false);
  useEffect(() => {
    if (loading || !authSettled || !user) return;
    if (welcomeShownRef.current) return;
    let raw: string | null = null;
    try { raw = window.sessionStorage.getItem('onboarding_welcome_back_shown'); } catch { /* noop */ }
    if (raw === '1') { welcomeShownRef.current = true; return; }
    if (!hasLocalDraft()) return;
    welcomeShownRef.current = true;
    try { window.sessionStorage.setItem('onboarding_welcome_back_shown', '1'); } catch { /* noop */ }
    toast.success('Bem-vindo de volta! Recuperamos seu progresso e você continuará de onde parou.', {
      duration: 6000,
    });
  }, [loading, authSettled, user]);

  // [Self-heal] Se o auth resolveu, há sessão, mas `profile` continua nulo,
  // pode ser: (B) Perfil Nulo (trigger falhou) ou (C) RLS 403. Checa direto
  // no banco; se a linha não existir, insere perfil mínimo. Idempotente:
  // - selfHealRef impede re-execução no mesmo mount;
  // - sessionStorage flag (`SELF_HEAL_FLAG`) impede loop após reload;
  // - usa `refetchProfile()` em vez de `window.location.reload()` para
  //   re-hidratar useAuth sem reboot completo.
  const SELF_HEAL_FLAG = 'cadastro_self_heal_attempted';
  const selfHealRef = useRef(false);
  // [FIX tela branca] Quando o self-heal falha em todas as tentativas OU
  // o loop_guard impede nova tentativa e `profile` segue nulo, exibimos
  // um fallback visível em vez de renderizar o WizardShell com dados nulos
  // (que poderia quebrar silenciosamente em hooks downstream).
  const [selfHealFailed, setSelfHealFailed] = useState(false);
  const [providerStatus, setProviderStatus] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  // ─────────────────────────────────────────────────────────────────────
  // Aviso de edição concorrente entre abas.
  //
  // Regra correta: só avisar quando OUTRA aba estiver ativamente batendo
  // heartbeat recente (<7s). Antes usávamos `isTabLeader()`, que retorna
  // `false` quando NÃO existe registro de líder ainda — o que acontece
  // no boot da única aba aberta, antes do WizardShell montar e chamar
  // `startTabLeaderElection`. Isso gerava falso positivo persistente
  // com toast `duration: Infinity`.
  //
  // Correção definitiva:
  //  1. Iniciar heartbeat + leader election no PRÓPRIO page (garante que
  //     a chave de liderança existe assim que o usuário chega, sem
  //     depender do ciclo de montagem do shell).
  //  2. Mostrar o aviso somente quando `detectConcurrentTab()` for true
  //     (outra aba com heartbeat fresco) E esta aba não for líder.
  //  3. Aplicar grace period no boot (2s) para evitar flash durante a
  //     primeira escrita de heartbeat.
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const stopHeartbeat = startTabHeartbeat();
    const stopLeader = startTabLeaderElection();
    return () => {
      stopHeartbeat();
      stopLeader();
    };
  }, []);

  const [showConcurrentWarning, setShowConcurrentWarning] = useState(false);
  const [, setIsLeaderState] = useState(false);
  useEffect(() => {
    let mounted = true;
    const graceTimer = window.setTimeout(() => {
      if (!mounted) return;
      const evaluate = () => {
        if (!mounted) return;
        const concurrent = detectConcurrentTab();
        const leader = isTabLeader();
        setIsLeaderState(leader);
        setShowConcurrentWarning(concurrent && !leader);
        ctDebug('page', 'evaluate', { leader, concurrent });
      };

      evaluate();
      const id = window.setInterval(evaluate, 3000);
      (graceTimer as any)._interval = id;
    }, 2000);
    return () => {
      mounted = false;
      const id = (graceTimer as any)._interval as number | undefined;
      if (id) window.clearInterval(id);
      window.clearTimeout(graceTimer);
    };
  }, []);

  useEffect(() => {
    if (showConcurrentWarning) {
      toast.warning('Cadastro aberto em outra aba', {
        id: 'non-leader-warning',
        duration: Infinity,
        description:
          'Para evitar sobrescrever dados: 1) volte para a outra aba e continue por lá, ou 2) feche a outra aba e clique em "Assumir aqui".',
        action: {
          label: 'Assumir aqui',
          onClick: () => {
            forceClaimCurrentTabLeadership();
            setShowConcurrentWarning(false);
            toast.dismiss('non-leader-warning');
          },
        },
      });
    } else {
      toast.dismiss('non-leader-warning');
    }
  }, [showConcurrentWarning]);
  useEffect(() => {
    if (loading || !authSettled || !user) return;
    if (profile) {
      // Recuperou — limpa qualquer estado de erro residual.
      if (selfHealFailed) setSelfHealFailed(false);
      return;
    }
    if (selfHealRef.current) return;

    // Anti-loop entre reloads: se já tentamos nesta aba, não tente de novo.
    let alreadyAttempted = false;
    try { alreadyAttempted = window.sessionStorage.getItem(SELF_HEAL_FLAG) === '1'; } catch { /* noop */ }
    if (alreadyAttempted) {
      selfHealRef.current = true;
      console.error('[cadastro-inicial] perfil ausente após reload — loop guard ativo', {
        user_id: user.id,
      });
      setSelfHealFailed(true);
      void trackOnboardingEvent({
        phase: 'unknown' as any,
        event: 'error',
        meta: { reason: 'profile_self_heal_skipped_loop_guard', error_code: 'B_PROFILE_NULL_LOOP_GUARD' },
      });
      return;
    }

    selfHealRef.current = true;
    try { window.sessionStorage.setItem(SELF_HEAL_FLAG, '1'); } catch { /* noop */ }

    void (async () => {
      try {
        const { data, error, status } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (error && status === 403) {
          console.error('[cadastro-inicial] RLS 403 ao buscar perfil', {
            category: 'C_RLS_403', status, message: error.message, user_id: user.id,
          });
          setSelfHealFailed(true);
          toast.error('Não conseguimos carregar seu perfil. Faça login novamente.');
          void trackOnboardingEvent({
            phase: 'unknown' as any,
            event: 'error',
            meta: { reason: 'profile_rls_403', error_code: 'C_RLS_403', error_message: error.message },
          });
          return;
        }

        if (error) {
          console.error('[cadastro-inicial] erro ao buscar perfil', error);
          setSelfHealFailed(true);
          toast.error('Erro ao carregar seu perfil. Tente novamente.');
          return;
        }

        if (!data) {
          console.warn('[cadastro-inicial] perfil ausente — iniciando self-heal', {
            category: 'B_PROFILE_NULL', user_id: user.id,
          });

          void trackOnboardingEvent({
            phase: 'unknown' as any,
            event: 'error',
            meta: { reason: 'profile_missing_detected', error_code: 'B_PROFILE_NULL' },
          });

          const meta = (user.user_metadata || {}) as Record<string, any>;
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              full_name: meta.full_name ?? null,
              avatar_url: meta.avatar_url ?? null,
            } as any);

          void trackOnboardingEvent({
            phase: 'unknown' as any,
            event: 'error',
            meta: {
              reason: insertError ? 'profile_self_heal_failed' : 'profile_self_heal_ok',
              error_code: insertError ? 'B_PROFILE_NULL_HEAL_FAIL' : 'B_PROFILE_NULL_HEALED',
              error_message: insertError?.message ?? null,
            },
          });

          if (insertError) {
            console.error('[cadastro-inicial] falha ao criar perfil', insertError);
            setSelfHealFailed(true);
            toast.error(
              `Não conseguimos preparar sua conta: ${insertError.message}. Tente novamente em instantes.`,
              { duration: 8000 },
            );
            return;
          }

          toast.message('Configurando seu perfil...', { duration: 2000 });
          const RETRY_DELAYS = [500, 1200, 2500];
          let hydrated = false;
          for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
            try {
              const result = await refetchProfile();
              if (result) {
                hydrated = true;
                if (attempt > 0) {
                  void trackOnboardingEvent({
                    phase: 'unknown' as any,
                    event: 'error',
                    meta: {
                      reason: 'profile_refetch_recovered',
                      error_code: 'B_PROFILE_NULL_HEALED',
                      attempts: attempt + 1,
                    },
                  });
                }
                break;
              }
            } catch (refetchErr) {
              console.warn('[cadastro-inicial] refetchProfile falhou', {
                attempt: attempt + 1, error: refetchErr,
              });
            }
            if (attempt < RETRY_DELAYS.length - 1) {
              await new Promise((r) => window.setTimeout(r, RETRY_DELAYS[attempt]));
            }
          }

          if (hydrated) {
            try { window.sessionStorage.removeItem(SELF_HEAL_FLAG); } catch { /* noop */ }
          } else {
            void trackOnboardingEvent({
              phase: 'unknown' as any,
              event: 'error',
              meta: {
                reason: 'profile_refetch_exhausted',
                error_code: 'B_PROFILE_NULL_HEAL_FAIL',
                attempts: RETRY_DELAYS.length,
              },
            });
            // [FIX tela branca] Antes recarregava silenciosamente, levando
            // ao loop_guard sem feedback. Agora exibimos fallback visível
            // com botão de retry manual.
            console.error('[cadastro-inicial] esgotaram retries de refetchProfile');
            setSelfHealFailed(true);
            toast.error('Não foi possível carregar seu perfil. Use o botão para tentar de novo.');
          }
        } else {
          // Profile existe no DB mas não chegou ao contexto — só re-hidrata.
          try { await refetchProfile(); } catch (e) {
            console.warn('[cadastro-inicial] refetchProfile pós-existência falhou', e);
          }
        }
      } catch (err) {
        console.error('[cadastro-inicial] erro inesperado no self-heal', err);
        setSelfHealFailed(true);
        toast.error('Ocorreu um erro inesperado. Tente recarregar a página.');
      }
    })();
  }, [loading, authSettled, user, profile, refetchProfile]);

  // Verificação de provider existente + ativo — evita reabrir wizard
  // para prestadores que já completaram cadastro.
  useEffect(() => {
    if (loading || !authSettled || !user) return;
    // Loop-guard / self-heal failure: não tocamos no banco — vamos renderizar
    // o fallback de erro e queremos isolamento total de side-effects.
    if (selfHealFailed) return;
    // Sem profile (ainda hidratando ou self-heal em curso) → adia para evitar
    // queries fantasma após early-return da self-heal.
    if (!profile) return;
    setStatusLoading(true);
    void (async () => {
      try {
        const result = await supabase
          .from('providers')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!result) return;
        const { data, error } = result;
        if (!error && data?.status) {
          setProviderStatus(data.status);
        }
      } finally {
        setStatusLoading(false);
      }
    })();
  }, [loading, authSettled, user, profile, selfHealFailed]);

  // Side-effect ÚNICO de telemetria/toast quando vamos redirecionar para
  // /login. NÃO navega (a navegação é declarativa via `<Navigate>` abaixo).
  // Idempotente por mount — só roda uma vez mesmo com re-renders.
  const sessionExpiredHandledRef = useRef(false);
  useEffect(() => {
    if (!loginRedirect) return;
    if (sessionExpiredHandledRef.current) return;
    sessionExpiredHandledRef.current = true;

    const draft = inspectLocalDraft();
    void trackOnboardingEvent({
      phase: (draft.phase as any) || 'unknown',
      event: 'error',
      meta: {
        reason: 'session_expired_during_onboarding',
        had_draft: draft.exists,
        draft_phase: draft.phase,
        draft_age_ms: draft.savedAt ? Date.now() - draft.savedAt : null,
        next_param: new URL(loginRedirect, window.location.origin).searchParams.get('next'),
        error_code: 'AUTH_SESSION_EXPIRED',
        error_message: 'User redirected to /login without active session',
      },
    });

    if (draft.exists) {
      // FIX 4: removida a promessa fictícia de "7 dias" (sem TTL real
      // implementado). Mensagem agora é honesta sobre o que sabemos.
      toast.warning(
        'Sua sessão expirou por segurança. Salvamos seu progresso para você retomar de onde parou.',
        { duration: 10000 },
      );
    } else {
      toast.message('Faça login para iniciar seu cadastro. Vamos te levar de volta para cá.', {
        duration: 5000,
      });
    }
  }, [loginRedirect]);

  if (loginRedirect) {
    return <Navigate to={loginRedirect} replace />;
  }

  // FIX 4: prestador com onboarding concluído nunca vê o wizard.
  if (completedRedirect) {
    return <Navigate to={completedRedirect} replace />;
  }

  // [FIX entrada instantânea] Removido skeleton bloqueante de auth.
  // O WizardShell monta IMEDIATAMENTE no primeiro frame — as fases de
  // preenchimento não dependem de user/profile. Quando o useAuth resolver
  // (loading → false), o Shell hidrata via props/context naturalmente.
  // Se o usuário não tiver sessão após `authSettled`, o `loginRedirect`
  // acima já dispara <Navigate> declarativamente.
  // [FIX tela branca] Auth está OK mas o perfil não foi carregado/criado.
  // Em vez de renderizar o WizardShell com profile=null (que pode quebrar
  // silenciosamente), exibe fallback explícito com retry manual.
  if (selfHealFailed && !profile) {
    return (
      <div
        role="alert"
        className="flex min-h-screen items-center justify-center bg-background px-4"
      >
        <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">
            Não conseguimos preparar seu cadastro
          </h1>
          <p className="text-sm text-muted-foreground">
            Houve uma falha temporária ao carregar seu perfil. Você pode tentar
            novamente agora ou voltar para a página inicial.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => {
                try { window.sessionStorage.removeItem('cadastro_self_heal_attempted'); } catch { /* noop */ }
                window.location.reload();
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              data-testid="cadastro-retry-button"
            >
              Tentar novamente
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Voltar ao início
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Prestador já ativo e NÃO em modo revisão → redireciona para dashboard.
  if (!statusLoading && providerStatus === 'active' && !reviewMode) {
    const otherParams = new URLSearchParams(params);
    otherParams.delete('mode');
    const qs = otherParams.toString();
    return <Navigate to={`/dashboard${qs ? '?' + qs : ''}`} replace />;
  }

  return <WizardShell mode={reviewMode ? 'edit_profile' : 'new_signup'} reviewSection={reviewSection} />;
}
