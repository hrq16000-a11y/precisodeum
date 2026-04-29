import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NextStepPrompt from '@/components/dashboard/NextStepPrompt';
import { CELEBRATION_IDS, celebrate } from '@/lib/celebrate';
import DashboardLayout from '@/components/DashboardLayout';
import { Briefcase, User, ArrowRight, Users, Settings, PlusCircle, Megaphone, Layout, Star, MessageSquare, Eye, ChevronDown, ChevronUp, TrendingUp, Sparkles, Zap, Camera, FileText, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import ProfileCompleteness from '@/components/dashboard/ProfileCompleteness';
import AvatarReminder from '@/components/dashboard/AvatarReminder';
import LeadsChart from '@/components/dashboard/LeadsChart';
import RecentActivity from '@/components/dashboard/RecentActivity';
import ConversionInsights from '@/components/dashboard/ConversionInsights';
import WelcomeHero from '@/components/dashboard/WelcomeHero';
import QuickStatsBar from '@/components/dashboard/QuickStatsBar';
import StatCardGrid from '@/components/dashboard/StatCardGrid';
import DashboardTipOfDay from '@/components/dashboard/DashboardTipOfDay';
import ProfileStrength from '@/components/dashboard/ProfileStrength';
import LevelBenefits from '@/components/dashboard/LevelBenefits';
import ShareProfileCard from '@/components/dashboard/ShareProfileCard';
import RankingStatus from '@/components/dashboard/RankingStatus';
import RankingAlertWidget from '@/components/dashboard/RankingAlertWidget';
import CommunityFeed from '@/components/dashboard/CommunityFeed';
import RealtimeEngagementToast from '@/components/dashboard/RealtimeEngagementToast';
import LevelUpBanner from '@/components/dashboard/LevelUpBanner';
import QrCodeCard from '@/components/dashboard/QrCodeCard';
import { usePermissions } from '@/hooks/usePermissions';
import { useEngagementLevel } from '@/hooks/useEngagementLevel';
import GlassCard from '@/components/ui/GlassCard';
import ProgressRing from '@/components/ui/ProgressRing';
import ActionQueue from '@/components/dashboard/ActionQueue';
import UpsellBanner from '@/components/dashboard/UpsellBanner';
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
import { buildOnboardingChecklist, checklistStats } from '@/lib/onboardingChecklist';
import CommunityVerifiedStatus from '@/components/dashboard/CommunityVerifiedStatus';
import DemandSignalAlert from '@/components/dashboard/DemandSignalAlert';
import ProfileHealthScore from '@/components/dashboard/ProfileHealthScore';
import DashboardAnalytics from '@/components/dashboard/DashboardAnalytics';
import AdPerformanceWidget from '@/components/dashboard/AdPerformanceWidget';
import { useProviderActivityHeartbeat } from '@/hooks/useProviderActivityHeartbeat';
import { useLeadInteractionPing } from '@/hooks/useLeadInteractionPing';
import ServiceCompletionCard from '@/components/dashboard/ServiceCompletionCard';
import CategoryBenchmarkWidget from '@/components/dashboard/CategoryBenchmarkWidget';
import RegionalDemandWidget from '@/components/dashboard/RegionalDemandWidget';
import WeeklySummary from '@/components/dashboard/WeeklySummary';
import DailyPostCard from '@/components/dashboard/DailyPostCard';
import MissedOpportunitiesWidget from '@/components/dashboard/MissedOpportunitiesWidget';
import ReferralInviteCard from '@/components/dashboard/ReferralInviteCard';
import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat';
import { useReferralCapture } from '@/hooks/useReferralCapture';
import RhPublicPageLink from '@/components/dashboard/RhPublicPageLink';
import EngagementLoop from '@/components/dashboard/EngagementLoop';
import AchievementHistory from '@/components/dashboard/AchievementHistory';
import CelebrationMuteToggle from '@/components/dashboard/CelebrationMuteToggle';
import LeadAnalytics from '@/components/dashboard/LeadAnalytics';
import LeadInsights from '@/components/dashboard/LeadInsights';
import ExpertTipsWidget from '@/components/dashboard/ExpertTipsWidget';
import DismissibleWidget from '@/components/dashboard/DismissibleWidget';
import MissionCard from '@/components/dashboard/MissionCard';
import ContactImpactWidget from '@/components/dashboard/ContactImpactWidget';
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
import ImpactSection from '@/components/dashboard/ImpactSection';

const DashboardPage = () => {
  const { user, profile, provider, loading, refetchProfile, signOut } = useAuth();
  const { registerVisit } = useDashboardState();
  const { isAtLeast, tier } = useMaturityTier();

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
    if (user?.id) void registerVisit();
  }, [user?.id, registerVisit]);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleResetOnboarding = async () => {
    if (!user?.id) return;
    if (!window.confirm('Reiniciar o assistente? Seus dados (nome, telefone, cidade) serão preservados.')) return;
    try {
      // Reset profile_type/role no banco e metadata no auth
      const [{ error: profErr }, { error: metaErr }] = await Promise.all([
        supabase.from('profiles').update({
          profile_type: null,
          role: null,
          onboarding_completed: false,
        } as any).eq('id', user.id),
        supabase.auth.updateUser({ data: { profile_type_chosen: false, profile_type: null } }),
      ]);
      if (profErr || metaErr) throw profErr || metaErr;
      // Limpeza completa de cache local relacionado ao fluxo de cadastro/triagem
      try {
        const keysToRemove = ['onboarding_wizard_state', 'pending_referral_code', 'auth_redirect', 'pending_signup_profile_type'];
        keysToRemove.forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
        // Limpa qualquer chave residual com prefixo de onboarding
        Object.keys(localStorage).filter(k => k.startsWith('onboarding_') || k.startsWith('wizard_')).forEach(k => localStorage.removeItem(k));
        Object.keys(sessionStorage).filter(k => k.startsWith('onboarding_') || k.startsWith('wizard_') || k.startsWith('pending_')).forEach(k => sessionStorage.removeItem(k));
      } catch {}
      await refetchProfile();
      toast.success('Assistente reiniciado. Recarregando...');
      setTimeout(() => window.location.href = '/dashboard', 600);
    } catch (e) {
      console.error('[Reset Onboarding]', e);
      toast.error('Não foi possível reiniciar o cadastro.');
    }
  };
  const whatsappGroupUrl = useSettingValue('whatsapp_group_url');
  // ServiceWizard ligado por padrão (a flag só serve para desativar explicitamente).
  const { levelName: legacyLevelName, levelColor: legacyLevelColor } = usePermissions();
  // FONTE DA VERDADE para o nível do prestador: gamification_levels via engagement_points.
  const { currentLevel } = useEngagementLevel();
  const levelName = currentLevel?.name || legacyLevelName;
  const levelColor = currentLevel?.color || legacyLevelColor;
  const [servicesCount, setServicesCount] = useState<number | null>(null);
  const [leadsCount, setLeadsCount] = useState<number>(0);
  const [jobsCount, setJobsCount] = useState<number>(0);
  const [portfolioCount, setPortfolioCount] = useState<number>(0);
  const [portfolioAlbumCount, setPortfolioAlbumCount] = useState<number>(0);
  const [viewsTotal, setViewsTotal] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [guideOpen, setGuideOpen] = useState(true);

  // Welcome celebration: triggered once when redirected from wizard with ?welcome=1
  // GATE: só dispara quando provider e estatísticas estiverem carregados,
  // evitando flicker de "0 serviços / 0 portfólio" durante o welcome.
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

  useEffect(() => {
    if (!provider) return;
    let cancelled = false;
    (async () => {
      try {
        setStatsError(false);
        const albumsRes = await supabase.from('portfolio_albums').select('id').eq('provider_id', provider.id);
        if (albumsRes.error) throw albumsRes.error;
        const albumIds = (albumsRes.data || []).map(a => a.id);
        const [sRes, lRes, pRes, rRes] = await Promise.all([
          supabase.from('services').select('id, view_count', { count: 'exact' }).eq('provider_id', provider.id),
          supabase.from('leads').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id),
          albumIds.length > 0
            ? supabase.from('portfolio_photos').select('id', { count: 'exact', head: true }).in('album_id', albumIds)
            : Promise.resolve({ count: 0, error: null } as any),
          supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id),
        ]);
        if (sRes.error || lRes.error || (pRes as any).error || rRes.error) {
          throw sRes.error || lRes.error || (pRes as any).error || rRes.error;
        }
        if (cancelled) return;
        setPortfolioAlbumCount(albumIds.length);
        setServicesCount(sRes.count ?? 0);
        setLeadsCount(lRes.count ?? 0);
        setPortfolioCount(pRes.count ?? 0);
        const totalViews = (sRes.data || []).reduce((acc: number, s: any) => acc + (s.view_count || 0), 0);
        setViewsTotal(totalViews);
        setReviewCount(rRes.count ?? 0);
        setStatsLoaded(true);
      } catch (err) {
        if (cancelled) return;
        console.error('[Dashboard] Erro ao carregar contadores:', err);
        setStatsError(true);
        toast.error('Não foi possível carregar suas estatísticas', {
          description: 'Verifique sua conexão e tente novamente.',
          action: {
            label: 'Recarregar',
            onClick: () => setReloadKey(k => k + 1),
          },
          duration: 10000,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [provider, reloadKey]);

  useEffect(() => {
    if (!user) return;
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setJobsCount(count ?? 0));
  }, [user]);

  const profileType = profile?.profile_type ?? null;
  const isClient = profileType === 'client';
  const isProvider = profileType === 'provider';
  const isRH = profileType === 'rh';

  const profileDone = !!provider?.description && !!provider?.city;
  const servicesDone = servicesCount !== null && servicesCount > 0;
  const portfolioDone = portfolioCount > 0;

  // Persist onboarding progress when steps complete (debounced, no loops)
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

    void supabase.from('providers').update({
      onboarding_progress: { ...current, ...updates },
    }).eq('id', provider.id);
  }, [provider?.id, profileDone, servicesDone, portfolioDone]);

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  // Onboarding redirect is owned exclusively by `OnboardingGate` in App.tsx.
  // We only guard against the brief instant where `profile_type` hasn't loaded yet.
  if (profile && !profileType) return null;

  const profileTypeLabel = (() => {
    switch (profile?.profile_type) {
      case 'provider': return 'Profissional';
      case 'client': return 'Cliente';
      case 'rh': return 'Agência RH';
      case 'admin': return 'Admin';
      default: return 'Não definido';
    }
  })();

  const debugResetBar = (
    <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-[12px] text-foreground min-w-0">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          <User className="h-3.5 w-3.5" />
        </div>
        <span className="truncate">
          Conta: <strong>{profileTypeLabel}</strong>
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="default"
          className="h-7 gap-1.5 px-2.5 text-[11px]"
          onClick={() => navigate('/cadastro-inicial')}
          title="Continuar onde parei"
          aria-label="Wizard — continuar onde parei"
        >
          <Sparkles className="h-3 w-3" />
          Wizard
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={handleResetOnboarding}
          title="Reiniciar cadastro do zero"
        >
          <RotateCcw className="h-3 w-3" />
          Reiniciar
        </Button>
      </div>
    </div>
  );


  // ---- CLIENT DASHBOARD ----
  if (isClient) {
    return (
      <DashboardLayout>
        {debugResetBar}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <motion.div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity }}
          >
            <User className="h-5 w-5 text-blue-600" />
          </motion.div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Olá, {profile?.full_name?.split(' ')[0] || 'Bem-vindo'}!</h1>
            <p className="text-sm text-muted-foreground">Sua conta de cliente</p>
          </div>
        </motion.div>

        <GlassCard variant="gradient" className="mt-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Conta Cliente</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Como cliente, você pode buscar profissionais, visualizar perfis e entrar em contato por WhatsApp.
              </p>
            </div>
          </div>
        </GlassCard>

        <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2">
          <GlassCard variant="default" delay={0.1} className="cursor-pointer" onClick={() => navigate('/buscar')}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent group-hover:scale-110 transition-transform">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Buscar Profissionais</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Encontre o profissional ideal na sua cidade</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard variant="default" delay={0.2} className="cursor-pointer" onClick={() => navigate('/vagas')}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Ver Vagas</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Confira oportunidades disponíveis</p>
              </div>
            </div>
          </GlassCard>
        </div>

        <GlassCard variant="glow" delay={0.3} className="mt-6">
          <p className="text-sm text-foreground font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Quer oferecer serviços?
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Altere o tipo da sua conta para "Profissional" na página de perfil e comece a divulgar seus serviços.
          </p>
          <button
            onClick={() => navigate('/dashboard/perfil')}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            Alterar tipo de conta <ArrowRight className="h-3 w-3" />
          </button>
        </GlassCard>

        {/* Courses promotion */}
        <div className="mt-4">
          <CoursesBanner />
        </div>
        <NextStepPrompt open={welcomeOpen} onClose={() => setWelcomeOpen(false)} context="welcome" providerSlug={provider?.slug ?? null} />
      </DashboardLayout>
    );
  }

  // ---- RH DASHBOARD (Indigo Corporate Theme) ----
  if (isRH) {
    return (
      <DashboardLayout>
        {debugResetBar}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <motion.div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-slate-700/10"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity }}
          >
            <Megaphone className="h-5 w-5 text-indigo-600" />
          </motion.div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Painel Agência de RH</h1>
            <p className="text-sm text-muted-foreground">Gerencie vagas e candidatos da sua agência de recrutamento</p>
          </div>
        </motion.div>

        <GlassCard variant="gradient" className="mt-6 border-indigo-200 dark:border-indigo-800/40 bg-gradient-to-br from-indigo-500/5 to-slate-500/5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Conta Agência de RH / Recrutamento</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Publique vagas com auto-aprovação, acesse perfis qualificados e gerencie processos seletivos.
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Métricas focadas em recrutamento (sem portfólio) */}
        <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-indigo-200/60 dark:border-indigo-800/40 bg-card p-4">
            <div className="flex items-center gap-2 text-indigo-600"><Megaphone className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-wide">Minhas Vagas</span></div>
            <p className="mt-1 text-2xl font-bold text-foreground">{jobsCount}</p>
          </div>
          <div className="rounded-2xl border border-indigo-200/60 dark:border-indigo-800/40 bg-card p-4">
            <div className="flex items-center gap-2 text-indigo-600"><MessageSquare className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-wide">Candidatos</span></div>
            <p className="mt-1 text-2xl font-bold text-foreground">{leadsCount}</p>
          </div>
          <div className="rounded-2xl border border-indigo-200/60 dark:border-indigo-800/40 bg-card p-4">
            <div className="flex items-center gap-2 text-indigo-600"><Eye className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-wide">Visualizações</span></div>
            <p className="mt-1 text-2xl font-bold text-foreground">{viewsTotal}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Megaphone, title: 'Minhas Vagas', desc: 'Gerencie suas vagas publicadas', path: '/dashboard/vagas', count: jobsCount, countLabel: 'vaga', action: 'Publicar nova vaga' },
            { icon: Layout, title: 'Dados da Agência', desc: 'Edite a página pública da sua agência', path: '/dashboard/agencia' },
            { icon: Eye, title: 'Buscar Profissionais', desc: 'Encontre profissionais para suas vagas', path: '/buscar' },
            { icon: Users, title: 'Comunidade', desc: 'Conecte-se com a comunidade', path: '/dashboard/comunidade' },
          ].map((item, i) => (
            <GlassCard key={item.path} variant="default" delay={0.1 + i * 0.1} className="cursor-pointer border-indigo-200/40 dark:border-indigo-800/30" onClick={() => navigate(item.path)}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  {item.count && item.count > 0 && <span className="inline-block mt-1 text-xs font-medium text-indigo-600">{item.count} {item.countLabel}{item.count !== 1 ? 's' : ''}</span>}
                </div>
              </div>
              {item.action && (
                <button onClick={(e) => { e.stopPropagation(); navigate(item.path); }}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline">
                  <PlusCircle className="h-3.5 w-3.5" /> {item.action}
                </button>
              )}
            </GlassCard>
          ))}
        </div>

        {/* Botão "Ver minha página pública" */}
        <RhPublicPageLink userId={user?.id} />
        <NextStepPrompt open={welcomeOpen} onClose={() => setWelcomeOpen(false)} context="welcome" providerSlug={provider?.slug ?? null} />
      </DashboardLayout>
    );
  }

  // Helper component declared inline below the file for RH public link

  // ---- PROVIDER DASHBOARD ----
  const onboardingProgress = (provider?.onboarding_progress as Record<string, any>) || {};
  const pageCustomized = !!onboardingProgress.page_customized;
  const whatsappGroupJoined = !!onboardingProgress.whatsapp_group_joined;

  const markProgress = async (key: string) => {
    if (!provider?.id) return;
    if (onboardingProgress[key]) return;
    try {
      await supabase
        .from('providers')
        .update({ onboarding_progress: { ...onboardingProgress, [key]: true } })
        .eq('id', provider.id);
      await refetchProfile();
    } catch (e) {
      console.warn('[markProgress]', key, e);
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

  // FONTE ÚNICA da verdade da completude — `onboardingChecklist` (mesma usada pelos
  // componentes filhos). Usar SEMPRE este `pct`/`stats` em qualquer lugar do dashboard.
  const unifiedItems = buildOnboardingChecklist({
    profile, provider,
    servicesCount: servicesCount ?? 0,
    portfolioAlbumsCount: portfolioAlbumCount,
  });
  const unifiedStats = checklistStats(unifiedItems);
  const completenessPercent = unifiedStats.pct;
  const remainingItems = unifiedStats.total - unifiedStats.completed;
  const allChecklistDone = remainingItems === 0;
  // Banners persistentes (cobrem cenários estruturais)
  const showServiceEmptyBanner = servicesCount !== null && servicesCount === 0;
  const showPortfolioEmptyBanner = servicesCount !== null && servicesCount > 0 && portfolioAlbumCount === 0;
  const anyEmptyBannerVisible = showServiceEmptyBanner || showPortfolioEmptyBanner;

  const statCards = [
    { icon: Briefcase, value: servicesCount ?? 0, label: servicesCount === 0 ? 'Nenhum serviço' : 'Serviços', gradient: 'from-blue-500/10 to-blue-600/5', iconColor: 'text-blue-500' },
    { icon: MessageSquare, value: leadsCount, label: leadsCount === 0 ? 'Nenhum lead' : 'Leads', gradient: 'from-purple-500/10 to-purple-600/5', iconColor: 'text-purple-500' },
    { icon: TrendingUp, value: viewsTotal, label: viewsTotal === 0 ? 'Sem visualizações' : 'Visualizações', gradient: 'from-emerald-500/10 to-emerald-600/5', iconColor: 'text-emerald-500' },
    { icon: Star, value: provider?.rating_avg ? Number(provider.rating_avg).toFixed(1) : '0', label: !provider?.rating_avg || Number(provider.rating_avg) === 0 ? 'Sem avaliações' : `${reviewCount} avaliação${reviewCount !== 1 ? 'ões' : ''}`, gradient: 'from-amber-500/10 to-amber-600/5', iconColor: 'text-amber-500' },
    { icon: Camera, value: portfolioCount, label: portfolioCount === 0 ? 'Sem fotos' : 'Portfólio', gradient: 'from-pink-500/10 to-pink-600/5', iconColor: 'text-pink-500' },
    { icon: Megaphone, value: jobsCount, label: jobsCount === 0 ? 'Nenhuma vaga' : 'Vagas', gradient: 'from-indigo-500/10 to-indigo-600/5', iconColor: 'text-indigo-500' },
  ];

  // Welcome banner contextual greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const pendingLeads = leadsCount;

  return (
    <DashboardLayout>
      <div className="-mx-4 -my-6 bg-slate-50 px-4 py-6 dark:bg-background sm:-mx-6 sm:px-6">
      {debugResetBar}
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

      {/* 1) Painel "Saúde e Performance" — métricas + score gamificado + tendência + atividade */}
      <div className="mt-6">
        <DashboardAnalytics />
      </div>

      {/* 1b) Desempenho do Anúncio — cliques reais + diagnóstico */}
      {provider?.id && (
        <div className="mt-4">
          <AdPerformanceWidget providerId={provider.id} hasPhoto={!!provider?.photo_url} />
        </div>
      )}

      {/* Mantém UnifiedHealthScore como complemento de completude rápida */}
      <div className="mt-4">
        <UnifiedHealthScore score={completenessPercent} remaining={remainingItems} />
      </div>

      {/* 2) Ações Rápidas no topo — primeira coisa visível */}
      <div className="mt-4">
        <QuickActionsHero />
      </div>

      {/* 3) "Como funciona" — checklist de onboarding logo abaixo do topo,
             sincronizado com o estado real (services/portfolio/profile). */}
      <div className="mt-4">
        <OnboardingCompletionTracker
          servicesCount={servicesCount ?? 0}
          portfolioAlbumsCount={portfolioAlbumCount}
        />
      </div>

      {/* 4) Obra do Dia — ação principal de frescor, próxima ao topo */}
      {provider?.id && (
        <div className="mt-4">
          <DailyPostCard />
        </div>
      )}

      {/* Impacto na Rede movido para o final da página, junto às demais métricas. */}

      {/* Online Status Feedback — pulse + toast quando entra em modo Online */}
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

      {/* Cards de Missão Profissional — gated por tier de maturidade */}
      <div className="mt-4" data-tour="missions">
        <MissionCard />
      </div>

      {/* Sugestões de identidade (governança) — só renderiza se houver pendências */}
      <div className="mt-4">
        <IdentitySuggestionsWidget limit={2} />
      </div>

      {/* Contador de Impacto Real (24h) — visualizações e cliques de contato */}
      <div className="mt-4" data-tour="contact-impact">
        <ContactImpactWidget />
      </div>

      {/* Engagement Loop — guides the user to the next highest-impact action */}
      <div className="mt-4">
        <EngagementLoop
          servicesCount={servicesCount ?? 0}
          portfolioAlbumsCount={portfolioAlbumCount}
          unifiedPct={completenessPercent}
        />
      </div>

      {/* Banners persistentes de alta prioridade — Empty States estruturais */}
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

      {/* CTA único inteligente — só aparece se NÃO houver banner cobrindo a mesma pendência.
          Quando há >1 pendência, mostra o checklist completo + status comunidade. */}
      {(() => {
        if (allChecklistDone) return null;
        // Se um banner Empty State já está cobrindo a única pendência → suprimir CTA duplicado
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

      {/* Dica de especialista — muda conforme a categoria do prestador */}
      {provider && (
        <div className="mt-4">
          <DismissibleWidget widgetKey="expert_tips">
            <ExpertTipsWidget />
          </DismissibleWidget>
        </div>
      )}


      {/* OnboardingCompletionTracker movido para o topo (após QuickActionsHero) */}

      {/* Lembrete de follow-up de leads em aberto */}
      <div className="mt-4">
        <LeadFollowupWidget />
      </div>

      {/* Sinal de demanda (FOMO) — apenas Engajado+ */}
      <div className="mt-4">
        <DemandSignalAlert />
      </div>

      {/* Resumo Semanal (FOMO comparativo + métricas 7d) */}
      <div className="mt-4">
        <WeeklySummary />
      </div>

      {/* Força do Perfil — score já exibido no topo via UnifiedHealthScore */}
      <div className="mt-4" data-tour="profile-strength">
        <ProfileStrength />
      </div>

      {/* Benchmark de engagement vs. média da categoria */}
      <div className="mt-4">
        <CategoryBenchmarkWidget />
      </div>

      {/* Onde estão os Clientes? — top regiões com buscas na categoria */}
      <div className="mt-4">
        <RegionalDemandWidget />
      </div>

      {/* Ranking Status */}
      <div className="mt-4">
        <RankingStatus />
      </div>

      {/* Ranking Alert — Position Drop Detection */}
      <div className="mt-4">
        <RankingAlertWidget />
      </div>

      {/* Avatar Reminder */}
      <div className="mt-4">
        <AvatarReminder avatarUrl={profile?.avatar_url} />
      </div>

      {/* Share Profile Card & QR Code */}
      {provider?.slug && (
        <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2" data-tour="share">
          <ShareProfileCard />
          <QrCodeCard />
          <StorageQuotaWidget />
        </div>
      )}

      {/* Community Feed desativado — exibia atividades antigas como "Ao vivo". */}

      {/* Courses promotion */}
      <div className="mt-4">
        <CoursesBanner />
      </div>

      <QuickStatsBar pendingLeads={pendingLeads} providerSlug={provider?.slug} />

      {/* Action Queue — what to do next (sincronizado com checklist unificado) */}
      <div className="mt-4">
        <ActionQueue
          servicesCount={servicesCount ?? 0}
          portfolioAlbumsCount={portfolioAlbumCount}
        />
      </div>
      {/* Dominant CTA when no services — REMOVIDO: substituído por EmptyStateBanner persistente acima */}
      {/* Métricas finais — concentradas no fim da página conforme diretriz UX. */}
      <div className="mt-6">
        <ImpactSection
          views={viewsTotal}
          whatsappClicks={(provider as any)?.contact_clicks_count ?? 0}
          leads={leadsCount}
        />
      </div>

      {/* Stats with animated counters — só renderiza se houver pelo menos 1 contador real >0 */}
      {(servicesCount ?? 0) + leadsCount + viewsTotal + portfolioCount + jobsCount + reviewCount > 0 && (
        <div className="mt-5">
          <StatCardGrid cards={statCards} />
        </div>
      )}

      {/* Analytics Grid: charts/insights — cada bloco já se auto-oculta quando
          não há dados reais (evita UI estática enganosa). */}
      {/* Analytics Grid: charts/insights — só renderiza quando há dados reais.
          Cada bloco interno também tem guarda própria; o grid externo é
          ocultado por completo se views/leads forem zero. */}
      {provider && (viewsTotal > 0 || leadsCount > 0) && (
        <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-2">
          <GlassCard variant="default" hoverEffect={false} delay={0.4} data-tour="leads">
            <LeadsChart providerId={provider.id} />
          </GlassCard>

          <GlassCard variant="default" hoverEffect={false} delay={0.5}>
            <ConversionInsights views={viewsTotal} leads={leadsCount} services={servicesCount ?? 0} />
          </GlassCard>

          <div className="lg:col-span-2">
            <LeadInsights providerId={provider.id} />
          </div>

          {leadsCount > 0 && (
            <GlassCard variant="bordered" hoverEffect={false} delay={0.6}>
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                Atividade Recente
              </h3>
              <RecentActivity providerId={provider.id} />
            </GlassCard>
          )}
        </div>
      )}

      {/* Dica do dia + Benefícios do nível — sempre úteis, fora do grid analytics */}
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

      {/* Quick Access — enhanced cards */}
      <div className="mt-6">
        <motion.h2
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"
        >
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Acesso Rápido
        </motion.h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <GlassCard variant="default" delay={0.5} className="cursor-pointer" onClick={() => navigate('/dashboard/servicos')} data-tour="services">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent transition-all duration-300 group-hover:bg-accent group-hover:text-accent-foreground">
                <Settings className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground">Meus Serviços</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Gerencie seus serviços cadastrados</p>
                {servicesCount !== null && servicesCount > 0 && (
                  <span className="inline-block mt-1.5 text-xs font-medium text-accent">{servicesCount} ativo{servicesCount !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); navigate('/dashboard/servicos'); }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
              <PlusCircle className="h-3.5 w-3.5" /> Adicionar novo serviço
            </button>
          </GlassCard>

          {provider?.slug && (
            <GlassCard variant="bordered" delay={0.7} className="cursor-pointer border-dashed" onClick={() => navigate(`/profissional/${provider.slug}`)}>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Eye className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground">Ver Minha Página</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Veja como seu perfil aparece para os clientes</p>
                </div>
              </div>
            </GlassCard>
          )}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 shadow-sm">
            <div className="min-w-0">
              <span className="text-sm font-semibold text-foreground">Som de conquistas</span>
              <p className="text-xs text-muted-foreground">Controla o áudio das celebrações; confetes continuam ativos.</p>
            </div>
            <CelebrationMuteToggle />
          </div>

          <LeadAnalytics providerId={provider?.id ?? null} />

          <AchievementHistory providerSlug={provider?.slug ?? null} levelName={(profile as any)?.levelInfo?.name ?? null} />
        </div>
      </div>

      {/* Onboarding guide — enhanced */}
      {/* Onboarding Stepper — visual horizontal */}
      <GlassCard variant="glow" hoverEffect={false} delay={0.8} className="mt-6 border-accent/20 bg-accent/3">
        <button
          onClick={() => setGuideOpen(!guideOpen)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="text-xl">🚀</motion.div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Como funciona
                {allStepsDone && <span className="ml-2 text-xs font-normal text-accent">✓ Concluído</span>}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {allStepsDone ? 'Parabéns! Perfil completo.' : 'Siga os passos para receber clientes.'}
              </p>
            </div>
          </div>
          <motion.div animate={{ rotate: guideOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
          </motion.div>
        </button>

        <AnimatePresence>
          {guideOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' as const }}
              className="overflow-hidden"
            >
              {/* Horizontal stepper */}
              <div className="mt-5 flex items-start justify-between relative px-2">
                {/* Progress line */}
                <div className="absolute top-4 left-8 right-8 h-0.5 bg-border rounded-full">
                  <motion.div
                    className="h-full bg-accent rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${(providerSteps.filter(s => !s.hidden && s.done).length / providerSteps.filter(s => !s.hidden).length) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  />
                </div>

                {providerSteps.filter(s => !s.hidden).map((step, i) => {
                  const StepIcon = step.icon;
                  return (
                    <motion.button
                      key={step.number}
                      onClick={step.action}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="flex flex-col items-center gap-2 relative z-10 group flex-1"
                    >
                      <motion.div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                          step.done
                            ? 'bg-accent border-accent text-accent-foreground'
                            : 'bg-background border-border text-muted-foreground group-hover:border-accent/50'
                        }`}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {step.done ? (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-xs font-bold">✓</motion.span>
                        ) : (
                          <StepIcon className="h-3.5 w-3.5" />
                        )}
                      </motion.div>
                      <span className={`text-[10px] font-medium text-center leading-tight max-w-[72px] ${step.done ? 'text-accent' : 'text-muted-foreground'}`}>
                        {step.title}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Expandable details below */}
              <div className="mt-4 space-y-2">
                {providerSteps.filter(s => !s.hidden && !s.done).slice(0, 1).map((step) => (
                  <motion.div
                    key={step.number}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-3 rounded-xl border border-accent/20 bg-accent/5 p-3"
                  >
                    <step.icon className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-bold text-foreground">{step.title}</h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{step.description}</p>
                      <button onClick={step.action} className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-accent hover:underline">
                        {step.actionLabel} <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* Lote 4 — Frescor & Inteligência (sem duplicar widgets já exibidos acima) */}
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

      {/* Tour guiado de 3 passos para tier "novato" — respeita dismiss server-side */}
      <DashboardTour />
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
