import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NextStepPrompt from '@/components/dashboard/NextStepPrompt';
import { CELEBRATION_IDS, celebrate } from '@/lib/celebrate';
import DashboardLayout from '@/components/DashboardLayout';
import { Briefcase, User, Users, Layout } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import { hasAnyContact } from '@/lib/profileResolvers';
import LevelUpBanner from '@/components/dashboard/LevelUpBanner';
import WelcomeHero from '@/components/dashboard/WelcomeHero';
import QuickStatsBar from '@/components/dashboard/QuickStatsBar';
// StatCardGrid removido: agora vive em /dashboard/metricas
import DashboardTipOfDay from '@/components/dashboard/DashboardTipOfDay';
import LevelBenefits from '@/components/dashboard/LevelBenefits';
import ShareProfileCard from '@/components/dashboard/ShareProfileCard';
import RealtimeEngagementToast from '@/components/dashboard/RealtimeEngagementToast';
import QrCodeCard from '@/components/dashboard/QrCodeCard';
import { usePermissions } from '@/hooks/usePermissions';
import { useEngagementLevel } from '@/hooks/useEngagementLevel';
import GlassCard from '@/components/ui/GlassCard';
import ActionQueue from '@/components/dashboard/ActionQueue';
import CoursesBanner from '@/components/dashboard/CoursesBanner';
import OurStoryBanner from '@/components/OurStoryBanner';
import StorageQuotaWidget from '@/components/dashboard/StorageQuotaWidget';
import FirstLeadChecklist from '@/components/dashboard/FirstLeadChecklist';
import ProfileLocationChecklist from '@/components/dashboard/ProfileLocationChecklist';
import IncompleteLocationAlert from '@/components/dashboard/IncompleteLocationAlert';
import SmartNextStepCTA from '@/components/dashboard/SmartNextStepCTA';
import OnboardingCompletionTracker from '@/components/dashboard/OnboardingCompletionTracker';
import LeadFollowupWidget from '@/components/dashboard/LeadFollowupWidget';
import EmptyStateBanner from '@/components/dashboard/EmptyStateBanner';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';
import { buildOnboardingChecklist, checklistStats } from '@/lib/onboardingChecklist';
import CommunityVerifiedStatus from '@/components/dashboard/CommunityVerifiedStatus';
// DashboardAnalytics + AdPerformanceWidget movidos para /dashboard/metricas
import { useProviderActivityHeartbeat } from '@/hooks/useProviderActivityHeartbeat';
import { useProviderCounters } from '@/hooks/useProviderCounters';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useLeadInteractionPing } from '@/hooks/useLeadInteractionPing';
import ServiceCompletionCard from '@/components/dashboard/ServiceCompletionCard';
import DailyPostCard from '@/components/dashboard/DailyPostCard';
import MissedOpportunitiesWidget from '@/components/dashboard/MissedOpportunitiesWidget';
import ReferralInviteCard from '@/components/dashboard/ReferralInviteCard';
import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat';
import { useReferralCapture } from '@/hooks/useReferralCapture';
import EngagementLoop from '@/components/dashboard/EngagementLoop';
import ExpertTipsWidget from '@/components/dashboard/ExpertTipsWidget';
import DismissibleWidget from '@/components/dashboard/DismissibleWidget';
import MissionCard from '@/components/dashboard/MissionCard';
// ContactImpactWidget movido para /dashboard/metricas
import MetricsPreviewCard from '@/components/dashboard/MetricsPreviewCard';
import OnlineStatusFeedback from '@/components/dashboard/OnlineStatusFeedback';
import OnlineStatusToggle from '@/components/dashboard/OnlineStatusToggle';
import DashboardPwaInstallNudge from '@/components/dashboard/DashboardPwaInstallNudge';
import { usePwaMission } from '@/hooks/usePwaMission';
import IdentitySuggestionsWidget from '@/components/dashboard/IdentitySuggestionsWidget';
import DashboardTour from '@/components/dashboard/DashboardTour';
import { useDashboardState } from '@/hooks/useDashboardState';
import { useMaturityTier } from '@/hooks/useMaturityTier';
import { useFirstContactAutoMission } from '@/hooks/useFirstContactAutoMission';
import UnifiedHealthScore from '@/components/dashboard/UnifiedHealthScore';
import QuickActionsHero from '@/components/dashboard/QuickActionsHero';
// ImpactSection movido para /dashboard/metricas
import { resolveEffectiveProfileType } from '@/lib/onboardingAccess';
import { setOnboardingProgress } from '@/lib/onboardingProgressSync';
import {
  startDashboardTimers,
  reportFirstRender,
  attachBlockedClickProbe,
} from '@/lib/dashboardTelemetry';

