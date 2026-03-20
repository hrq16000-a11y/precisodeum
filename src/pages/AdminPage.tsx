import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '@/components/AdminLayout';
import { Users, Briefcase, MessageSquare, FolderOpen, Star, TrendingUp, ClipboardList, Megaphone, Eye, MousePointerClick } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

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

const AdminPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [stats, setStats] = useState<Stats>({
    totalProviders: 0, pendingProviders: 0, totalProfiles: 0,
    totalLeads: 0, totalReviews: 0, totalCategories: 0,
    totalJobs: 0, pendingJobs: 0, totalSponsors: 0,
    totalImpressions: 0, totalClicks: 0,
  });
  const [pendingJobsList, setPendingJobsList] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchStats = async () => {
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

      // Fetch pending jobs for approval queue
      const { data: pJobs } = await (supabase
        .from('jobs')
        .select('id, title, city, created_at') as any)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);
      setPendingJobsList(pJobs || []);
    };
    fetchStats();
  }, [isAdmin]);

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  const handleApproveJob = async (id: string) => {
    await supabase.from('jobs').update({ approval_status: 'approved' } as any).eq('id', id);
    setPendingJobsList((prev) => prev.filter((j) => j.id !== id));
    setStats((prev) => ({ ...prev, pendingJobs: prev.pendingJobs - 1 }));
  };

  const handleRejectJob = async (id: string) => {
    await supabase.from('jobs').update({ approval_status: 'rejected', status: 'inactive' } as any).eq('id', id);
    setPendingJobsList((prev) => prev.filter((j) => j.id !== id));
    setStats((prev) => ({ ...prev, pendingJobs: prev.pendingJobs - 1 }));
  };

  const statCards = [
    { label: 'Total Profissionais', value: stats.totalProviders, icon: Briefcase, color: 'text-blue-500' },
    { label: 'Aguardando Aprovação', value: stats.pendingProviders, icon: TrendingUp, color: 'text-amber-500' },
    { label: 'Total Usuários', value: stats.totalProfiles, icon: Users, color: 'text-green-500' },
    { label: 'Total Leads', value: stats.totalLeads, icon: MessageSquare, color: 'text-purple-500' },
    { label: 'Total Avaliações', value: stats.totalReviews, icon: Star, color: 'text-orange-500' },
    { label: 'Categorias', value: stats.totalCategories, icon: FolderOpen, color: 'text-teal-500' },
    { label: 'Total Vagas', value: stats.totalJobs, icon: ClipboardList, color: 'text-indigo-500' },
    { label: 'Patrocinadores', value: stats.totalSponsors, icon: Megaphone, color: 'text-pink-500' },
  ];

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Painel Administrativo</h1>
      <p className="mt-1 text-sm text-muted-foreground">Visão geral da plataforma</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <s.icon className={`h-5 w-5 ${s.color}`} />
            <p className="mt-3 font-display text-2xl font-bold text-foreground">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Sponsor Metrics */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-bold text-foreground">📊 Métricas de Patrocinadores</h2>
        <div className="mt-3 flex gap-6">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Impressões totais:</span>
            <span className="font-bold text-foreground">{stats.totalImpressions.toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Cliques totais:</span>
            <span className="font-bold text-foreground">{stats.totalClicks.toLocaleString('pt-BR')}</span>
          </div>
          {stats.totalImpressions > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">CTR:</span>
              <span className="font-bold text-accent">{((stats.totalClicks / stats.totalImpressions) * 100).toFixed(2)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {stats.pendingProviders > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            ⚠️ {stats.pendingProviders} prestador(es) aguardando aprovação.{' '}
            <Link to="/admin/prestadores" className="underline">Revisar agora →</Link>
          </p>
        </div>
      )}

      {/* Pending Jobs Approval Queue */}
      {pendingJobsList.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20">
          <h2 className="font-display text-lg font-bold text-amber-800 dark:text-amber-200">
            📋 Vagas Aguardando Aprovação ({stats.pendingJobs})
          </h2>
          <div className="mt-3 space-y-2">
            {pendingJobsList.map((job) => (
              <div key={job.id} className="flex items-center justify-between rounded-lg border border-amber-300 bg-white p-3 dark:border-amber-700 dark:bg-amber-950/30">
                <div>
                  <h3 className="text-sm font-medium text-foreground">{job.title}</h3>
                  <p className="text-xs text-muted-foreground">{job.city} · {new Date(job.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="accent" onClick={() => handleApproveJob(job.id)}>Aprovar</Button>
                  <Button size="sm" variant="outline" onClick={() => handleRejectJob(job.id)}>Rejeitar</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminPage;
