import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Briefcase, User, ArrowRight, Users, Settings, PlusCircle, Megaphone, Layout, Star, MessageSquare, Eye, ChevronDown, ChevronUp, TrendingUp, Sparkles, Zap, Camera, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSettingValue, useFeatureEnabled } from '@/hooks/useSiteSettings';
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
import { usePermissions } from '@/hooks/usePermissions';
import GlassCard from '@/components/ui/GlassCard';
import ProgressRing from '@/components/ui/ProgressRing';
import ServiceWizard from '@/components/dashboard/ServiceWizard';
import ActionQueue from '@/components/dashboard/ActionQueue';
import UpsellBanner from '@/components/dashboard/UpsellBanner';
import CoursesBanner from '@/components/dashboard/CoursesBanner';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const DashboardPage = () => {
  const { user, profile, provider, loading } = useAuth();
  const navigate = useNavigate();
  const whatsappGroupUrl = useSettingValue('whatsapp_group_url');
  const wizardEnabled = useFeatureEnabled('enable_service_wizard_onboarding');
  const { levelName, levelColor, accountTypeName, accountTypeColor } = usePermissions();
  const [servicesCount, setServicesCount] = useState<number | null>(null);
  const [leadsCount, setLeadsCount] = useState<number>(0);
  const [jobsCount, setJobsCount] = useState<number>(0);
  const [portfolioCount, setPortfolioCount] = useState<number>(0);
  const [viewsTotal, setViewsTotal] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [guideOpen, setGuideOpen] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => navigate('/login', { replace: true }), 200);
      return () => clearTimeout(timer);
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!provider) return;
    (async () => {
      const albumsRes = await supabase.from('portfolio_albums').select('id').eq('provider_id', provider.id);
      const albumIds = (albumsRes.data || []).map(a => a.id);
      const [sRes, lRes, pRes, rRes] = await Promise.all([
        supabase.from('services').select('id, view_count', { count: 'exact' }).eq('provider_id', provider.id),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id),
        albumIds.length > 0
          ? supabase.from('portfolio_photos').select('id', { count: 'exact', head: true }).in('album_id', albumIds)
          : Promise.resolve({ count: 0 } as any),
        supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id),
      ]);
      setServicesCount(sRes.count ?? 0);
      setLeadsCount(lRes.count ?? 0);
      setPortfolioCount(pRes.count ?? 0);
      const totalViews = (sRes.data || []).reduce((acc: number, s: any) => acc + (s.view_count || 0), 0);
      setViewsTotal(totalViews);
      setReviewCount(rRes.count ?? 0);
    })();
  }, [provider]);

  useEffect(() => {
    if (!user) return;
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setJobsCount(count ?? 0));
  }, [user]);

  // Fetch categories for ServiceWizard
  useEffect(() => {
    supabase.from('categories').select('id, name, slug, icon').order('name')
      .then(({ data }) => setCategories(data || []));
  }, []);

  const profileType = profile?.profile_type || 'client';
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

  // ---- CLIENT DASHBOARD ----
  if (isClient) {
    return (
      <DashboardLayout>
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
      </DashboardLayout>
    );
  }

  // ---- RH DASHBOARD ----
  if (isRH) {
    return (
      <DashboardLayout>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <motion.div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity }}
          >
            <Megaphone className="h-5 w-5 text-purple-600" />
          </motion.div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Painel RH</h1>
            <p className="text-sm text-muted-foreground">Gerencie vagas e recrutamento</p>
          </div>
        </motion.div>

        <GlassCard variant="gradient" className="mt-6 border-purple-200 dark:border-purple-800">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Conta Agência / RH</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Publique vagas com auto-aprovação, acesse perfis de profissionais e gerencie processos seletivos.
              </p>
            </div>
          </div>
        </GlassCard>

        <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Megaphone, title: 'Minhas Vagas', desc: 'Gerencie suas vagas publicadas', path: '/dashboard/vagas', count: jobsCount, countLabel: 'vaga', action: 'Publicar nova vaga' },
            { icon: Eye, title: 'Buscar Profissionais', desc: 'Encontre profissionais para suas vagas', path: '/buscar' },
            { icon: Users, title: 'Comunidade', desc: 'Conecte-se com a comunidade', path: '/dashboard/comunidade' },
          ].map((item, i) => (
            <GlassCard key={item.path} variant="default" delay={0.1 + i * 0.1} className="cursor-pointer" onClick={() => navigate(item.path)}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  {item.count && item.count > 0 && <span className="inline-block mt-1 text-xs font-medium text-accent">{item.count} {item.countLabel}{item.count !== 1 ? 's' : ''}</span>}
                </div>
              </div>
              {item.action && (
                <button onClick={(e) => { e.stopPropagation(); navigate(item.path); }}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                  <PlusCircle className="h-3.5 w-3.5" /> {item.action}
                </button>
              )}
            </GlassCard>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  // ---- PROVIDER DASHBOARD ----
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
      action: servicesDone ? () => navigate('/dashboard/servicos') : (wizardEnabled ? () => setWizardOpen(true) : () => navigate('/dashboard/servicos')),
      actionLabel: servicesDone ? 'Meus Serviços' : 'Criar primeiro serviço',
      icon: Briefcase,
      done: servicesDone,
    },
    {
      number: '3',
      title: 'Personalize sua página',
      description: 'Configure sua landing page profissional — escolha temas, cores e adicione portfólio.',
      action: () => navigate('/dashboard/minha-pagina'),
      actionLabel: 'Minha Página',
      icon: Layout,
      done: false,
    },
    {
      number: '4',
      title: 'Entre no grupo do WhatsApp',
      description: 'Participe do nosso grupo exclusivo para profissionais.',
      action: () => whatsappGroupUrl && window.open(whatsappGroupUrl, '_blank'),
      actionLabel: 'Entrar no Grupo',
      icon: Users,
      done: false,
      hidden: !whatsappGroupUrl,
    },
  ];

  const allStepsDone = profileDone && servicesDone;

  // Profile completeness percentage
  const completenessItems = [profileDone, servicesDone, portfolioCount > 0, !!provider?.photo_url];
  const completenessPercent = Math.round((completenessItems.filter(Boolean).length / completenessItems.length) * 100);

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
      {/* Enhanced Welcome Hero */}
      <WelcomeHero
        greeting={greeting}
        name={profile?.full_name?.split(' ')[0] || 'Profissional'}
        pendingLeads={pendingLeads}
        levelName={levelName}
        levelColor={levelColor}
        accountTypeName={accountTypeName}
        accountTypeColor={accountTypeColor}
        memberSince={profile?.created_at}
        plan={provider?.plan}
        avatarUrl={profile?.avatar_url || undefined}
      />

      {/* Avatar Reminder */}
      <div className="mt-4">
        <AvatarReminder avatarUrl={profile?.avatar_url} />
      </div>

      {/* Upsell Banner */}
      <div className="mt-4">
        <UpsellBanner />
      </div>

      <QuickStatsBar pendingLeads={pendingLeads} providerSlug={provider?.slug} />

      {/* Action Queue — what to do next */}
      <div className="mt-4">
        <ActionQueue />
      </div>
      {/* Dominant CTA when no services */}
      <AnimatePresence>
        {servicesCount !== null && servicesCount === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 rounded-2xl border-2 border-accent bg-gradient-to-r from-accent/10 via-accent/5 to-transparent p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 relative overflow-hidden"
          >
            <div className="absolute inset-0 shimmer opacity-20" />
            <motion.div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <PlusCircle className="h-6 w-6" />
            </motion.div>
            <div className="flex-1 relative">
              <h2 className="text-base font-bold text-foreground">Crie seu primeiro serviço!</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Publique seus serviços para que clientes possam encontrá-lo.</p>
            </div>
            <Button variant="accent" size="sm" onClick={() => wizardEnabled ? setWizardOpen(true) : navigate('/dashboard/servicos')} className="shrink-0 relative">
              <PlusCircle className="mr-1 h-4 w-4" /> Criar Serviço
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats with animated counters */}
      <div className="mt-5">
        <StatCardGrid cards={statCards} />
      </div>

      {/* Analytics Grid: Completeness + Chart + Conversion + Activity */}
      {provider && (
        <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-2">
          <GlassCard variant="gradient" hoverEffect={false} delay={0.3}>
            <div className="flex items-center gap-4">
              <ProgressRing value={completenessPercent} size={80} label="Perfil" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground">Completude do Perfil</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {completenessPercent < 100
                    ? 'Complete seu perfil para aparecer no topo dos resultados.'
                    : '🎉 Perfil completo! Você está no máximo destaque.'}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <ProfileCompleteness
                provider={provider}
                profile={profile}
                servicesCount={servicesCount ?? 0}
                portfolioCount={portfolioCount}
              />
            </div>
          </GlassCard>

          <GlassCard variant="default" hoverEffect={false} delay={0.4}>
            <LeadsChart providerId={provider.id} />
          </GlassCard>

          <GlassCard variant="default" hoverEffect={false} delay={0.5}>
            <ConversionInsights views={viewsTotal} leads={leadsCount} services={servicesCount ?? 0} />
          </GlassCard>

          <GlassCard variant="bordered" hoverEffect={false} delay={0.6}>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" />
              Atividade Recente
            </h3>
            <RecentActivity providerId={provider.id} />
          </GlassCard>

          <div className="lg:col-span-2">
            <DashboardTipOfDay
              servicesCount={servicesCount ?? 0}
              portfolioCount={portfolioCount}
              leadsCount={leadsCount}
              reviewCount={reviewCount}
            />
          </div>
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
          <GlassCard variant="default" delay={0.5} className="cursor-pointer" onClick={() => navigate('/dashboard/servicos')}>
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

          <GlassCard variant="default" delay={0.6} className="cursor-pointer" onClick={() => navigate('/dashboard/vagas')}>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Megaphone className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground">Vagas</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Visualize e publique oportunidades</p>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); navigate('/dashboard/vagas'); }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
              <PlusCircle className="h-3.5 w-3.5" /> Publicar vaga
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

      {/* Service Wizard Modal — onboarding only */}
      {provider && user && (
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <DialogContent className="max-w-lg p-0 gap-0 overflow-y-auto max-h-[90vh]">
            <div className="p-5">
              <ServiceWizard
                providerId={provider.id}
                userId={user.id}
                provider={provider}
                categories={categories}
                onComplete={() => {
                  setWizardOpen(false);
                  setServicesCount(prev => (prev ?? 0) + 1);
                }}
                onCancel={() => setWizardOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
};

export default DashboardPage;
