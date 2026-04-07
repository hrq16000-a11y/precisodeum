import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '@/components/AdminLayout';
import { Users, Briefcase, MessageSquare, FolderOpen, Star, TrendingUp, ClipboardList, Megaphone, Eye, MousePointerClick, CheckCircle, XCircle, ArrowRight, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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

      const { data: pProviders } = await supabase.from('providers').select('id, business_name, city, created_at, user_id')
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
              <div key={i} className="h-24 rounded-xl bg-muted" style={{ animationDelay: `${i * 80}ms` }} />
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
    { label: 'Profissionais', value: stats.totalProviders, icon: Briefcase, accent: 'border-l-blue-500', iconColor: 'text-blue-500' },
    { label: 'Pendentes', value: stats.pendingProviders, icon: TrendingUp, accent: 'border-l-amber-500', iconColor: 'text-amber-500', alert: stats.pendingProviders > 0 },
    { label: 'Usuários', value: stats.totalProfiles, icon: Users, accent: 'border-l-emerald-500', iconColor: 'text-emerald-500' },
    { label: 'Leads', value: stats.totalLeads, icon: MessageSquare, accent: 'border-l-purple-500', iconColor: 'text-purple-500' },
    { label: 'Avaliações', value: stats.totalReviews, icon: Star, accent: 'border-l-orange-500', iconColor: 'text-orange-500' },
    { label: 'Categorias', value: stats.totalCategories, icon: FolderOpen, accent: 'border-l-teal-500', iconColor: 'text-teal-500' },
    { label: 'Vagas', value: stats.totalJobs, icon: ClipboardList, accent: 'border-l-indigo-500', iconColor: 'text-indigo-500' },
    { label: 'Patrocinadores', value: stats.totalSponsors, icon: Megaphone, accent: 'border-l-pink-500', iconColor: 'text-pink-500' },
  ];

  return (
    <AdminLayout>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="font-display text-2xl font-bold text-foreground">Painel Administrativo</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visão geral da plataforma</p>
      </motion.div>

      {/* Pending queues — top priority */}
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
              <motion.div
                className="rounded-xl border-2 border-amber-300 bg-amber-50/50 p-5 dark:border-amber-700 dark:bg-amber-900/20 relative overflow-hidden"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent shimmer" />
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg font-bold text-amber-800 dark:text-amber-200">
                    📋 Vagas Aguardando ({stats.pendingJobs})
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
                        className="flex items-center justify-between rounded-lg border border-amber-200 bg-background p-3 dark:border-amber-800"
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
              </motion.div>
            )}

            {pendingProvidersList.length > 0 && (
              <motion.div
                className="rounded-xl border-2 border-blue-300 bg-blue-50/50 p-5 dark:border-blue-700 dark:bg-blue-900/20 relative overflow-hidden"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400/60 to-transparent shimmer" />
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg font-bold text-blue-800 dark:text-blue-200">
                    👤 Prestadores Aguardando ({stats.pendingProviders})
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
                        className="flex items-center justify-between rounded-lg border border-blue-200 bg-background p-3 dark:border-blue-800"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium text-foreground truncate">{p.business_name || 'Sem nome'}</h3>
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
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats grid */}
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
            whileHover={{ y: -4, scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={`rounded-xl border border-l-4 ${s.accent} bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover ${s.alert ? 'border-amber-300 dark:border-amber-700' : 'border-border'}`}
          >
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-muted/60 p-1.5">
                <s.icon className={`h-4 w-4 ${s.iconColor}`} />
              </div>
              {s.alert && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute h-2 w-2 rounded-full bg-amber-400 opacity-75" />
                  <span className="relative h-2 w-2 rounded-full bg-amber-500" />
                </span>
              )}
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Sponsor Metrics */}
      <motion.div
        className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card relative overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/20 via-accent/40 to-primary/20" />
        <h2 className="font-display text-base font-bold text-foreground mb-3">📊 Métricas de Patrocinadores</h2>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Impressões:</span>
            <span className="font-bold text-foreground">{stats.totalImpressions.toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Cliques:</span>
            <span className="font-bold text-foreground">{stats.totalClicks.toLocaleString('pt-BR')}</span>
          </div>
          {stats.totalImpressions > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">CTR:</span>
              <span className="font-bold text-accent">{((stats.totalClicks / stats.totalImpressions) * 100).toFixed(2)}%</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Featured Diagnostics */}
      {featuredDiag && (
        <motion.div
          className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}>
              <Activity className="h-5 w-5 text-accent" />
            </motion.div>
            <h2 className="font-display text-base font-bold text-foreground">Diagnóstico dos Destaques</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Regra atual: profissionais com <strong>imagem de serviço OU portfólio</strong> aparecem na home (3–5 aleatórios por carregamento).
          </p>
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {[
              { label: 'Aprovados + Featured', value: featuredDiag.approvedFeatured, color: 'text-foreground' },
              { label: 'Com serviço', value: featuredDiag.withService, color: 'text-blue-500' },
              { label: 'Com imagem no serviço', value: featuredDiag.withServiceImage, color: 'text-emerald-500' },
              { label: 'Com portfólio', value: featuredDiag.withPortfolio, color: 'text-purple-500' },
              { label: '✅ Elegíveis (img OU port)', value: featuredDiag.withImageOrPortfolio, color: 'text-accent' },
              { label: 'Com ambos (img + port)', value: featuredDiag.withBoth, color: 'text-orange-500' },
            ].map(item => (
              <motion.div
                key={item.label}
                variants={itemVariants}
                whileHover={{ scale: 1.05 }}
                className="rounded-lg border border-border bg-muted/30 p-3 transition-shadow hover:shadow-card"
              >
                <p className={`font-display text-xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-1">{item.label}</p>
              </motion.div>
            ))}
          </motion.div>
          {featuredDiag.withImageOrPortfolio < 5 && (
            <motion.p
              className="mt-3 text-xs text-amber-600 dark:text-amber-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              ⚠️ Apenas {featuredDiag.withImageOrPortfolio} perfis elegíveis — para melhorar a rotação, incentive profissionais a adicionarem imagens nos serviços ou portfólio.
            </motion.p>
          )}
        </motion.div>
      )}

      {/* Quick links */}
      <motion.div
        className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {[
          { label: 'Gerenciar Vagas', path: '/admin/vagas', icon: ClipboardList },
          { label: 'Patrocinadores', path: '/admin/patrocinadores', icon: Megaphone },
          { label: 'Blog / Notícias', path: '/admin/blog', icon: FolderOpen },
          { label: 'Configurações', path: '/admin/configuracoes', icon: TrendingUp },
        ].map(q => (
          <motion.div key={q.path} variants={itemVariants} whileHover={{ y: -3, scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link to={q.path} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-card-hover hover:border-accent/30">
              <div className="rounded-lg bg-accent/10 p-2">
                <q.icon className="h-5 w-5 text-accent" />
              </div>
              <span className="text-sm font-medium text-foreground">{q.label}</span>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </AdminLayout>
  );
};

export default AdminPage;
