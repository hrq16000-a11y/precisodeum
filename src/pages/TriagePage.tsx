import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import SmartOnboardingWizard from '@/components/onboarding/SmartOnboardingWizard';
import { useSeoHead } from '@/hooks/useSeoHead';

/**
 * Hard Gate: rota obrigatória de triagem.
 * Usuário fica preso aqui até definir seu profile_type.
 * Sem botão de fechar, sem overlay — é a página inteira.
 */
const TriagePage = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useSeoHead({ title: 'Defina seu perfil', description: 'Escolha como você usará a plataforma.', noindex: true });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (profile?.profile_type && profile.onboarding_completed !== false) {
      const target = profile.profile_type === 'rh'
        ? '/dashboard/vagas'
        : profile.profile_type === 'sponsor'
          ? '/quero-ser-patrocinador'
          : '/dashboard';
      navigate(target, { replace: true });
    }
  }, [loading, user, profile, navigate]);

  if (loading || !user || (profile?.profile_type && profile.onboarding_completed !== false)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SmartOnboardingWizard />
    </div>
  );
};

export default TriagePage;
