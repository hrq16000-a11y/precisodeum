import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import OnboardingV2Shell from '@/components/onboarding/wizard/phases/v2/OnboardingV2Shell';

/**
 * Página /onboarding-v2 — fluxo refatorado em 4 fases (Progressive Disclosure).
 *
 * Roda em paralelo ao /triagem original (SmartOnboardingWizard). O gate de
 * onboarding em App.tsx continua funcionando: ao concluir a Fase 2 marcamos
 * `onboarding_completed = true` em profiles e o usuário é liberado.
 *
 * Quem ainda não está autenticado é redirecionado para /signup.
 */
const OnboardingV2Page = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/signup?next=/onboarding-v2', { replace: true });
  }, [user, loading, navigate]);

  if (loading || !user) return null;
  return <OnboardingV2Shell />;
};

export default OnboardingV2Page;
