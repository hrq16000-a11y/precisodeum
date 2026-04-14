import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '@/components/AdminLayout';
import { Users, Briefcase, MessageSquare, FolderOpen, Star, TrendingUp, ClipboardList, Megaphone, Eye, MousePointerClick, CheckCircle, XCircle, ArrowRight, Activity, Zap, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import GlassCard from '@/components/ui/GlassCard';
import ProgressRing from '@/components/ui/ProgressRing';
import AdminHealthMonitor from '@/components/admin/AdminHealthMonitor';
import AdminQuickActions from '@/components/admin/AdminQuickActions';
import AdminPlatformPulse from '@/components/admin/AdminPlatformPulse';
import AdminGrowthChart from '@/components/admin/AdminGrowthChart';
import AdminKpiBar from '@/components/admin/AdminKpiBar';

interface Stats {
  totalProviders: number;
  pendingProviders: number;
  totalProfiles: number;
  totalLeads: number;
  totalReviews: number;
  totalCategories: number;
  totalJobs: number;
  pendingJobs: number;
  totalSponsors: number;
  totalImpressions: number;
  totalClicks: number;
}

interface FeaturedDiag {
  approvedFeatured: number;
  withService: number;
  withServiceImage: number;
  withPortfolio: number;
  withImageOrPortfolio: number;
  withBoth: number;
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const AdminPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [stats, setStats] = useState<Stats>({
    totalProviders: 0, pendingProviders: 0, totalProfiles: 0,
    totalLeads: 0, totalReviews: 0, totalCategories: 0,
    totalJobs: 0, pendingJobs: 0, totalSponsors: 0,
    totalImpressions: 0, totalClicks: 0,
  });
  const [pendingJobsList, setPendingJobsList] = useState<any[]>([]);
  const [pendingProvidersList, setPendingProvidersList] = useState<any[]>([]);
  const [featuredDiag, setFeaturedDiag] = useState<FeaturedDiag | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchAll = async () => {
      const [providers, pending, profiles, leads, reviews, categories, jobs, pendingJ, sponsors] = await Promise.all([
        supabase.from('providers').select('id', { count: 'exact', head: true }),
        supabase.from('providers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('reviews').select('id', { count: 'exact', head: true }),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('jobs').select('id', { count: 'exact', head: true }),
        (supabase.from('jobs').select('id', { count: 'exact', head: true }) as any).eq('approval_status', 'pending'),
        supabase.from('sponsors').select('impressions, clicks'),
      ]);

      const sponsorData = (sponsors.data || []) as any[];
      const totalImpressions = sponsorData.reduce((sum, s) => sum + (s.impressions || 0), 0);
      const totalClicks = sponsorData.reduce((sum, s) => sum + (s.clicks || 0), 0);

      setStats({
        totalProviders: providers.count || 0,
        pendingProviders: pending.count || 0,
        totalProfiles: profiles.count || 0,
        totalLeads: leads.count || 0,
        totalReviews: reviews.count || 0,
        totalCategories: categories.count || 0,
        totalJobs: jobs.count || 0,
        pendingJobs: pendingJ.count || 0,
        totalSponsors: sponsorData.length,
        totalImpressions,
        totalClicks,
      });

      const { data: pJobs } = await (supabase.from('jobs').select('id, title, city, created_at, user_id') as any)
        .eq('approval_status', 'pending').order('created_at', { ascending: false }).limit(10);
      setPendingJobsList(pJobs || []);

      const { data: pProviders } = await supabase.from('providers').select('id, business_name, city, created_at, user_id, profiles!inner(full_name)')
        .eq('status', 'pending').order('created_at', { ascending: false }).limit(10);
      setPendingProvidersList(pProviders || []);

      // Featured diagnostics
      const [featuredRes, servicesAllRes] = await Promise.all([
        supabase.from('providers').select('id, user_id').eq('status', 'approved').eq('featured', true),
        supabase.from('services').select('id, provider_id, service_images(id)'),
      ]);
      const featuredProvs = featuredRes.data || [];
      const allSvcs = servicesAllRes.data || [];
      const provsWithService = new Set<string>();
      const provsWithServiceImage = new Set<string>();
      allSvcs.forEach((s: any) => {
        provsWithService.add(s.provider_id);
        const imgs = Array.isArray(s.service_images) ? s.service_images : [];
        if (imgs.length > 0) provsWithServiceImage.add(s.provider_id);
      });
      const featuredIds = new Set(featuredProvs.map((p: any) => p.id));
      const featuredUserIds = featuredProvs.map((p: any) => p.user_id);
      const portfolioChecks = await Promise.all(
        featuredUserIds.map(async (uid: string) => {
          try {
            const { data: files } = await supabase.storage.from('portfolio').list(uid, { limit: 1 });
            return files && files.some((f: any) => f.name !== '.emptyFolderPlaceholder') ? uid : null;
          } catch { return null; }
        })
      );
      const portfolioUserSet = new Set(portfolioChecks.filter(Boolean));
      const portfolioProviderSet = new Set(
        featuredProvs.filter((p: any) => portfolioUserSet.has(p.user_id)).map((p: any) => p.id)
      );

      let withSvc = 0, withSvcImg = 0, withPort = 0, withImgOrPort = 0, withBoth = 0;
      featuredProvs.forEach((p: any) => {
        const hasSvc = provsWithService.has(p.id);
        const hasImg = provsWithServiceImage.has(p.id);
        const hasPort = portfolioProviderSet.has(p.id);
        if (hasSvc) withSvc++;
        if (hasImg) withSvcImg++;
        if (hasPort) withPort++;
        if (hasImg || hasPort) withImgOrPort++;
        if (hasImg && hasPort) withBoth++;
      });
      setFeaturedDiag({
        approvedFeatured: featuredProvs.length,
        withService: withSvc,
        withServiceImage: withSvcImg,
        withPortfolio: withPort,
        withImageOrPortfolio: withImgOrPort,
        withBoth,
      });
    };
    fetchAll();
  }, [isAdmin]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-1/3 rounded-lg bg-muted" />
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-muted" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  const handleApproveJob = async (id: string) => {
    await supabase.from('jobs').update({ approval_status: 'approved' } as any).eq('id', id);
    setPendingJobsList(prev => prev.filter(j => j.id !== id));
    setStats(prev => ({ ...prev, pendingJobs: prev.pendingJobs - 1 }));
    toast.success('Vaga aprovada');
  };

  const handleRejectJob = async (id: string) => {
    await supabase.from('jobs').update({ approval_status: 'rejected', status: 'inactive' } as any).eq('id', id);
    setPendingJobsList(prev => prev.filter(j => j.id !== id));
    setStats(prev => ({ ...prev, pendingJobs: prev.pendingJobs - 1 }));
    toast.success('Vaga rejeitada');
  };

  const handleApproveProvider = async (id: string) => {
    await supabase.from('providers').update({ status: 'approved' }).eq('id', id);
    setPendingProvidersList(prev => prev.filter(p => p.id !== id));
    setStats(prev => ({ ...prev, pendingProviders: prev.pendingProviders - 1 }));
    toast.success('Prestador aprovado');
  };

  const handleRejectProvider = async (id: string) => {
    await supabase.from('providers').update({ status: 'rejected' }).eq('id', id);
    setPendingProvidersList(prev => prev.filter(p => p.id !== id));
    setStats(prev => ({ ...prev, pendingProviders: prev.pendingProviders - 1 }));
    toast.success('Prestador rejeitado');
  };

  const hasPending = pendingJobsList.length > 0 || pendingProvidersList.length > 0;

  const statCards = [
    { label: 'Profissionais', value: stats.totalProviders, icon: Briefcase, gradient: 'from-blue-500/10 to-blue-600/5', iconBg: 'bg-blue-500/15', iconColor: 'text-blue-500' },
    { label: 'Pendentes', value: stats.pendingProviders, icon: TrendingUp, gradient: 'from-amber-500/10 to-amber-600/5', iconBg: 'bg-amber-500/15', iconColor: 'text-amber-500', alert: stats.pendingProviders > 0 },
    { label: 'Usuários', value: stats.totalProfiles, icon: Users, gradient: 'from-emerald-500/10 to-emerald-600/5', iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-500' },
    { label: 'Leads', value: stats.totalLeads, icon: MessageSquare, gradient: 'from-purple-500/10 to-purple-600/5', iconBg: 'bg-purple-500/15', iconColor: 'text-purple-500' },
    { label: 'Avaliações', value: stats.totalReviews, icon: Star, gradient: 'from-orange-500/10 to-orange-600/5', iconBg: 'bg-orange-500/15', iconColor: 'text-orange-500' },
    { label: 'Categorias', value: stats.totalCategories, icon: FolderOpen, gradient: 'from-teal-500/10 to-teal-600/5', iconBg: 'bg-teal-500/15', iconColor: 'text-teal-500' },
    { label: 'Vagas', value: stats.totalJobs, icon: ClipboardList, gradient: 'from-indigo-500/10 to-indigo-600/5', iconBg: 'bg-indigo-500/15', iconColor: 'text-indigo-500' },
    { label: 'Patrocinadores', value: stats.totalSponsors, icon: Megaphone, gradient: 'from-pink-500/10 to-pink-600/5', iconBg: 'bg-pink-500/15', iconColor: 'text-pink-500' },
  ];

  const ctr = stats.totalImpressions > 0 ? (stats.totalClicks / stats.totalImpressions) * 100 : 0;

  return (
    <AdminLayout>
      {/* Header with gradient accent */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative"
      >
        <div className="absolute -top-4 -left-4 -right-4 h-32 bg-gradient-to-br from-primary/5 via-accent/3 to-transparent rounded-3xl -z-10" />
        <div className="flex items-center gap-3">
          <motion.div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Zap className="h-5 w-5 text-primary" />
          </motion.div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Painel Administrativo</h1>
            <p className="text-sm text-muted-foreground">Visão geral da plataforma em tempo real</p>
          </div>
        </div>
      </motion.div>

      {/* KPI Trend Bar */}
      <div className="mt-5">
        <AdminKpiBar />
      </div>

      {/* Quick Actions */}
      <div className="mt-4">
        <AdminQuickActions />
      </div>

      {/* Health Monitor + Platform Pulse + Growth */}
      <div className="mt-5 grid gap-4 grid-cols-1 lg:grid-cols-3">
        <AdminHealthMonitor />
        <AdminPlatformPulse />
        <AdminGrowthChart />
      </div>

      {/* Pending queues */}
      <AnimatePresence>
        {hasPending && (
          <motion.div
            className="mt-6 space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5 }}
          >
            {pendingJobsList.length > 0 && (
              <GlassCard variant="bordered" hoverEffect={false} className="border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-900/10">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent shimmer" />
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>📋</motion.span>
                    Vagas Aguardando ({stats.pendingJobs})
                  </h2>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/admin/vagas" className="text-amber-700">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {pendingJobsList.map((job, i) => (
                      <motion.div
                        key={job.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20, height: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-background/80 backdrop-blur-sm p-3 dark:border-amber-800"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium text-foreground truncate">{job.title}</h3>
                          <p className="text-xs text-muted-foreground">{job.city} · {new Date(job.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex flex-col gap-1 ml-2 shrink-0 sm:flex-row">
                          <Button size="sm" variant="accent" onClick={() => handleApproveJob(job.id)} className="transition-transform active:scale-95">
                            <CheckCircle className="mr-1 h-3 w-3" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleRejectJob(job.id)} className="transition-transform active:scale-95">
                            <XCircle className="mr-1 h-3 w-3" /> Rejeitar
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </GlassCard>
            )}

            {pendingProvidersList.length > 0 && (
              <GlassCard variant="bordered" hoverEffect={false} delay={0.1} className="border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400/60 to-transparent shimmer" />
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                    <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}>👤</motion.span>
                    Prestadores Aguardando ({stats.pendingProviders})
                  </h2>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/admin/prestadores" className="text-blue-700">Ver todos <ArrowRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {pendingProvidersList.map((p, i) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20, height: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        className="flex items-center justify-between rounded-xl border border-blue-200/60 bg-background/80 backdrop-blur-sm p-3 dark:border-blue-800"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium text-foreground truncate">{(p as any).profiles?.full_name || p.business_name || 'Sem nome'}</h3>
                          <p className="text-xs text-muted-foreground">{p.city} · {new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex flex-col gap-1 ml-2 shrink-0 sm:flex-row">
                          <Button size="sm" variant="accent" onClick={() => handleApproveProvider(p.id)} className="transition-transform active:scale-95">
                            <CheckCircle className="mr-1 h-3 w-3" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleRejectProvider(p.id)} className="transition-transform active:scale-95">
                            <XCircle className="mr-1 h-3 w-3" /> Rejeitar
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </GlassCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats grid with gradient cards and animated counters */}
      <motion.div
        className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            variants={itemVariants}
            whileHover={{ y: -6, scale: 1.04, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.97 }}
            className={`group rounded-2xl border border-border bg-gradient-to-br ${s.gradient} p-4 shadow-card transition-shadow hover:shadow-card-hover relative overflow-hidden ${s.alert ? 'ring-2 ring-amber-300/50 dark:ring-amber-700/50' : ''}`}
          >
            {/* Shimmer on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            
            <div className="flex items-center justify-between relative">
              <div className={`rounded-xl ${s.iconBg} p-2 transition-transform group-hover:scale-110 duration-300`}>
                <s.icon className={`h-4 w-4 ${s.iconColor}`} />
              </div>
              {s.alert && (
                <span className="flex h-2.5 w-2.5">
                  <span className="animate-ping absolute h-2.5 w-2.5 rounded-full bg-amber-400 opacity-75" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-amber-500" />
                </span>
              )}
            </div>
            <div className="mt-3 relative">
              <AnimatedCounter value={s.value} className="font-display text-2xl font-bold text-foreground" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Sponsor Metrics — enhanced with progress ring */}
      <GlassCard variant="gradient" delay={0.4} className="mt-6" hoverEffect={false}>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/20 via-accent/40 to-primary/20" />
        <div className="flex items-center gap-2 mb-4">
          <div className="rounded-xl bg-accent/10 p-2">
            <BarChart3 className="h-5 w-5 text-accent" />
          </div>
          <h2 className="font-display text-base font-bold text-foreground">Métricas de Patrocinadores</h2>
        </div>
        <div className="flex flex-wrap items-center gap-8">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Impressões</span>
            </div>
            <AnimatedCounter value={stats.totalImpressions} className="text-xl font-bold text-foreground" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Cliques</span>
            </div>
            <AnimatedCounter value={stats.totalClicks} className="text-xl font-bold text-foreground" />
          </div>
          {stats.totalImpressions > 0 && (
            <ProgressRing value={ctr} size={72} label="CTR" color="hsl(var(--accent))" />
          )}
        </div>
      </GlassCard>

      {/* Featured Diagnostics — enhanced */}
      {featuredDiag && (
        <GlassCard variant="default" delay={0.5} className="mt-6" hoverEffect={false}>
          <div className="flex items-center gap-3 mb-4">
            <motion.div
              className="rounded-xl bg-accent/10 p-2"
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            >
              <Activity className="h-5 w-5 text-accent" />
            </motion.div>
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Diagnóstico dos Destaques</h2>
              <p className="text-[11px] text-muted-foreground">
                Profissionais com <strong>imagem ou portfólio</strong> aparecem na home
              </p>
            </div>
          </div>
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {[
              { label: 'Aprovados + Featured', value: featuredDiag.approvedFeatured, color: 'text-foreground', bg: 'from-muted/50 to-muted/30' },
              { label: 'Com serviço', value: featuredDiag.withService, color: 'text-blue-500', bg: 'from-blue-500/10 to-blue-500/5' },
              { label: 'Com imagem', value: featuredDiag.withServiceImage, color: 'text-emerald-500', bg: 'from-emerald-500/10 to-emerald-500/5' },
              { label: 'Com portfólio', value: featuredDiag.withPortfolio, color: 'text-purple-500', bg: 'from-purple-500/10 to-purple-500/5' },
              { label: '✅ Elegíveis', value: featuredDiag.withImageOrPortfolio, color: 'text-accent', bg: 'from-accent/10 to-accent/5' },
              { label: 'Ambos (img+port)', value: featuredDiag.withBoth, color: 'text-orange-500', bg: 'from-orange-500/10 to-orange-500/5' },
            ].map(item => (
              <motion.div
                key={item.label}
                variants={itemVariants}
                whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
                className={`rounded-xl border border-border bg-gradient-to-br ${item.bg} p-3 transition-shadow hover:shadow-card`}
              >
                <AnimatedCounter value={item.value} className={`font-display text-xl font-bold ${item.color}`} />
                <p className="text-[11px] text-muted-foreground leading-tight mt-1">{item.label}</p>
              </motion.div>
            ))}
          </motion.div>
          {featuredDiag.withImageOrPortfolio < 5 && (
            <motion.p
              className="mt-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              ⚠️ Menos de 5 elegíveis — considere adicionar imagens/portfólios.
            </motion.p>
          )}
        </GlassCard>
      )}
    </AdminLayout>
  );
};

export default AdminPage;
