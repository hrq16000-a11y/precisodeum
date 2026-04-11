import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X, Eye, Search, MapPin, Edit2, MoreHorizontal, ExternalLink, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useAdminBulkActions } from '@/hooks/useAdminBulkActions';
import BulkActionsBar from '@/components/admin/BulkActionsBar';
import SelectionCheckbox from '@/components/admin/SelectionCheckbox';
import { logAuditAction } from '@/hooks/useAuditLog';
import PaginationControls from '@/components/PaginationControls';
import ProviderStatsCards from '@/components/admin/ProviderStatsCards';
import ProviderEditDialog from '@/components/admin/ProviderEditDialog';
import ProviderVerifiedChecklist from '@/components/admin/ProviderVerifiedChecklist';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion } from 'framer-motion';

const statusLabels: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  approved: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'Rejeitado', cls: 'bg-destructive/10 text-destructive' },
};

const PAGE_SIZE = 20;

const defaultRules = {
  min_services: 2, min_albums: 1, min_reviews: 1, min_rating: 4.0,
  require_photo: true, require_cnpj: true, require_city: true,
};

const AdminProvidersPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [providers, setProviders] = useState<any[]>([]);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterState, setFilterState] = useState('all');
  const [page, setPage] = useState(1);
  const [backfilling, setBackfilling] = useState(false);
  const [editProvider, setEditProvider] = useState<any | null>(null);
  const [rules, setRules] = useState(defaultRules);
  const [allProviders, setAllProviders] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRules = async () => {
    const { data } = await supabase.from('site_settings').select('key, value')
      .in('key', [
        'verified_badge_min_services', 'verified_badge_min_albums', 'verified_badge_min_reviews',
        'verified_badge_min_rating', 'verified_badge_require_photo', 'verified_badge_require_cnpj',
        'verified_badge_require_city',
      ]);
    if (data) {
      const map = Object.fromEntries(data.map(d => [d.key, d.value]));
      setRules({
        min_services: Number(map.verified_badge_min_services ?? 2),
        min_albums: Number(map.verified_badge_min_albums ?? 1),
        min_reviews: Number(map.verified_badge_min_reviews ?? 1),
        min_rating: Number(map.verified_badge_min_rating ?? 4.0),
        require_photo: map.verified_badge_require_photo !== 'false',
        require_cnpj: map.verified_badge_require_cnpj !== 'false',
        require_city: map.verified_badge_require_city !== 'false',
      });
    }
  };

  const fetchProviders = async () => {
    const { data: providerData } = await supabase
      .from('providers')
      .select('*, categories(name, icon)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (!providerData || providerData.length === 0) { setProviders([]); setAllProviders([]); return; }

    setAllProviders(providerData);

    const userIds = [...new Set(providerData.map(p => p.user_id))];
    const { data: profileData } = await supabase
      .from('profiles').select('id, full_name, email, avatar_url').in('id', userIds);
    const profileMap = new Map((profileData || []).map(p => [p.id, p]));

    setProviders(providerData.map(p => ({
      ...p,
      profiles: profileMap.get(p.user_id) || null,
    })));
  };

  useEffect(() => { if (isAdmin) { fetchProviders(); fetchRules(); } }, [isAdmin]);

  const bulk = useAdminBulkActions({
    table: 'providers',
    resourceType: 'provider',
    onComplete: fetchProviders,
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('providers').update({ status }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'approved' ? 'Prestador aprovado!' : status === 'rejected' ? 'Prestador rejeitado' : 'Status atualizado');
    await logAuditAction({ action: status === 'approved' ? 'approve' : 'reject', resource_type: 'provider', resource_id: id });
    fetchProviders();
  };

  // Derived data for filters
  const categories = useMemo(() => {
    const cats = new Map<string, string>();
    allProviders.forEach(p => {
      const cat = p.categories as any;
      if (cat?.name) cats.set(cat.name, `${cat.icon || ''} ${cat.name}`);
    });
    return Array.from(cats.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allProviders]);

  const states = useMemo(() => {
    const s = new Set<string>();
    allProviders.forEach(p => { if (p.state) s.add(p.state); });
    return Array.from(s).sort();
  }, [allProviders]);

  const filtered = useMemo(() => {
    let list = providers;
    if (filter !== 'all') list = list.filter(p => p.status === filter);
    if (filterCategory !== 'all') list = list.filter(p => (p.categories as any)?.name === filterCategory);
    if (filterState !== 'all') list = list.filter(p => p.state === filterState);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.profiles?.full_name || '').toLowerCase().includes(q) ||
        (p.profiles?.email || '').toLowerCase().includes(q) ||
        (p.business_name || '').toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q) ||
        (p.cnpj || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [providers, search, filter, filterCategory, filterState]);

  const isVerified = (p: any) => {
    const checks = [
      !rules.require_cnpj || !!p.cnpj?.trim(),
      !rules.require_city || !!p.city?.trim(),
      !rules.require_photo || !!p.photo_url,
      p.services_count >= rules.min_services,
      p.portfolio_album_count >= rules.min_albums,
      p.review_count >= rules.min_reviews,
      p.rating_avg >= rules.min_rating,
    ];
    return checks.every(Boolean);
  };

  const stats = useMemo(() => ({
    total: allProviders.length,
    pending: allProviders.filter(p => p.status === 'pending').length,
    approved: allProviders.filter(p => p.status === 'approved').length,
    rejected: allProviders.filter(p => p.status === 'rejected').length,
    verified: allProviders.filter(p => isVerified(p)).length,
  }), [allProviders, rules]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    const csvHeader = 'Nome,Email,Empresa,Cidade,Estado,CNPJ,Categoria,Status,Serviços,Álbuns,Nota,Avaliações,Criado em\n';
    const source = bulk.selectedIds.size > 0 ? filtered.filter(p => bulk.selectedIds.has(p.id)) : filtered;
    const csvRows = source.map(p =>
      `"${p.profiles?.full_name || ''}","${p.profiles?.email || ''}","${p.business_name || ''}","${p.city || ''}","${p.state || ''}","${p.cnpj || ''}","${(p.categories as any)?.name || ''}","${p.status}","${p.services_count}","${p.portfolio_album_count}","${p.rating_avg?.toFixed(1)}","${p.review_count}","${p.created_at || ''}"`
    ).join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prestadores_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logAuditAction({ action: 'export', resource_type: 'provider', details: { count: source.length } });
    toast.success(`${source.length} prestador(es) exportado(s)!`);
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Gestão de Prestadores</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} prestador(es) encontrado(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar CSV
          </Button>
          <Button
            variant="outline" size="sm" disabled={backfilling}
            onClick={async () => {
              setBackfilling(true);
              try {
                const { data, error } = await supabase.functions.invoke('backfill-provider-coords');
                if (error) throw error;
                toast.success(`Coordenadas: ${data?.updated || 0}/${data?.total || 0}`);
              } catch (e: any) { toast.error(e.message || 'Erro'); }
              finally { setBackfilling(false); }
            }}
          >
            <MapPin className="mr-1.5 h-4 w-4" />
            {backfilling ? 'Geocodificando...' : 'Preencher Coordenadas'}
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <ProviderStatsCards stats={stats} />
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {['pending', 'approved', 'rejected', 'all'].map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f === 'all' ? 'Todos' : statusLabels[f]?.label || f}
              {f !== 'all' && (
                <span className="ml-1 opacity-70">
                  ({f === 'pending' ? stats.pending : f === 'approved' ? stats.approved : stats.rejected})
                </span>
              )}
            </button>
          ))}
        </div>
        <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setPage(1); }}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map(([name, label]) => (
              <SelectItem key={name} value={name}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterState} onValueChange={v => { setFilterState(v); setPage(1); }}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos estados</SelectItem>
            {states.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar nome, email, CNPJ, cidade..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
      </div>

      {/* Bulk Actions */}
      {bulk.hasSelection && (
        <div className="mt-3">
          <BulkActionsBar count={bulk.selectionCount} onClear={bulk.clearSelection} onDelete={bulk.bulkSoftDelete} onExport={() => bulk.exportSelected(filtered, 'prestadores')} loading={bulk.bulkLoading}>
            <Button size="sm" variant="outline" onClick={() => bulk.bulkUpdate({ status: 'approved' })} disabled={bulk.bulkLoading} className="text-emerald-600 border-emerald-200">
              <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk.bulkUpdate({ status: 'rejected' })} disabled={bulk.bulkLoading} className="text-destructive border-destructive/30">
              <X className="mr-1 h-3.5 w-3.5" /> Rejeitar
            </Button>
          </BulkActionsBar>
        </div>
      )}

      {/* Provider Cards */}
      <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {paginated.length === 0 && (
          <div className="col-span-full rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-foreground font-semibold">Nenhum prestador encontrado</p>
          </div>
        )}
        {paginated.map((p, i) => {
          const isExpanded = expandedId === p.id;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              className={`group relative rounded-xl border bg-card shadow-card transition-all hover:shadow-card-hover ${
                p.status === 'rejected' ? 'opacity-70 border-destructive/30' : 'border-border'
              } ${bulk.selectedIds.has(p.id) ? 'ring-2 ring-accent' : ''}`}
            >
              {/* Selection + Menu */}
              <div className="absolute top-3 left-3 z-10">
                <SelectionCheckbox checked={bulk.selectedIds.has(p.id)} onCheckedChange={() => bulk.toggleSelection(p.id)} />
              </div>
              <div className="absolute top-3 right-3 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => setEditProvider(p)}>
                      <Edit2 className="h-3.5 w-3.5 mr-2" /> Editar
                    </DropdownMenuItem>
                    {p.slug && (
                      <DropdownMenuItem asChild>
                        <Link to={`/profissional/${p.slug}`} target="_blank">
                          <ExternalLink className="h-3.5 w-3.5 mr-2" /> Ver Perfil
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {p.status !== 'approved' && (
                      <DropdownMenuItem onClick={() => updateStatus(p.id, 'approved')} className="text-emerald-600">
                        <Check className="h-3.5 w-3.5 mr-2" /> Aprovar
                      </DropdownMenuItem>
                    )}
                    {p.status !== 'rejected' && (
                      <DropdownMenuItem onClick={() => updateStatus(p.id, 'rejected')} className="text-destructive">
                        <X className="h-3.5 w-3.5 mr-2" /> Rejeitar
                      </DropdownMenuItem>
                    )}
                    {p.status !== 'pending' && (
                      <DropdownMenuItem onClick={() => updateStatus(p.id, 'pending')}>
                        Voltar p/ Pendente
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Card Body */}
              <div className="p-4 pt-5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 shrink-0">
                    <AvatarImage src={p.photo_url || p.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-sm font-bold">
                      {(p.profiles?.full_name || p.business_name || '?')[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold text-foreground text-sm truncate">
                      {p.profiles?.full_name || p.business_name || 'Sem nome'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{p.profiles?.email}</p>
                  </div>
                </div>

                {/* Status + Verified badges */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusLabels[p.status]?.cls || 'bg-muted text-muted-foreground'}`}>
                    {statusLabels[p.status]?.label || p.status}
                  </span>
                  <ProviderVerifiedChecklist provider={p} rules={rules} compact />
                </div>

                {/* Details */}
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {(p.categories as any)?.name && (
                    <p className="flex items-center gap-1"><CategoryIcon icon={(p.categories as any)?.icon} size={12} className="text-muted-foreground" /> {(p.categories as any)?.name}</p>
                  )}
                  {(p.city || p.state) && (
                    <p className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {[p.neighborhood, p.city, p.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {p.cnpj && <p className="font-mono text-[10px]">CNPJ: {p.cnpj}</p>}
                  <div className="flex gap-3 text-[10px]">
                    <span>{p.services_count} serviço(s)</span>
                    <span>{p.portfolio_album_count} álbum(ns)</span>
                    <span>⭐ {p.rating_avg?.toFixed(1)} ({p.review_count})</span>
                  </div>
                </div>

                {/* Expandable Details */}
                <Collapsible open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : p.id)}>
                  <CollapsibleTrigger asChild>
                    <button className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1">
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {isExpanded ? 'Menos detalhes' : 'Mais detalhes'}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1 pt-2 border-t border-border space-y-2">
                      <ProviderVerifiedChecklist provider={p} rules={rules} />
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                        {p.business_name && (
                          <div><span className="font-medium text-foreground">Empresa:</span> {p.business_name}</div>
                        )}
                        {p.phone && (
                          <div><span className="font-medium text-foreground">Telefone:</span> {p.phone}</div>
                        )}
                        {p.whatsapp && (
                          <div><span className="font-medium text-foreground">WhatsApp:</span> {p.whatsapp}</div>
                        )}
                        {p.plan && (
                          <div><span className="font-medium text-foreground">Plano:</span> {p.plan}</div>
                        )}
                        {p.years_experience > 0 && (
                          <div><span className="font-medium text-foreground">Experiência:</span> {p.years_experience} ano(s)</div>
                        )}
                        {p.service_radius && (
                          <div><span className="font-medium text-foreground">Raio:</span> {p.service_radius}</div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Quick Actions Footer */}
              <div className="border-t border-border px-3 py-2 flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 flex-1" onClick={() => setEditProvider(p)}>
                  <Edit2 className="h-3 w-3" /> Editar
                </Button>
                {p.status !== 'approved' ? (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 flex-1 text-emerald-600" onClick={() => updateStatus(p.id, 'approved')}>
                    <Check className="h-3 w-3" /> Aprovar
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 flex-1 text-destructive" onClick={() => updateStatus(p.id, 'rejected')}>
                    <X className="h-3 w-3" /> Rejeitar
                  </Button>
                )}
                {p.slug && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" asChild>
                    <Link to={`/profissional/${p.slug}`} target="_blank"><Eye className="h-3 w-3" /></Link>
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}

      {editProvider && (
        <ProviderEditDialog provider={editProvider} onClose={() => setEditProvider(null)} onSaved={fetchProviders} />
      )}
    </AdminLayout>
  );
};

export default AdminProvidersPage;
