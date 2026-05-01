import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import WizardShell from '@/components/onboarding/wizard/WizardShell';
import { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';
import { getOnboardingReviewSection, isOnboardingReviewMode } from '@/lib/onboardingAccess';

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
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const redirectedRef = useRef(false);
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
  useEffect(() => {
    if (loading) {
      setAuthSettled(false);
      return;
    }
    const t = window.setTimeout(() => setAuthSettled(true), 120);
    return () => window.clearTimeout(t);
  }, [loading]);

  // Tarefa #1: ao logar de volta, se houver rascunho salvo, avisar que o
  // progresso foi recuperado. Dispara uma vez por aba/sessão, evitando spam.
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

  useEffect(() => {
    if (loading || !authSettled) return;
    if (user) return;
    // Race-guard: ref-flag idempotente. Mesmo que o efeito reexecute por
    // mudança de params/location, só dispara navegação+toast UMA vez por mount.
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    const nextParam =
      params.get('next') || `${location.pathname}${location.search || ''}` || '/cadastro-inicial';
    const loginUrl = `/login?next=${encodeURIComponent(nextParam)}`;

    const draft = inspectLocalDraft();

    // Telemetria de expiração de sessão durante onboarding — fail-soft.
    void trackOnboardingEvent({
      phase: (draft.phase as any) || 'unknown',
      event: 'error',
      meta: {
        reason: 'session_expired_during_onboarding',
        had_draft: draft.exists,
        draft_phase: draft.phase,
        draft_age_ms: draft.savedAt ? Date.now() - draft.savedAt : null,
        next_param: nextParam,
        error_code: 'AUTH_SESSION_EXPIRED',
        error_message: 'User redirected to /login without active session',
      },
    });

    if (draft.exists) {
      // Toast com ação direta para o usuário voltar ao cadastro (link com ?next=).
      toast.warning(
        'Sua sessão expirou por segurança. Salvamos seu progresso — você tem 7 dias para retomar de onde parou.',
        {
          duration: 10000,
          action: {
            label: 'Voltar ao cadastro',
            onClick: () => navigate(loginUrl, { replace: true }),
          },
        },
      );
    } else {
      toast.message('Faça login para iniciar seu cadastro. Vamos te levar de volta para cá.', {
        duration: 5000,
      });
    }

    navigate(loginUrl, { replace: true });
  }, [loading, authSettled, user, navigate, params, location.pathname, location.search]);

  if (loading || !authSettled || !user) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Carregando cadastro"
        className="flex min-h-screen items-center justify-center bg-background"
      >
        <div className="w-full max-w-md space-y-3 px-4">
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }
  return <WizardShell reviewMode={reviewMode} reviewSection={reviewSection} />;
}
