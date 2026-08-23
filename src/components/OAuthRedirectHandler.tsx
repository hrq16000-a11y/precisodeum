import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from '@/lib/router-compat';
import { useAuth } from '@/hooks/useAuth';
import { resolvePostLoginRoute, shouldHandlePostLoginRedirect } from '@/lib/onboardingAccess';
import { safeInternalPath } from '@/lib/routeValidator';

/**
 * After OAuth login (Google), o fluxo sempre passa por /cadastro-inicial.
 * O próprio gate decide a saída final se o onboarding já estiver completo.
 *
 * Blindagem contra StrictMode (dev) e remontagens:
 *  - Dedupe global por `user.id` em `Set` no escopo do módulo (resiste a
 *    unmount/remount do StrictMode, ao contrário de `useRef` local).
 *  - A intenção `auth_redirect` (sessionStorage) é LIDA E REMOVIDA
 *    imediatamente, num único passo, antes de qualquer await — evita
 *    que uma segunda execução repita o redirect ou caia em loop.
 */
const handledUsers = new Set<string>();

function consumePostLoginIntent(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem('auth_redirect');
    // Limpa imediatamente: intenção é one-shot.
    window.sessionStorage.removeItem('auth_redirect');
    if (!value) return null;
    // Aceita apenas rotas internas declaradas no router (defesa contra open redirect).
    const safe = safeInternalPath(value, '');
    return safe || null;
  } catch {
    return null;
  }
}

const OAuthRedirectHandler = () => {
  const { user, profile, provider, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handledLocally = useRef(false);

  useEffect(() => {
    if (loading || handledLocally.current) return;
    if (!user || !profile) return;
    if (!shouldHandlePostLoginRedirect(location.pathname)) return;
    if (handledUsers.has(user.id)) {
      handledLocally.current = true;
      return;
    }

    handledLocally.current = true;
    handledUsers.add(user.id);

    // Consome a intenção pós-login antes de qualquer await:
    // se chamarmos depois, o StrictMode pode ler 2x.
    const explicitNext = consumePostLoginIntent();

    void (async () => {
      const resolvedRoute = await resolvePostLoginRoute({
        userId: user.id,
        profile,
        provider,
        fallbackAuthorizedRoute: explicitNext || '/dashboard',
      });

      if (location.pathname !== resolvedRoute) {
        navigate(resolvedRoute, { replace: true });
      }
    })();
  }, [user, profile, provider, loading, navigate, location.pathname]);

  return null;
};

export default OAuthRedirectHandler;
