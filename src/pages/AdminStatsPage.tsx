import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Users, Briefcase, Star, FileText, MapPin, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';

interface HealthStats {
  totalProviders: number;
  approvedProviders: number;
  pendingProviders: number;
  rejectedProviders: number;
  noImageProviders: number;
  noServiceProviders: number;
  noDescriptionProviders: number;
  featuredProviders: number;
  totalCategories: number;
  emptyCategories: number;
  totalServices: number;
  totalLeads: number;
  totalReviews: number;
  pendingReviews: number;
  totalJobs: number;
  totalBlogPosts: number;
  publishedBlogPosts: number;
  totalPages: number;
  publishedPages: number;
  totalMenuItems: number;
  totalBlocks: number;
  activeBlocks: number;
  totalSponsors: number;
  activeSponsors: number;
  providersByCity: { city: string; count: number }[];
  providersByCategory: { name: string; count: number }[];
  recentLeads: any[];
  leadsOverTime: { date: string; count: number }[];
  servicesOverTime: { date: string; count: number }[];
  providersOverTime: { date: string; count: number }[];
}

const CHART_COLORS = ['hsl(var(--accent))', 'hsl(var(--primary))', 'hsl(142 71% 45%)', 'hsl(38 92% 50%)', 'hsl(0 84% 60%)'];

const AdminStatsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [stats, setStats] = useState<HealthStats | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchAll = async () => {
      const [
        providersRes, servicesRes, leadsRes, reviewsRes, jobsRes, blogRes, pagesRes, menuRes, blocksRes, sponsorsRes, categoriesRes,
      ] = await Promise.all([
        supabase.from('providers').select('id, status, city, photo_url, description, featured, created_at, categories(name)'),
        supabase.from('services').select('id, provider_id, created_at'),
        supabase.from('leads').select('id, client_name, created_at, providers:provider_id(business_name, city)').order('created_at', { ascending: false }).limit(50),
        supabase.from('reviews').select('id, approval_status'),
        supabase.from('jobs').select('id').is('deleted_at', null),
        supabase.from('blog_posts').select('id, published').is('deleted_at', null),
        supabase.from('institutional_pages').select('id, published'),
        supabase.from('menu_items').select('id'),
        supabase.from('page_blocks').select('id, active'),
        supabase.from('sponsors').select('id, active').is('deleted_at', null),
        supabase.from('categories').select('id, name, slug').is('deleted_at', null),
      ]);

      const providers = providersRes.data || [];
      const services = servicesRes.data || [];
      const leads = leadsRes.data || [];
      const providerIdsWithServices = new Set(services.map(s => s.provider_id));
      const categoryProviderCount: Record<string, number> = {};
      const cityCount: Record<string, number> = {};

      let noImage = 0, noService = 0, noDesc = 0, approved = 0, pending = 0, rejected = 0, featured = 0;

      providers.forEach(p => {
        if (p.status === 'approved') approved++;
        else if (p.status === 'pending') pending++;
        else rejected++;
        if (!p.photo_url) noImage++;
        if (!providerIdsWithServices.has(p.id)) noService++;
        if (!p.description || p.description.length < 20) noDesc++;
        if (p.featured) featured++;
        if (p.city) cityCount[p.city] = (cityCount[p.city] || 0) + 1;
        const catName = (p.categories as any)?.name;
        if (catName) categoryProviderCount[catName] = (categoryProviderCount[catName] || 0) + 1;
      });

      const categories = categoriesRes.data || [];
      const emptyCats = categories.filter(c => !categoryProviderCount[c.name]);
      const reviews = reviewsRes.data || [];
      const blog = blogRes.data || [];
      const pages = pagesRes.data || [];
      const blocks = blocksRes.data || [];
      const sponsors = sponsorsRes.data || [];

      // Time-series aggregation helper
      const aggregateByDay = (items: any[], dateField = 'created_at') => {
        const map: Record<string, number> = {};
        items.forEach(item => {
          const d = new Date(item[dateField]);
          const key = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
          map[key] = (map[key] || 0) + 1;
        });
        return Object.entries(map).slice(-14).map(([date, count]) => ({ date, count }));
      };

      setStats({
        totalProviders: providers.length,
        approvedProviders: approved,
        pendingProviders: pending,
        rejectedProviders: rejected,
        noImageProviders: noImage,
        noServiceProviders: noService,
        noDescriptionProviders: noDesc,
        featuredProviders: featured,
        totalCategories: categories.length,
        emptyCategories: emptyCats.length,
        totalServices: services.length,
        totalLeads: leads.length,
        totalReviews: reviews.length,
        pendingReviews: reviews.filter(r => r.approval_status === 'pending').length,
        totalJobs: (jobsRes.data || []).length,
        totalBlogPosts: blog.length,
        publishedBlogPosts: blog.filter(b => b.published).length,
        totalPages: pages.length,
        publishedPages: pages.filter(p => p.published).length,
        totalMenuItems: (menuRes.data || []).length,
        totalBlocks: blocks.length,
        activeBlocks: blocks.filter(b => b.active).length,
        totalSponsors: sponsors.length,
        activeSponsors: sponsors.filter(s => s.active).length,
        providersByCity: Object.entries(cityCount).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count).slice(0, 10),
        providersByCategory: Object.entries(categoryProviderCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        recentLeads: leads.slice(0, 10),
        leadsOverTime: aggregateByDay(leads),
        servicesOverTime: aggregateByDay(services),
        providersOverTime: aggregateByDay(providers),
      });
    };

    fetchAll();
  }, [isAdmin]);

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  const s = stats;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <BarChart3 className="h-6 w-6" /> Estatísticas & Saúde
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Visão completa da plataforma com indicadores de saúde do conteúdo</p>

      {!s ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Prestadores" value={s.totalProviders} sub={`${s.approvedProviders} aprovados`} color="text-green-500" />
            <StatCard icon={Briefcase} label="Serviços" value={s.totalServices} sub={`${s.totalLeads} leads gerados`} color="text-blue-500" />
            <StatCard icon={Star} label="Avaliações" value={s.totalReviews} sub={`${s.pendingReviews} pendentes`} color="text-amber-500" />
            <StatCard icon={FileText} label="Conteúdo" value={s.totalBlogPosts + s.totalPages + s.totalBlocks} sub={`${s.totalJobs} vagas ativas`} color="text-purple-500" />
          </div>

          {/* Charts Row */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Leads over time */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4" /> Leads por Dia
                </h3>
                {s.leadsOverTime.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={s.leadsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="count" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: 'hsl(var(--accent))' }} name="Leads" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>

            {/* Provider Status Pie */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-display text-sm font-bold text-foreground mb-4">Status dos Prestadores</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Aprovados', value: s.approvedProviders },
                        { name: 'Pendentes', value: s.pendingProviders },
                        { name: 'Rejeitados', value: s.rejectedProviders },
                      ]}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                    >
                      <Cell fill="hsl(142 71% 45%)" />
                      <Cell fill="hsl(38 92% 50%)" />
                      <Cell fill="hsl(0 84% 60%)" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Cities Bar Chart */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                  <MapPin className="h-4 w-4" /> Top Cidades
                </h3>
                {s.providersByCity.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={s.providersByCity.slice(0, 8)} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                      <YAxis type="category" dataKey="city" width={100} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Prestadores" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>

            {/* Categories Bar Chart */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-display text-sm font-bold text-foreground mb-4">Prestadores por Categoria</h3>
                {s.providersByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={s.providersByCategory.slice(0, 8)} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} name="Prestadores" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>
          </div>

          {/* Health Alerts */}
          <div className="mt-6">
            <h2 className="font-display text-lg font-bold text-foreground mb-3">🏥 Saúde do Conteúdo</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <HealthItem label="Perfis sem imagem" value={s.noImageProviders} total={s.totalProviders} type="warning" />
              <HealthItem label="Perfis sem serviço" value={s.noServiceProviders} total={s.totalProviders} type="warning" />
              <HealthItem label="Perfis sem descrição" value={s.noDescriptionProviders} total={s.totalProviders} type="warning" />
              <HealthItem label="Categorias vazias" value={s.emptyCategories} total={s.totalCategories} type={s.emptyCategories > 0 ? 'warning' : 'ok'} />
              <HealthItem label="Avaliações pendentes" value={s.pendingReviews} total={s.totalReviews} type={s.pendingReviews > 0 ? 'warning' : 'ok'} />
              <HealthItem label="Prestadores pendentes" value={s.pendingProviders} total={s.totalProviders} type={s.pendingProviders > 0 ? 'warning' : 'ok'} />
              <HealthItem label="Blocos ativos" value={s.activeBlocks} total={s.totalBlocks} type="ok" />
              <HealthItem label="Páginas publicadas" value={s.publishedPages} total={s.totalPages} type="ok" />
              <HealthItem label="Posts publicados" value={s.publishedBlogPosts} total={s.totalBlogPosts} type="ok" />
              <HealthItem label="Patrocinadores ativos" value={s.activeSponsors} total={s.totalSponsors} type="ok" />
              <HealthItem label="Prestadores destaque" value={s.featuredProviders} total={s.totalProviders} type="ok" />
              <HealthItem label="Itens de menu" value={s.totalMenuItems} total={s.totalMenuItems} type="ok" />
            </div>
          </div>

          {/* Recent leads */}
          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="font-display text-sm font-bold text-foreground">Leads Recentes</h3>
              <div className="mt-4 space-y-3">
                {s.recentLeads.length === 0 && <p className="text-xs text-muted-foreground">Nenhum lead</p>}
                {s.recentLeads.map(l => (
                  <div key={l.id} className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-foreground">{l.client_name}</span>
                      <span className="text-muted-foreground"> → {(l.providers as any)?.business_name || '—'}</span>
                    </div>
                    <span className="text-muted-foreground">{new Date(l.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </AdminLayout>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: number; sub: string; color: string }) => (
  <Card>
    <CardContent className="flex items-center gap-4 p-4">
      <div className={`rounded-lg bg-muted p-2.5 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </CardContent>
  </Card>
);

const HealthItem = ({ label, value, total, type }: { label: string; value: number; total: number; type: 'warning' | 'ok' }) => (
  <div className={`flex items-center gap-3 rounded-lg border p-3 ${type === 'warning' && value > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-card'}`}>
    {type === 'warning' && value > 0 ? (
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
    ) : (
      <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
    )}
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground">{value} de {total}</p>
    </div>
    <Badge variant={type === 'warning' && value > 0 ? 'destructive' : 'secondary'} className="text-[10px]">
      {total > 0 ? `${Math.round((value / total) * 100)}%` : '0%'}
    </Badge>
  </div>
);

export default AdminStatsPage;