// ─── Sections síncronas (acima da dobra ou utilitárias leves) ──────────────
import DebugResetBar from '@/pages/dashboard/sections/DebugResetBar';
import SectionSkeleton from '@/pages/dashboard/sections/_skeleton';

// ─── Sections lazy (abaixo da dobra ou condicionais) ───────────────────────
// A7 — Code-split estratégico: cada chunk só baixa quando a seção realmente
// vai renderizar. Reduz TTI do bundle inicial sem afetar UX (Suspense usa
// skeletons leves que reservam altura → zero CLS).
const ClientDashboardSection = lazy(() => import('@/pages/dashboard/sections/ClientDashboardSection'));
const RhDashboardSection = lazy(() => import('@/pages/dashboard/sections/RhDashboardSection'));
const ProviderInsightsCollapsible = lazy(() => import('@/pages/dashboard/sections/ProviderInsightsCollapsible'));
// ProviderAnalyticsGrid movido para /dashboard/metricas
const ProviderQuickAccess = lazy(() => import('@/pages/dashboard/sections/ProviderQuickAccess'));
const ProviderOnboardingStepper = lazy(() => import('@/pages/dashboard/sections/ProviderOnboardingStepper'));

const DashboardPage = () => {
  const { user, profile, provider, loading, refetchProfile } = useAuth();

  // Telemetria do Dashboard: tempo de carga, primeiro render e cliques bloqueados
  // por overlays. Falhas de envio são silenciosas — não impactam UX.
  useEffect(() => {
    const stopTimers = startDashboardTimers();
    const detachProbe = attachBlockedClickProbe();
    return () => {
      stopTimers();
      detachProbe();
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      reportFirstRender({ has_provider: !!provider?.id });
    }
  }, [loading, provider?.id]);
  const { registerVisit } = useDashboardState();
  useMaturityTier();

  // Auto-completa a missão "first_contact" quando detectar 1º clique no WhatsApp
  useFirstContactAutoMission();

  // Heartbeat de presença persistido (alimenta get_missed_opportunities)
  usePresenceHeartbeat(user?.id, !!provider?.id);
  useProviderActivityHeartbeat(user?.id);

  // Ping de Sucesso: toast em tempo real ao receber clique no WhatsApp/telefone
  useLeadInteractionPing();

  // PWA: missão "App Instalado" (+30 pts) + smart reminder ao abrir standalone
  usePwaMission(user?.id, provider?.id);

  // Captura ?ref= e registra indicação após login
  useReferralCapture(user?.id);

  // Registra a visita no servidor (substitui flags em localStorage)
  useEffect(() => {
    if (user?.id) {
      void registerVisit();
      // Funil exit-intent: marca conversão se houve clique pendente.
      void import('@/lib/exitIntentTelemetry').then((m) => m.maybeTrackPostSignupConversion(user.id));
    }
  }, [user?.id, registerVisit]);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  // statsLoaded/Error/reloadKey: derivados do hook compartilhado useProviderCounters (abaixo).


  const handleResetOnboarding = async () => {
    if (!user?.id) return;
    if (!window.confirm('Reiniciar o assistente? Seus dados (nome, telefone, cidade) serão preservados.')) return;
    try {
      const [{ error: profErr }, { error: metaErr }] = await Promise.all([
        supabase.from('profiles').update({
          profile_type: null,
          role: null,
          onboarding_completed: false,
        } as any).eq('id', user.id),
        supabase.auth.updateUser({ data: { profile_type_chosen: false, profile_type: null } }),
      ]);
      if (profErr || metaErr) throw profErr || metaErr;
      try {
        const keysToRemove = ['onboarding_wizard_state', 'pending_referral_code', 'auth_redirect', 'pending_signup_profile_type'];
        keysToRemove.forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
        Object.keys(localStorage).filter(k => k.startsWith('onboarding_') || k.startsWith('wizard_')).forEach(k => localStorage.removeItem(k));
        Object.keys(sessionStorage).filter(k => k.startsWith('onboarding_') || k.startsWith('wizard_') || k.startsWith('pending_')).forEach(k => sessionStorage.removeItem(k));
      } catch { /* storage may be unavailable */ }
      await refetchProfile();
      toast.success('Assistente reiniciado. Recarregando...');
      setTimeout(() => window.location.href = '/dashboard', 600);
    } catch (e) {
      console.error('[Reset Onboarding]', e);
      toast.error('Não foi possível reiniciar o cadastro.');
    }
  };
  const whatsappGroupUrl = useSettingValue('whatsapp_group_url');
  const { levelName: legacyLevelName, levelColor: legacyLevelColor } = usePermissions();
  // FONTE DA VERDADE para o nível do prestador: gamification_levels via engagement_points.
  const { currentLevel } = useEngagementLevel();
  const levelName = currentLevel?.name || legacyLevelName;
  const levelColor = currentLevel?.color || legacyLevelColor;
  // Contadores compartilhados (cache 5min entre /dashboard e /dashboard/metricas)
  const {
    servicesCount: servicesCountRaw,
    leadsCount,
    jobsCount,
    portfolioCount,
    portfolioAlbumCount,
    viewsTotal,
    reviewCount,
    isLoading: countersLoading,
    error: countersError,
    refetch: refetchCounters,
  } = useProviderCounters();
  // Mantém semântica anterior: servicesCount é null até carregar (usado por banners de "vazio")
  const servicesCount: number | null = countersLoading ? null : servicesCountRaw;
  const statsLoaded = !countersLoading && !countersError;
  const [guideOpen, setGuideOpen] = useState(true);


  // Welcome celebration: triggered once when redirected from wizard with ?welcome=1
  useEffect(() => {
    if (searchParams.get('welcome') !== '1') return;
    if (!provider || !statsLoaded) return;
    setWelcomeOpen(true);
    celebrate({ intensity: 'big', id: CELEBRATION_IDS.welcomeOnboarding(user?.id) });
    const params = new URLSearchParams(searchParams);
    params.delete('welcome');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams, user?.id, provider, statsLoaded]);

  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => navigate('/login', { replace: true }), 200);
      return () => clearTimeout(timer);
    }
  }, [loading, user, navigate]);

  // Toast de erro de contadores (preserva UX original)
  useEffect(() => {
    if (!countersError) return;
    toast.error('Não foi possível carregar suas estatísticas', {
      description: 'Verifique sua conexão e tente novamente.',
      action: { label: 'Recarregar', onClick: () => refetchCounters() },
      duration: 10000,
    });
  }, [countersError, refetchCounters]);


  const profileType = resolveEffectiveProfileType(profile, provider);
  const isClient = profileType === 'client';
  const isRH = profileType === 'rh';

  // profileDone: exige descrição, cidade E whatsapp (canal principal de contato).
  // Sem whatsapp, lead não chega — então não é "perfil completo".
  const hasWhatsapp = hasAnyContact(provider, profile);
  const profileDone = !!provider?.description && !!provider?.city && hasWhatsapp;
  const servicesDone = servicesCount !== null && servicesCount > 0;
  const portfolioDone = portfolioCount > 0;

  // Refetch contadores ao voltar para a aba/janela do dashboard.
  useEffect(() => {
    const trigger = () => refetchCounters();
    const onVisibility = () => { if (document.visibilityState === 'visible') trigger(); };
    window.addEventListener('focus', trigger);
    document.addEventListener('visibilitychange', onVisibility);
    const onProgress = () => trigger();
    window.addEventListener('onboarding-progress-changed', onProgress);
    return () => {
      window.removeEventListener('focus', trigger);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('onboarding-progress-changed', onProgress);
    };
  }, []);

  // Persist onboarding progress when steps complete (debounced, no loops).
  useEffect(() => {
    if (!provider?.id) return;
    const current = (provider?.onboarding_progress as Record<string, boolean>) || {};
    const updates: Record<string, boolean> = {};
    if (profileDone && !current.profile) updates.profile = true;
    if (servicesDone && !current.services) updates.services = true;
    if (portfolioDone && !current.portfolio) updates.portfolio = true;
    const allDone = profileDone && servicesDone && portfolioDone;
    if (allDone && !current.completed) updates.completed = true;

    if (Object.keys(updates).length === 0) return;

    void setOnboardingProgress(provider.id, updates, {
      source: 'dashboard_page_step_complete',
      currentProgress: current,
    });
  }, [provider?.id, profileDone, servicesDone, portfolioDone]);

  if (loading) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  // Onboarding redirect is owned exclusively by `OnboardingGate` in App.tsx.
  if (profile && !profileType) {
    return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;
  }

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

  // ---- CLIENT DASHBOARD ----
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

  // ---- RH DASHBOARD ----
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

  // ---- PROVIDER DASHBOARD ----
  const onboardingProgress = (provider?.onboarding_progress as Record<string, any>) || {};
  const pageCustomized = !!onboardingProgress.page_customized;
  const whatsappGroupJoined = !!onboardingProgress.whatsapp_group_joined;

  const markProgress = async (key: string) => {
    if (!provider?.id) return;
    if (onboardingProgress[key]) return;
    const result = await setOnboardingProgress(
      provider.id,
      { [key]: true },
      { source: `dashboard_mark_progress:${key}`, currentProgress: onboardingProgress },
    );
    if (result.ok && !result.noop) {
      await refetchProfile();
    } else if (!result.ok) {
      console.warn('[markProgress]', key, result.errorCode);
    }
  };

  const providerSteps = [
    {
      number: '1',
      title: 'Complete seu perfil',
      description: 'Adicione sua foto, descrição profissional, cidade e contato.',
      action: () => navigate('/dashboard/perfil'),
      actionLabel: 'Editar Perfil',
      icon: User,
      done: profileDone,
    },
    {
      number: '2',
      title: 'Cadastre seus serviços',
      description: 'Adicione os serviços que você oferece, com imagens e descrições.',
      action: () => navigate('/dashboard/servicos'),
      actionLabel: servicesDone ? 'Meus Serviços' : 'Criar primeiro serviço',
      icon: Briefcase,
      done: servicesDone,
    },
    {
      number: '3',
      title: 'Personalize sua página',
      description: 'Configure sua landing page profissional — escolha temas, cores e adicione portfólio.',
      action: () => navigate('/dashboard/minha-pagina'),
      actionLabel: pageCustomized ? 'Minha Página' : 'Personalizar agora',
      icon: Layout,
      done: pageCustomized,
    },
    {
      number: '4',
      title: 'Entre no grupo do WhatsApp',
      description: 'Participe do nosso grupo exclusivo para profissionais.',
      action: () => {
        if (!whatsappGroupUrl) return;
        window.open(whatsappGroupUrl, '_blank');
        void markProgress('whatsapp_group_joined');
      },
      actionLabel: whatsappGroupJoined ? 'Reabrir Grupo' : 'Entrar no Grupo',
      icon: Users,
      done: whatsappGroupJoined,
      hidden: !whatsappGroupUrl,
    },
  ];

  const allStepsDone = profileDone && servicesDone && pageCustomized && (!whatsappGroupUrl || whatsappGroupJoined);

  // FONTE ÚNICA da verdade da completude
  const unifiedItems = buildOnboardingChecklist({
    profile, provider,
    servicesCount: servicesCount ?? 0,
    portfolioAlbumsCount: portfolioAlbumCount,
  });
  const unifiedStats = checklistStats(unifiedItems);
  const completenessPercent = unifiedStats.pct;
  const remainingItems = unifiedStats.total - unifiedStats.completed;
  const allChecklistDone = remainingItems === 0;
  const showServiceEmptyBanner = servicesCount !== null && servicesCount === 0;
  const showPortfolioEmptyBanner = servicesCount !== null && servicesCount > 0 && portfolioAlbumCount === 0;
  const anyEmptyBannerVisible = showServiceEmptyBanner || showPortfolioEmptyBanner;

  // statCards foram movidos para /dashboard/metricas (DashboardMetricsPage).

  // Welcome banner contextual greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? 'Boa madrugada'
    : hour < 12 ? 'Bom dia'
    : hour < 18 ? 'Boa tarde'
    : 'Boa noite';
  const pendingLeads = leadsCount;

  const isCompanyProvider = profile?.profile_type === 'provider' && (provider as any)?.account_type === 'company';
  const showFullAddress = !!(provider as any)?.show_full_address;

  return (
    <DashboardLayout>
      <div className="-mx-4 -my-6 bg-slate-50 px-4 py-6 dark:bg-background sm:-mx-6 sm:px-6">
      {debugBar}
      <RealtimeEngagementToast />
      <LevelUpBanner />
      {/* Enhanced Welcome Hero */}
      <WelcomeHero
        greeting={greeting}
        name={profile?.full_name?.split(' ')[0] || 'Profissional'}
        pendingLeads={pendingLeads}
        levelName={levelName}
        levelColor={levelColor}
        memberSince={profile?.created_at}
        avatarUrl={profile?.avatar_url || undefined}
      />

      {/* ===== ORDEM: AÇÕES ÚTEIS PRIMEIRO, MÉTRICAS DEPOIS ===== */}

      {/* 1) Ações Rápidas no topo */}
      <div className="mt-6">
        <QuickActionsHero />
      </div>

      {/* 2) "Como funciona" — checklist de onboarding sincronizado */}
      <div className="mt-4">
        <OnboardingCompletionTracker
          servicesCount={servicesCount ?? 0}
          portfolioAlbumsCount={portfolioAlbumCount}
        />
      </div>

      {/* 3) Score rápido de completude */}
      <div className="mt-4">
        <UnifiedHealthScore score={completenessPercent} remaining={remainingItems} />
      </div>

      {/* 4) Obra do Dia */}
      {provider?.id && (
        <div className="mt-4">
          <DailyPostCard />
        </div>
      )}

      {/* 5) PRÉVIA DE MÉTRICAS — painel completo em /dashboard/metricas */}
      {provider?.id && (
        <div className="mt-6">
          <MetricsPreviewCard
            viewsTotal={viewsTotal}
            leadsCount={leadsCount}
            contactClicks={(provider as any)?.contact_clicks_count ?? 0}
          />
        </div>
      )}

      {/* Online Status Feedback */}
      <div className="mt-3 flex justify-end" data-tour="online-status">
        <OnlineStatusFeedback />
      </div>

      {/* Seletor manual de visibilidade online (provider) */}
      {provider?.id && (
        <div className="mt-3" data-tour="online-toggle">
          <OnlineStatusToggle />
        </div>
      )}

      {/* Banner de instalação do App (mobile + provider) */}
      {provider?.id && (
        <div className="mt-3">
          <DashboardPwaInstallNudge />
        </div>
      )}

      {/* Cards de Missão Profissional */}
      <div className="mt-4" data-tour="missions">
        <MissionCard />
      </div>

      {/* Sugestões de identidade (governança) */}
      <div className="mt-4">
        <IdentitySuggestionsWidget limit={2} />
      </div>

      {/* Contador de Impacto Real (24h) — movido para /dashboard/metricas */}

      {/* Ciclo de Fechamento */}
      <div className="mt-4">
        <ServiceCompletionCard />
      </div>

      {/* Engagement Loop */}
      <div className="mt-4">
        <EngagementLoop
          servicesCount={servicesCount ?? 0}
          portfolioAlbumsCount={portfolioAlbumCount}
          unifiedPct={completenessPercent}
        />
      </div>

      {/* Banners persistentes de alta prioridade */}
      {showServiceEmptyBanner && (
        <div className="mt-4">
          <EmptyStateBanner variant="service" />
        </div>
      )}
      {showPortfolioEmptyBanner && (
        <div className="mt-4">
          <EmptyStateBanner variant="portfolio" />
        </div>
      )}

      {/* CTA único inteligente */}
      {(() => {
        if (allChecklistDone) return null;
        if (anyEmptyBannerVisible && remainingItems <= 1) return null;

        if (remainingItems <= 1) {
          return (
            <div className="mt-4">
              <SmartNextStepCTA
                servicesCount={servicesCount ?? 0}
                portfolioAlbumsCount={portfolioAlbumCount}
              />
            </div>
          );
        }
        return (
          <>
            <IncompleteLocationAlert provider={provider as any} />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <DismissibleWidget widgetKey="first_lead_checklist">
                <FirstLeadChecklist
                  servicesCount={servicesCount ?? 0}
                  portfolioAlbumsCount={portfolioAlbumCount}
                />
              </DismissibleWidget>
              <DismissibleWidget widgetKey="profile_location_checklist">
                <ProfileLocationChecklist provider={provider as any} />
              </DismissibleWidget>
              <CommunityVerifiedStatus />
            </div>
          </>
        );
      })()}

      {/* Dica de especialista */}
      {provider && (
        <div className="mt-4">
          <DismissibleWidget widgetKey="expert_tips">
            <ExpertTipsWidget />
          </DismissibleWidget>
        </div>
      )}

      {/* Lembrete de follow-up de leads em aberto */}
      <div className="mt-4">
        <LeadFollowupWidget />
      </div>

      {/* INSIGHTS SECUNDÁRIOS — lazy: bloco colapsável com widgets pesados */}
      <Suspense fallback={<SectionSkeleton minH="min-h-16" />}>
        <ProviderInsightsCollapsible avatarUrl={profile?.avatar_url} />
      </Suspense>

      {/* Share Profile Card & QR Code */}
      {provider?.slug && (
        <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2" data-tour="share">
          <ShareProfileCard />
          <QrCodeCard />
          <StorageQuotaWidget />
        </div>
      )}

      {/* Courses promotion */}
      <div className="mt-4">
        <CoursesBanner />
      </div>

      <QuickStatsBar pendingLeads={pendingLeads} providerSlug={provider?.slug} />

      {/* Action Queue */}
      <div className="mt-4">
        <ActionQueue
          servicesCount={servicesCount ?? 0}
          portfolioAlbumsCount={portfolioAlbumCount}
        />
      </div>

      {/* Métricas finais, StatCardGrid e Analytics Grid — movidos para /dashboard/metricas */}

      {/* Dica do dia + Benefícios do nível */}
      {provider && (
        <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-2">
          <DashboardTipOfDay
            servicesCount={servicesCount ?? 0}
            portfolioCount={portfolioCount}
            leadsCount={leadsCount}
            reviewCount={reviewCount}
          />
          <LevelBenefits />
        </div>
      )}

      {/* Quick Access — lazy: abaixo da dobra, atalhos de navegação */}
      <Suspense fallback={<SectionSkeleton minH="min-h-[280px]" />}>
        <ProviderQuickAccess
          servicesCount={servicesCount}
          providerSlug={provider?.slug ?? null}
          providerId={provider?.id ?? null}
          isCompanyProvider={isCompanyProvider}
          showFullAddress={showFullAddress}
          levelName={(profile as any)?.levelInfo?.name ?? null}
        />
      </Suspense>

      {/* Onboarding Stepper — lazy: bloco visual final "Como funciona" */}
      <Suspense fallback={<SectionSkeleton minH="min-h-[180px]" />}>
        <ProviderOnboardingStepper
          steps={providerSteps}
          allStepsDone={allStepsDone}
          open={guideOpen}
          onToggle={() => setGuideOpen(!guideOpen)}
        />
      </Suspense>

      {/* Lote 4 — Frescor & Inteligência */}
      {provider?.id && (
        <>
          <div className="mt-6">
            <MissedOpportunitiesWidget />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ReferralInviteCard />
          </div>
        </>
      )}

      {/* Nossa história — referência à luta */}
      <OurStoryBanner variant="compact" />

      <NextStepPrompt open={welcomeOpen} onClose={() => setWelcomeOpen(false)} context="welcome" providerSlug={provider?.slug ?? null} />

      {/* Tour guiado de 3 passos para tier "novato" */}
      <DashboardTour />
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
