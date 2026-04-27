import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import WizardShell from '@/components/onboarding/wizard/WizardShell';

/**
 * /cadastro-inicial — porta única do onboarding (V3 + V2 fundidos).
 *
 * Substitui /cadastro-bet e /onboarding-v2 (mantidos como redirects durante
 * a Fase A da fusão estrutural).
 */
export default function CadastroInicialPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    if (!loading && !user) {
      const next = params.get('next') || '/cadastro-inicial';
      navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
    }
  }, [loading, user, navigate, params]);

  if (loading || !user) return null;
  return <WizardShell />;
}
