import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';

const AdminStatsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [providersByStatus, setProvidersByStatus] = useState<Record<string, number>>({});
  const [providersByCity, setProvidersByCity] = useState<{ city: string; count: number }[]>([]);
  const [providersByCategory, setProvidersByCategory] = useState<{ name: string; count: number }[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      // Providers by status
      const { data: allProviders } = await supabase.from('providers').select('status, city, categories(name)');
      const statusCount: Record<string, number> = {};
      allProviders?.forEach(p => { statusCount[p.status] = (statusCount[p.status] || 0) + 1; });
      setProvidersByStatus(statusCount);

      // Providers by city and category - reuse allProviders
      const cities: Record<string, number> = {};
      const cats: Record<string, number> = {};
      allProviders?.forEach(p => {
        if (p.city) cities[p.city] = (cities[p.city] || 0) + 1;
        const catName = (p.categories as any)?.name;
        if (catName) cats[catName] = (cats[catName] || 0) + 1;
      });
      setProvidersByCity(
        Object.entries(cities).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count).slice(0, 10)
      );
      setProvidersByCategory(
        Object.entries(cats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
      );

      // Recent leads
      const { data: leads } = await supabase.from('leads')
        .select('*, providers:provider_id(business_name, city)')
        .order('created_at', { ascending: false }).limit(10);
      setRecentLeads(leads || []);
    };

    fetchData();
  }, [isAdmin]);

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Estatísticas</h1>
      <p className="mt-1 text-sm text-muted-foreground">Métricas detalhadas da plataforma</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Providers by status */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-display text-sm font-bold text-foreground">Prestadores por Status</h3>
          <div className="mt-4 space-y-3">
            {Object.entries(providersByStatus).map(([status, count]) => {
              const total = Object.values(providersByStatus).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? (count / total) * 100 : 0;
              const colors: Record<string, string> = {
                approved: 'bg-green-500', pending: 'bg-amber-500', rejected: 'bg-red-500',
              };
              return (
                <div key={status}>
                  <div className="flex justify-between text-xs">
                    <span className="capitalize text-foreground">{status === 'approved' ? 'Aprovados' : status === 'pending' ? 'Pendentes' : 'Rejeitados'}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className={`h-2 rounded-full ${colors[status] || 'bg-accent'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Providers by category */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-display text-sm font-bold text-foreground">Prestadores por Categoria</h3>
          <div className="mt-4 space-y-2">
            {providersByCategory.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
            {providersByCategory.map(c => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{c.name}</span>
                <span className="rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent">{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top cities */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-display text-sm font-bold text-foreground">Top Cidades</h3>
          <div className="mt-4 space-y-2">
            {providersByCity.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
            {providersByCity.map((c, i) => (
              <div key={c.city} className="flex items-center justify-between text-xs">
                <span className="text-foreground">
                  <span className="mr-2 text-muted-foreground">{i + 1}.</span>{c.city}
                </span>
                <span className="text-muted-foreground">{c.count} profissional(is)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent leads */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-display text-sm font-bold text-foreground">Leads Recentes</h3>
          <div className="mt-4 space-y-3">
            {recentLeads.length === 0 && <p className="text-xs text-muted-foreground">Nenhum lead ainda</p>}
            {recentLeads.map(l => (
              <div key={l.id} className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-medium text-foreground">{l.client_name}</span>
                  <span className="text-muted-foreground"> → {(l.providers as any)?.business_name || '—'}</span>
                </div>
                <span className="text-muted-foreground">{new Date(l.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminStatsPage;
