import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Users, Briefcase, MessageSquare, FolderOpen, Star, TrendingUp } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';

interface Stats {
  totalProviders: number;
  pendingProviders: number;
  totalProfiles: number;
  totalLeads: number;
  totalReviews: number;
  totalCategories: number;
}

const AdminPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [stats, setStats] = useState<Stats>({
    totalProviders: 0, pendingProviders: 0, totalProfiles: 0,
    totalLeads: 0, totalReviews: 0, totalCategories: 0,
  });

  useEffect(() => {
    if (!isAdmin) return;
    const fetchStats = async () => {
      const [providers, pending, profiles, leads, reviews, categories] = await Promise.all([
        supabase.from('providers').select('id', { count: 'exact', head: true }),
        supabase.from('providers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('reviews').select('id', { count: 'exact', head: true }),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        totalProviders: providers.count || 0,
        pendingProviders: pending.count || 0,
        totalProfiles: profiles.count || 0,
        totalLeads: leads.count || 0,
        totalReviews: reviews.count || 0,
        totalCategories: categories.count || 0,
      });
    };
    fetchStats();
  }, [isAdmin]);

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  const statCards = [
    { label: 'Total Profissionais', value: stats.totalProviders, icon: Briefcase, color: 'text-blue-500' },
    { label: 'Aguardando Aprovação', value: stats.pendingProviders, icon: TrendingUp, color: 'text-amber-500' },
    { label: 'Total Usuários', value: stats.totalProfiles, icon: Users, color: 'text-green-500' },
    { label: 'Total Leads', value: stats.totalLeads, icon: MessageSquare, color: 'text-purple-500' },
    { label: 'Total Avaliações', value: stats.totalReviews, icon: Star, color: 'text-orange-500' },
    { label: 'Categorias', value: stats.totalCategories, icon: FolderOpen, color: 'text-teal-500' },
  ];

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Painel Administrativo</h1>
      <p className="mt-1 text-sm text-muted-foreground">Visão geral da plataforma</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <s.icon className={`h-5 w-5 ${s.color}`} />
            <p className="mt-3 font-display text-2xl font-bold text-foreground">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {stats.pendingProviders > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            ⚠️ {stats.pendingProviders} prestador(es) aguardando aprovação.{' '}
            <a href="/admin/prestadores" className="underline">Revisar agora →</a>
          </p>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminPage;
