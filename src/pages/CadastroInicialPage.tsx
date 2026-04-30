import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import WizardShell from '@/components/onboarding/wizard/WizardShell';
import { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';

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


export default function CadastroInicialPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const redirectedRef = useRef(false);

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
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    const nextParam =
      params.get('next') || `${location.pathname}${location.search || ''}` || '/cadastro-inicial';

    if (hasLocalDraft()) {
      toast.warning(
        'Sua sessão expirou por segurança, mas não se preocupe: salvamos seu progresso. Entre novamente para continuar de onde parou.',
        { duration: 8000 },
      );
    } else {
      toast.message('Faça login para iniciar seu cadastro. Vamos te levar de volta para cá.', {
        duration: 5000,
      });
    }

    navigate(`/login?next=${encodeURIComponent(nextParam)}`, { replace: true });
  }, [loading, authSettled, user, navigate, params, location.pathname, location.search]);

  if (loading || !authSettled || !user) return null;
  return <WizardShell />;
}
