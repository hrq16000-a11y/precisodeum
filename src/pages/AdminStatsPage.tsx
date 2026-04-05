import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Users, Briefcase, Image, AlertTriangle, CheckCircle, Star, FileText, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
}

const AdminStatsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [stats, setStats] = useState<HealthStats | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchAll = async () => {
      const [
        providersRes,
        servicesRes,
        leadsRes,
        reviewsRes,
        jobsRes,
        blogRes,
        pagesRes,
        menuRes,
        blocksRes,
        sponsorsRes,
        categoriesRes,
      ] = await Promise.all([
        supabase.from('providers').select('id, status, city, photo_url, description, featured, categories(name)'),
        supabase.from('services').select('id, provider_id'),
        supabase.from('leads').select('id, client_name, created_at, providers:provider_id(business_name, city)').order('created_at', { ascending: false }).limit(10),
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
        totalLeads: (leadsRes.data || []).length,
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
        providersByCity: Object.entries(cityCount)
          .map(([city, count]) => ({ city, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        providersByCategory: Object.entries(categoryProviderCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
        recentLeads: leadsRes.data || [],
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

          {/* Detailed breakdowns */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Providers by status */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-display text-sm font-bold text-foreground">Prestadores por Status</h3>
                <div className="mt-4 space-y-3">
                  {[
                    { key: 'approved', label: 'Aprovados', count: s.approvedProviders, color: 'bg-green-500' },
                    { key: 'pending', label: 'Pendentes', count: s.pendingProviders, color: 'bg-amber-500' },
                    { key: 'rejected', label: 'Rejeitados', count: s.rejectedProviders, color: 'bg-red-500' },
                  ].map(item => {
                    const pct = s.totalProviders > 0 ? (item.count / s.totalProviders) * 100 : 0;
                    return (
                      <div key={item.key}>
                        <div className="flex justify-between text-xs">
                          <span className="text-foreground">{item.label}</span>
                          <span className="text-muted-foreground">{item.count}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-muted">
                          <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Providers by category */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-display text-sm font-bold text-foreground">Prestadores por Categoria</h3>
                <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                  {s.providersByCategory.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
                  {s.providersByCategory.map(c => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate">{c.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{c.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top cities */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Top Cidades
                </h3>
                <div className="mt-4 space-y-2">
                  {s.providersByCity.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
                  {s.providersByCity.map((c, i) => (
                    <div key={c.city} className="flex items-center justify-between text-xs">
                      <span className="text-foreground">
                        <span className="mr-2 text-muted-foreground">{i + 1}.</span>{c.city}
                      </span>
                      <span className="text-muted-foreground">{c.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent leads */}
            <Card>
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
          </div>
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
