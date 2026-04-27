import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import BetModeShell from '@/components/onboarding/wizard/phases/bet/BetModeShell';

/**
 * /cadastro-bet — Cadastro V3 "Bet Mode".
 *
 * Roda em paralelo a /triagem (V1) e /onboarding-v2 (V2). Não substitui
 * nenhum dos dois. Clientes saem direto para ?next=, profissionais caem
 * no V2 para criar o 1º serviço (mantém ServiceWizard atômico).
 */
export default function CadastroBetPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    if (!loading && !user) {
      const next = params.get('next') || '/cadastro-bet';
      navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
    }
  }, [loading, user, navigate, params]);

  if (loading || !user) return null;
  return <BetModeShell />;
}
