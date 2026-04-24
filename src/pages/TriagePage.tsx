import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import SmartOnboardingWizard from '@/components/onboarding/SmartOnboardingWizard';
import { useSeoHead } from '@/hooks/useSeoHead';

/**
 * Hard Gate: rota obrigatória de triagem.
 * Usuário fica preso aqui até concluir os 5 passos do onboarding.
 *
 * UX:
 *  - Usuários completamente novos (sem profile_type, step 0) veem uma tela
 *    de boas-vindas de ~1.1s antes do wizard, evitando a sensação de
 *    "fui jogado direto no formulário".
 *  - Quem já tem progresso entra direto no wizard, sem fricção.
 */
const WELCOME_MS = 1100;

const TriagePage = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeDone, setWelcomeDone] = useState(false);

  useSeoHead({ title: 'Defina seu perfil', description: 'Escolha como você usará a plataforma.', noindex: true });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    const onboardingStep = Number(profile?.onboarding_step ?? 0);
    if (profile?.profile_type && profile.onboarding_completed === true && onboardingStep >= 5) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, user, profile, navigate]);

  // Decide se exibe a tela de boas-vindas — só para perfis recém-criados.
  useEffect(() => {
    if (loading || !user || welcomeDone) return;
    const onboardingStep = Number(profile?.onboarding_step ?? 0);
    const isFreshAccount = !profile?.profile_type && onboardingStep <= 1;
    if (isFreshAccount) {
      setShowWelcome(true);
      const timer = window.setTimeout(() => {
        setShowWelcome(false);
        setWelcomeDone(true);
      }, WELCOME_MS);
      return () => window.clearTimeout(timer);
    }
    setWelcomeDone(true);
  }, [loading, user, profile, welcomeDone]);

  const onboardingStep = Number(profile?.onboarding_step ?? 0);
  if (loading || !user || (profile?.profile_type && profile.onboarding_completed === true && onboardingStep >= 5)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (showWelcome) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-background via-background to-accent/5 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-lg animate-pulse">
          <Sparkles className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">Bem-vindo(a)!</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Vamos completar seu perfil em 5 passos rápidos. Tudo é salvo automaticamente.
        </p>
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
