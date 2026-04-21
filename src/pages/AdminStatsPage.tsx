import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart3, Users, Briefcase, Star, FileText, MapPin, AlertTriangle,
  CheckCircle, TrendingUp, MessageCircle, Phone, Activity, Shield, Filter
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts';
import AdminDataDnaHealth from '@/components/admin/AdminDataDnaHealth';

interface HealthStats {
  totalProviders: number;
  approvedProviders: number;
  pendingProviders: number;
  rejectedProviders: number;
  noImageProviders: number;
  noServiceProviders: number;
  noDescriptionProviders: number;
  noPhoneProviders: number;
  noHoursProviders: number;
  noCoordsProviders: number;
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
  // Health distribution
  healthCritical: number;
  healthIncomplete: number;
  healthPremium: number;
  // Global audience
  clicks7d: number;
  clicks30d: number;
  clicksPrev30d: number;
  wa7d: number;
  ph7d: number;
}

const AdminStatsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [stats, setStats] = useState<HealthStats | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchAll = async () => {
      const [
        providersRes, servicesRes, leadsRes, reviewsRes, jobsRes, blogRes,
        pagesRes, menuRes, blocksRes, sponsorsRes, categoriesRes, clicksRes,
      ] = await Promise.all([
        supabase.from('providers').select('id, status, city, photo_url, description, featured, created_at, whatsapp, phone, working_hours, latitude, longitude, services_count, categories(name)').is('deleted_at', null),
        supabase.from('services').select('id, provider_id, created_at').is('deleted_at', null),
        supabase.from('leads').select('id, client_name, created_at, providers:provider_id(business_name, city)').order('created_at', { ascending: false }).limit(50),
        supabase.from('reviews').select('id, approval_status'),
        supabase.from('jobs').select('id').is('deleted_at', null),
        supabase.from('blog_posts').select('id, published').is('deleted_at', null),
        supabase.from('institutional_pages').select('id, published'),
        supabase.from('menu_items').select('id'),
        supabase.from('page_blocks').select('id, active'),
        supabase.from('sponsors').select('id, active').is('deleted_at', null),
        supabase.from('categories').select('id, name, slug').is('deleted_at', null),
        supabase.from('contact_clicks' as any).select('id, contact_type, created_at').order('created_at', { ascending: false }).limit(1000),
      ]);

      const providers = providersRes.data || [];
      const services = servicesRes.data || [];
      const leads = leadsRes.data || [];
      const clicks = (clicksRes.data as any[]) || [];
      const providerIdsWithServices = new Set(services.map(s => s.provider_id));
      const categoryProviderCount: Record<string, number> = {};
      const cityCount: Record<string, number> = {};

      let noImage = 0, noService = 0, noDesc = 0, noPhone = 0, noHours = 0, noCoords = 0;
      let approved = 0, pending = 0, rejected = 0, featured = 0;
      let healthCritical = 0, healthIncomplete = 0, healthPremium = 0;

      providers.forEach(p => {
        if (p.status === 'approved') approved++;
        else if (p.status === 'pending') pending++;
        else rejected++;
        if (!p.photo_url) noImage++;
        if (!providerIdsWithServices.has(p.id) && !(p.services_count > 0)) noService++;
        if (!p.description || p.description.length < 20) noDesc++;
        if (!p.whatsapp && !p.phone) noPhone++;
        if (!p.working_hours) noHours++;
        if (!p.latitude || !p.longitude) noCoords++;
        if (p.featured) featured++;
        if (p.city) cityCount[p.city] = (cityCount[p.city] || 0) + 1;
        const catName = (p.categories as any)?.name;
        if (catName) categoryProviderCount[catName] = (categoryProviderCount[catName] || 0) + 1;

        // Health score
        const checks = [
          !!p.photo_url, !!(p.whatsapp || p.phone), !!p.city,
          !!(p.description && p.description.length >= 20),
          !!(p.services_count > 0 || providerIdsWithServices.has(p.id)),
          !!(p.latitude && p.longitude),
        ];
        const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
        if (pct <= 40) healthCritical++;
        else if (pct <= 75) healthIncomplete++;
        else healthPremium++;
      });

      const categories = categoriesRes.data || [];
      const emptyCats = categories.filter(c => !categoryProviderCount[c.name]);
      const reviews = reviewsRes.data || [];
      const blog = blogRes.data || [];
      const pages = pagesRes.data || [];
      const blocks = blocksRes.data || [];
      const sponsors = sponsorsRes.data || [];

      // Clicks aggregation
      const now = new Date();
      const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
      const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
      const d60 = new Date(now); d60.setDate(d60.getDate() - 60);
      const clicks7d = clicks.filter(c => new Date(c.created_at) >= d7).length;
      const c30 = clicks.filter(c => new Date(c.created_at) >= d30);
      const clicks30d = c30.length;
      const clicksPrev30d = clicks.filter(c => { const d = new Date(c.created_at); return d >= d60 && d < d30; }).length;
      const wa7d = clicks.filter(c => new Date(c.created_at) >= d7 && c.contact_type === 'whatsapp').length;
      const ph7d = clicks.filter(c => new Date(c.created_at) >= d7 && c.contact_type === 'phone').length;

      // Time-series
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
        approvedProviders: approved, pendingProviders: pending, rejectedProviders: rejected,
        noImageProviders: noImage, noServiceProviders: noService, noDescriptionProviders: noDesc,
        noPhoneProviders: noPhone, noHoursProviders: noHours, noCoordsProviders: noCoords,
        featuredProviders: featured,
        totalCategories: categories.length, emptyCategories: emptyCats.length,
        totalServices: services.length, totalLeads: leads.length,
        totalReviews: reviews.length, pendingReviews: reviews.filter(r => r.approval_status === 'pending').length,
        totalJobs: (jobsRes.data || []).length,
        totalBlogPosts: blog.length, publishedBlogPosts: blog.filter(b => b.published).length,
        totalPages: pages.length, publishedPages: pages.filter(p => p.published).length,
        totalMenuItems: (menuRes.data || []).length,
        totalBlocks: blocks.length, activeBlocks: blocks.filter(b => b.active).length,
        totalSponsors: sponsors.length, activeSponsors: sponsors.filter(s => s.active).length,
        providersByCity: Object.entries(cityCount).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count).slice(0, 10),
        providersByCategory: Object.entries(categoryProviderCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        recentLeads: leads.slice(0, 10),
        leadsOverTime: aggregateByDay(leads),
        healthCritical, healthIncomplete, healthPremium,
        clicks7d, clicks30d, clicksPrev30d, wa7d, ph7d,
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
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Prestadores" value={s.totalProviders} sub={`${s.approvedProviders} aprovados`} color="text-emerald-600" />
            <StatCard icon={Briefcase} label="Serviços" value={s.totalServices} sub={`${s.totalLeads} leads gerados`} color="text-blue-600" />
            <StatCard icon={Star} label="Avaliações" value={s.totalReviews} sub={`${s.pendingReviews} pendentes`} color="text-amber-600" />
            <StatCard icon={FileText} label="Conteúdo" value={s.totalBlogPosts + s.totalPages + s.totalBlocks} sub={`${s.totalJobs} vagas ativas`} color="text-purple-600" />
          </div>

          {/* ===== GLOBAL AUDIENCE ===== */}
          <div className="mt-6">
            <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Audiência Global (Leads)
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs text-muted-foreground">Cliques (7 dias)</p>
                <p className="text-3xl font-bold text-foreground mt-1">{s.clicks7d}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                  <span className="inline-flex items-center gap-0.5 text-emerald-600"><MessageCircle className="h-3 w-3" /> {s.wa7d}</span>
                  <span className="inline-flex items-center gap-0.5 text-blue-600"><Phone className="h-3 w-3" /> {s.ph7d}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs text-muted-foreground">Cliques (30 dias)</p>
                <p className="text-3xl font-bold text-foreground mt-1">{s.clicks30d}</p>
                {s.clicksPrev30d > 0 && (() => {
                  const growth = Math.round(((s.clicks30d - s.clicksPrev30d) / s.clicksPrev30d) * 100);
                  return (
                    <span className={`text-[10px] font-semibold ${growth >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {growth >= 0 ? '+' : ''}{growth}% vs mês anterior
                    </span>
                  );
                })()}
              </div>
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/10 p-4 shadow-sm">
                <p className="text-xs text-muted-foreground">WhatsApp (30d)</p>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {(stats?.clicks30d || 0) > 0 ? Math.round(((stats?.wa7d || 0) / (stats?.clicks7d || 1)) * (stats?.clicks30d || 0)) : 0}
                </p>
              </div>
              <div className="rounded-2xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/10 p-4 shadow-sm">
                <p className="text-xs text-muted-foreground">Telefone (30d)</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {(stats?.clicks30d || 0) > 0 ? Math.round(((stats?.ph7d || 0) / (stats?.clicks7d || 1)) * (stats?.clicks30d || 0)) : 0}
                </p>
              </div>
            </div>
          </div>

          {/* ===== DATA DNA HEALTH (provider_id + user_ref + freeze + triggers) ===== */}
          <div className="mt-6">
            <AdminDataDnaHealth />
          </div>

          {/* ===== DATA HEALTH DASHBOARD ===== */}
          <div className="mt-6">
            <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Saúde dos Dados
            </h2>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Donut Chart - Health Distribution */}
              <Card className="rounded-2xl">
                <CardContent className="p-5">
                  <h3 className="text-sm font-bold text-foreground mb-4">Distribuição de Saúde dos Perfis</h3>
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Críticos', value: s.healthCritical },
                            { name: 'Incompletos', value: s.healthIncomplete },
                            { name: 'Premium', value: s.healthPremium },
                          ]}
                          cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" startAngle={90} endAngle={-270}
                        >
                          <Cell fill="hsl(0 84% 60%)" />
                          <Cell fill="hsl(38 92% 50%)" />
                          <Cell fill="hsl(142 71% 45%)" />
                        </Pie>
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3 flex-1">
                      <HealthLegendItem color="bg-red-500" label="Críticos (0-40%)" value={s.healthCritical} total={s.totalProviders} />
                      <HealthLegendItem color="bg-amber-500" label="Incompletos (41-75%)" value={s.healthIncomplete} total={s.totalProviders} />
                      <HealthLegendItem color="bg-emerald-500" label="Premium (76-100%)" value={s.healthPremium} total={s.totalProviders} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Missing Data Ranking */}
              <Card className="rounded-2xl">
                <CardContent className="p-5">
                  <h3 className="text-sm font-bold text-foreground mb-4">Ranking de Dados Faltantes</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Sem foto de perfil', value: s.noImageProviders },
                      { label: 'Sem telefone/WhatsApp', value: s.noPhoneProviders },
                      { label: 'Sem descrição adequada', value: s.noDescriptionProviders },
                      { label: 'Sem serviço cadastrado', value: s.noServiceProviders },
                      { label: 'Sem horário de atendimento', value: s.noHoursProviders },
                      { label: 'Sem coordenadas (GPS)', value: s.noCoordsProviders },
                    ].sort((a, b) => b.value - a.value).map(item => {
                      const pct = s.totalProviders > 0 ? Math.round((item.value / s.totalProviders) * 100) : 0;
                      return (
                        <div key={item.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-foreground">{item.label}</span>
                            <span className="text-xs font-bold text-muted-foreground">{pct}% ({item.value})</span>
                          </div>
                          <Progress value={pct} className="h-2 [&>div]:bg-amber-500" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Charts Row */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Leads over time */}
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
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
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold text-foreground mb-4">Status dos Prestadores</h3>
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

            {/* Top Cities */}
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
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

            {/* Categories */}
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold text-foreground mb-4">Prestadores por Categoria</h3>
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
            <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Alertas de Conteúdo
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <HealthItem label="Perfis sem imagem" value={s.noImageProviders} total={s.totalProviders} type="warning" />
              <HealthItem label="Perfis sem serviço" value={s.noServiceProviders} total={s.totalProviders} type="warning" />
              <HealthItem label="Perfis sem descrição" value={s.noDescriptionProviders} total={s.totalProviders} type="warning" />
              <HealthItem label="Categorias vazias" value={s.emptyCategories} total={s.totalCategories} type={s.emptyCategories > 0 ? 'warning' : 'ok'} />
              <HealthItem label="Avaliações pendentes" value={s.pendingReviews} total={s.totalReviews} type={s.pendingReviews > 0 ? 'warning' : 'ok'} />
              <HealthItem label="Prestadores pendentes" value={s.pendingProviders} total={s.totalProviders} type={s.pendingProviders > 0 ? 'warning' : 'ok'} />
              <HealthItem label="Blocos ativos" value={s.activeBlocks} total={s.totalBlocks} type="ok" />
              <HealthItem label="Páginas publicadas" value={s.publishedPages} total={s.totalPages} type="ok" />
              <HealthItem label="Patrocinadores ativos" value={s.activeSponsors} total={s.totalSponsors} type="ok" />
            </div>
          </div>

          {/* Recent leads */}
          <Card className="mt-6 rounded-2xl">
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-foreground">Leads Recentes</h3>
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
  <Card className="rounded-2xl">
    <CardContent className="flex items-center gap-4 p-4">
      <div className={`rounded-xl bg-muted p-2.5 ${color}`}>
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

const HealthLegendItem = ({ color, label, value, total }: { color: string; label: string; value: number; total: number }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className={`h-3 w-3 rounded-sm ${color} shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{value} ({pct}%)</p>
      </div>
    </div>
  );
};

const HealthItem = ({ label, value, total, type }: { label: string; value: number; total: number; type: 'warning' | 'ok' }) => (
  <div className={`flex items-center gap-3 rounded-xl border p-3 ${type === 'warning' && value > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-card'}`}>
    {type === 'warning' && value > 0 ? (
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
    ) : (
      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
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