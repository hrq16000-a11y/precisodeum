import { lazy, Suspense, useState } from 'react';
import { Briefcase, User, Users, Layout } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import LevelUpBanner from '@/components/dashboard/LevelUpBanner';
import RealtimeEngagementToast from '@/components/dashboard/RealtimeEngagementToast';
import NextStepPrompt from '@/components/dashboard/NextStepPrompt';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';
import ProgressIndicator from '@/components/motion/ProgressIndicator';
import DashboardTour from '@/components/dashboard/DashboardTour';
import DebugResetBar from '@/pages/dashboard/sections/DebugResetBar';
import SectionSkeleton from '@/pages/dashboard/sections/_skeleton';
import { hasAnyContact } from '@/lib/profileResolvers';
import { setOnboardingProgress } from '@/lib/onboardingProgressSync';
import { buildOnboardingChecklist, checklistStats } from '@/lib/onboardingChecklist';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useDashboardPermissions } from '@/hooks/dashboard/useDashboardPermissions';
import { useDashboardCounters } from '@/hooks/dashboard/useDashboardCounters';
import { useDashboardLifecycle } from '@/hooks/dashboard/useDashboardLifecycle';
import { buildProviderSectionRegistry } from '@/pages/dashboard/sections/providerSectionRegistry';

const ClientDashboardSection = lazy(() => import('@/pages/dashboard/sections/ClientDashboardSection'));
const RhDashboardSection = lazy(() => import('@/pages/dashboard/sections/RhDashboardSection'));

