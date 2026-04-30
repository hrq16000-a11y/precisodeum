import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import WizardShell from '@/components/onboarding/wizard/WizardShell';

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

const DRAFT_STORAGE_KEYS = [
  'onboarding_v2_draft_v1',
  'service_wizard_draft_v1',
  'wizard_state_v1',
] as const;

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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const redirectedRef = useRef(false);

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