const DashboardPage = () => {
  const {
    user, profile, provider, loading, refetchProfile,
    isClient, isRH, profileType,
    levelName, levelColor, whatsappGroupUrl,
  } = useDashboardPermissions();

  const {
    servicesCount: servicesCountRaw,
    leadsCount, jobsCount, portfolioCount, portfolioAlbumCount,
    viewsTotal, reviewCount,
    isLoading: countersLoading, error: countersError, refetch: refetchCounters,
  } = useDashboardCounters();

  const servicesCount: number | null = countersLoading ? null : servicesCountRaw;
  const statsLoaded = !countersLoading && !countersError;
  const hasWhatsapp = hasAnyContact(provider, profile);
  const profileDone = !!provider?.description && !!provider?.city && hasWhatsapp;
  const servicesDone = servicesCount !== null && servicesCount > 0;
  const portfolioDone = portfolioCount > 0;

  const { navigate, welcomeOpen, setWelcomeOpen, handleResetOnboarding } = useDashboardLifecycle({
    user, provider: provider as unknown as { id?: string; onboarding_progress?: Record<string, any> } | null, loading, refetchProfile, refetchCounters,
    countersError, statsLoaded, profileDone, servicesDone, portfolioDone,
  });

  const providerLayout = useDashboardLayout('provider');
  const [guideOpen, setGuideOpen] = useState(true);

  const dashboardLoadingView = (
    <DashboardLayout>
      <div className="space-y-4 motion-enter-fade" data-testid="dashboard-loading">
        <ProgressIndicator label="Carregando painel" />
        <DashboardSkeleton />
      </div>
    </DashboardLayout>
  );

  if (loading) return dashboardLoadingView;
  // Onboarding redirect is owned exclusively by `OnboardingGate` in App.tsx.
  if (profile && !profileType) return dashboardLoadingView;

  const profileTypeLabel = (() => {
    switch (profile?.profile_type) {
      case 'provider': return 'Profissional';
      case 'client': return 'Cliente';
      case 'rh': return 'Agência RH';
      case 'admin': return 'Admin';
      default: return 'Não definido';
    }
  })();

  const debugBar = (
    <DebugResetBar
      profileTypeLabel={profileTypeLabel}
      onAssistant={() => navigate('/cadastro-inicial?mode=review&next=/dashboard')}
      onReset={handleResetOnboarding}
    />
  );

  // ---- CLIENT ----
  if (isClient) {
    return (
      <DashboardLayout>
        <Suspense fallback={<SectionSkeleton minH="min-h-[420px]" />}>
          <ClientDashboardSection
            fullName={profile?.full_name}
            welcomeOpen={welcomeOpen}
            onCloseWelcome={() => setWelcomeOpen(false)}
            providerSlug={provider?.slug ?? null}
            debugBar={debugBar}
          />
        </Suspense>
      </DashboardLayout>
    );
  }

  // ---- RH ----
  if (isRH) {
    return (
      <DashboardLayout>
        <Suspense fallback={<SectionSkeleton minH="min-h-[520px]" />}>
          <RhDashboardSection
            userId={user?.id}
            jobsCount={jobsCount}
            leadsCount={leadsCount}
            viewsTotal={viewsTotal}
            welcomeOpen={welcomeOpen}
            onCloseWelcome={() => setWelcomeOpen(false)}
            providerSlug={provider?.slug ?? null}
            debugBar={debugBar}
          />
        </Suspense>
      </DashboardLayout>
    );
  }

  // ---- PROVIDER ----
  const onboardingProgress = (provider?.onboarding_progress as Record<string, any>) || {};
  const pageCustomized = !!onboardingProgress.page_customized;
  const whatsappGroupJoined = !!onboardingProgress.whatsapp_group_joined;

  const markProgress = async (key: string) => {
    if (!provider?.id || onboardingProgress[key]) return;
    const result = await setOnboardingProgress(
      provider.id, { [key]: true },
      { source: `dashboard_mark_progress:${key}`, currentProgress: onboardingProgress },
    );
    if (result.ok && !result.noop) await refetchProfile();
    else if (!result.ok) console.warn('[markProgress]', key, result.errorCode);
  };

  const providerSteps = [
    { number: '1', title: 'Complete seu perfil', description: 'Adicione sua foto, descrição profissional, cidade e contato.', action: () => navigate('/dashboard/perfil'), actionLabel: 'Editar Perfil', icon: User, done: profileDone },
    { number: '2', title: 'Cadastre seus serviços', description: 'Adicione os serviços que você oferece, com imagens e descrições.', action: () => navigate('/dashboard/servicos'), actionLabel: servicesDone ? 'Meus Serviços' : 'Criar primeiro serviço', icon: Briefcase, done: servicesDone },
    { number: '3', title: 'Personalize sua página', description: 'Configure sua landing page profissional — escolha temas, cores e adicione portfólio.', action: () => navigate('/dashboard/minha-pagina'), actionLabel: pageCustomized ? 'Minha Página' : 'Personalizar agora', icon: Layout, done: pageCustomized },
    { number: '4', title: 'Entre no grupo do WhatsApp', description: 'Participe do nosso grupo exclusivo para profissionais.', action: () => { if (!whatsappGroupUrl) return; window.open(whatsappGroupUrl, '_blank'); void markProgress('whatsapp_group_joined'); }, actionLabel: whatsappGroupJoined ? 'Reabrir Grupo' : 'Entrar no Grupo', icon: Users, done: whatsappGroupJoined, hidden: !whatsappGroupUrl },
  ];

  const allStepsDone = profileDone && servicesDone && pageCustomized && (!whatsappGroupUrl || whatsappGroupJoined);

  const unifiedItems = buildOnboardingChecklist({
    profile, provider, servicesCount: servicesCount ?? 0, portfolioAlbumsCount: portfolioAlbumCount,
  });
  const unifiedStats = checklistStats(unifiedItems);
  const completenessPercent = unifiedStats.pct;
  const remainingItems = unifiedStats.total - unifiedStats.completed;
  const allChecklistDone = remainingItems === 0;
  const showServiceEmptyBanner = servicesCount !== null && servicesCount === 0;
  const showPortfolioEmptyBanner = servicesCount !== null && servicesCount > 0 && portfolioAlbumCount === 0;
  const anyEmptyBannerVisible = showServiceEmptyBanner || showPortfolioEmptyBanner;

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Boa madrugada' : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const pendingLeads = leadsCount;

  const isCompanyProvider = profile?.profile_type === 'provider' && (provider as any)?.account_type === 'company';
  const showFullAddress = !!(provider as any)?.show_full_address;

  const sectionRegistry = buildProviderSectionRegistry({
    profile, provider, greeting, pendingLeads, levelName, levelColor,
    servicesCount, portfolioCount, portfolioAlbumCount, leadsCount, viewsTotal, reviewCount,
    completenessPercent, remainingItems, allChecklistDone, anyEmptyBannerVisible,
    showServiceEmptyBanner, showPortfolioEmptyBanner,
    isCompanyProvider, showFullAddress,
    providerSteps, allStepsDone,
    guideOpen, onToggleGuide: () => setGuideOpen(!guideOpen),
  });

  return (
    <DashboardLayout>
      <div className="-mx-4 -my-6 bg-slate-50 px-4 py-6 dark:bg-background sm:-mx-6 sm:px-6">
        {countersLoading && <ProgressIndicator label="Atualizando indicadores" className="mb-3" />}
        {debugBar}
        <RealtimeEngagementToast />
        <LevelUpBanner />

        {providerLayout.orderedIds.map((id) => {
          const render = sectionRegistry[id];
          if (!render) return null;
          return <div key={id}>{render()}</div>;
        })}

        <NextStepPrompt open={welcomeOpen} onClose={() => setWelcomeOpen(false)} context="welcome" providerSlug={provider?.slug ?? null} />
        <DashboardTour />
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
