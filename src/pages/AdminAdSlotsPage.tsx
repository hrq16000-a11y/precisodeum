import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { LayoutGrid, Plus, Trash2, Link2, Eye, MousePointerClick, BarChart3, Search } from 'lucide-react';

const PAGE_TYPES = [
  { value: 'global', label: 'Global' },
  { value: 'home', label: 'Home' },
  { value: 'jobs', label: 'Vagas' },
  { value: 'profile', label: 'Perfil' },
  { value: 'category', label: 'Categoria' },
  { value: 'blog', label: 'Blog' },
];

const AdminAdSlotsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: slots = [] } = useQuery({
    queryKey: ['admin-ad-slots'],
    queryFn: async () => {
      const { data } = await supabase.from('ad_slots' as any).select('*').order('display_order');
      return (data || []) as any[];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['admin-ad-assignments'],
    queryFn: async () => {
      const { data } = await supabase.from('ad_slot_assignments' as any).select('*').order('priority', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: sponsors = [] } = useQuery({
    queryKey: ['admin-sponsors-for-slots'],
    queryFn: async () => {
      const { data } = await supabase.from('sponsors').select('id, title, image_url, active, tier');
      return (data || []) as any[];
    },
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ['admin-sponsor-metrics-summary'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsor_metrics' as any)
        .select('sponsor_id, slot_slug, event_type, count, event_date')
        .order('event_date', { ascending: false })
        .limit(500);
      return (data || []) as any[];
    },
  });

  // States
  const [assignDialog, setAssignDialog] = useState(false);
  const [assignForm, setAssignForm] = useState({
    slot_id: '', sponsor_id: '', priority: '0', start_date: '', end_date: '',
    target_category: '', target_city: '', target_state: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [pageFilter, setPageFilter] = useState('all');

  // Mutations
  const toggleSlot = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await supabase.from('ad_slots' as any).update({ active } as any).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-ad-slots'] }),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ad_slot_assignments' as any).insert({
        slot_id: assignForm.slot_id,
        sponsor_id: assignForm.sponsor_id,
        priority: Number(assignForm.priority) || 0,
        start_date: assignForm.start_date || null,
        end_date: assignForm.end_date || null,
        target_category: assignForm.target_category || null,
        target_city: assignForm.target_city || null,
        target_state: assignForm.target_state || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ad-assignments'] });
      toast.success('Patrocinador atribuído ao slot!');
      setAssignDialog(false);
      setAssignForm({ slot_id: '', sponsor_id: '', priority: '0', start_date: '', end_date: '', target_category: '', target_city: '', target_state: '' });
    },
    onError: (e: any) => toast.error(e.message?.includes('unique') ? 'Este patrocinador já está neste slot' : 'Erro ao atribuir'),
  });

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('ad_slot_assignments' as any).delete().eq('id', id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ad-assignments'] });
      toast.success('Atribuição removida');
    },
  });

  const toggleAssignment = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await supabase.from('ad_slot_assignments' as any).update({ active } as any).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-ad-assignments'] }),
  });

  // Helpers
  const getSlotName = (id: string) => slots.find((s: any) => s.id === id)?.name || id;
  const getSlotSlug = (id: string) => slots.find((s: any) => s.id === id)?.slug || '';
  const getSponsorTitle = (id: string) => sponsors.find((s: any) => s.id === id)?.title || id;

  // Metrics aggregation
  const metricsSummary = useMemo(() => {
    const map = new Map<string, { impressions: number; clicks: number }>();
    metrics.forEach((m: any) => {
      const key = `${m.sponsor_id}__${m.slot_slug}`;
      const existing = map.get(key) || { impressions: 0, clicks: 0 };
      if (m.event_type === 'impression') existing.impressions += m.count;
      else if (m.event_type === 'click') existing.clicks += m.count;
      map.set(key, existing);
    });
    return map;
  }, [metrics]);

  const filteredSlots = useMemo(() => {
    return slots.filter((s: any) => {
      if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (pageFilter !== 'all' && s.page_type !== pageFilter) return false;
      return true;
    });
  }, [slots, searchTerm, pageFilter]);

  if (adminLoading) return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;
  if (!isAdmin) { navigate('/'); return null; }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Gestão de Slots de Anúncios</h1>
            <p className="text-sm text-muted-foreground">Controle onde cada patrocinador aparece no site</p>
          </div>
          <Button size="sm" onClick={() => setAssignDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Atribuir Patrocinador
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <LayoutGrid className="h-5 w-5 text-primary" />
            <div><p className="text-2xl font-bold">{slots.length}</p><p className="text-[11px] text-muted-foreground">Slots</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Link2 className="h-5 w-5 text-primary" />
            <div><p className="text-2xl font-bold">{assignments.length}</p><p className="text-[11px] text-muted-foreground">Atribuições</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Eye className="h-5 w-5 text-primary" />
            <div><p className="text-2xl font-bold">{Array.from(metricsSummary.values()).reduce((a, m) => a + m.impressions, 0).toLocaleString('pt-BR')}</p><p className="text-[11px] text-muted-foreground">Impressões</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <MousePointerClick className="h-5 w-5 text-primary" />
            <div><p className="text-2xl font-bold">{Array.from(metricsSummary.values()).reduce((a, m) => a + m.clicks, 0).toLocaleString('pt-BR')}</p><p className="text-[11px] text-muted-foreground">Cliques</p></div>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="slots" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="slots">Slots & Atribuições</TabsTrigger>
            <TabsTrigger value="metrics">Métricas por Posição</TabsTrigger>
          </TabsList>

          <TabsContent value="slots" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar slot..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <Select value={pageFilter} onValueChange={setPageFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Páginas</SelectItem>
                  {PAGE_TYPES.map(pt => <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Slots with assignments */}
            <div className="space-y-4">
              {filteredSlots.map((slot: any) => {
                const slotAssignments = assignments.filter((a: any) => a.slot_id === slot.id);
                return (
                  <Card key={slot.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-sm">{slot.name}</CardTitle>
                          <Badge variant="outline" className="text-[10px]">{slot.page_type}</Badge>
                          <Badge variant="outline" className="text-[10px] font-mono">{slot.slug}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Máx: {slot.max_ads}</span>
                          <Switch
                            checked={slot.active}
                            onCheckedChange={active => toggleSlot.mutate({ id: slot.id, active })}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{slot.description}</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {slotAssignments.length > 0 ? (
                        <div className="space-y-2">
                          {slotAssignments.map((a: any) => {
                            const key = `${a.sponsor_id}__${slot.slug}`;
                            const m = metricsSummary.get(key);
                            return (
                              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-medium">{getSponsorTitle(a.sponsor_id)}</span>
                                  <Badge variant={a.active ? 'default' : 'secondary'} className="text-[10px]">
                                    {a.active ? 'Ativo' : 'Inativo'}
                                  </Badge>
                                  {a.target_category && <Badge variant="outline" className="text-[10px]">Cat: {a.target_category}</Badge>}
                                  {a.target_city && <Badge variant="outline" className="text-[10px]">🏙 {a.target_city}</Badge>}
                                </div>
                                <div className="flex items-center gap-4">
                                  {m && (
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{m.impressions}</span>
                                      <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" />{m.clicks}</span>
                                    </div>
                                  )}
                                  <Switch
                                    checked={a.active}
                                    onCheckedChange={active => toggleAssignment.mutate({ id: a.id, active })}
                                  />
                                  <Button variant="ghost" size="sm" onClick={() => removeAssignment.mutate(a.id)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground py-2">Nenhum patrocinador atribuído a este slot.</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <div className="rounded-xl border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patrocinador</TableHead>
                    <TableHead>Posição (Slot)</TableHead>
                    <TableHead>Impressões</TableHead>
                    <TableHead>Cliques</TableHead>
                    <TableHead>CTR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(metricsSummary.entries()).map(([key, m]) => {
                    const [sponsorId, slotSlug] = key.split('__');
                    const ctr = m.impressions > 0 ? ((m.clicks / m.impressions) * 100).toFixed(1) : '0.0';
                    return (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{getSponsorTitle(sponsorId)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] font-mono">{slotSlug}</Badge></TableCell>
                        <TableCell className="text-xs"><span className="flex items-center gap-1"><Eye className="h-3 w-3" />{m.impressions.toLocaleString('pt-BR')}</span></TableCell>
                        <TableCell className="text-xs"><span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" />{m.clicks.toLocaleString('pt-BR')}</span></TableCell>
                        <TableCell className="text-xs font-medium">{ctr}%</TableCell>
                      </TableRow>
                    );
                  })}
                  {metricsSummary.size === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma métrica registrada ainda.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atribuir Patrocinador a Slot</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); assignMutation.mutate(); }} className="space-y-4">
            <div>
              <Label>Slot *</Label>
              <Select value={assignForm.slot_id} onValueChange={v => setAssignForm(p => ({ ...p, slot_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar slot" /></SelectTrigger>
                <SelectContent>
                  {slots.filter((s: any) => s.active).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.page_type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Patrocinador *</Label>
              <Select value={assignForm.sponsor_id} onValueChange={v => setAssignForm(p => ({ ...p, sponsor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar patrocinador" /></SelectTrigger>
                <SelectContent>
                  {sponsors.filter((s: any) => s.active).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.title} ({s.tier})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Prioridade</Label><Input type="number" value={assignForm.priority} onChange={e => setAssignForm(p => ({ ...p, priority: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Início</Label><Input type="date" value={assignForm.start_date} onChange={e => setAssignForm(p => ({ ...p, start_date: e.target.value }))} /></div>
              <div><Label>Fim</Label><Input type="date" value={assignForm.end_date} onChange={e => setAssignForm(p => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Categoria</Label><Input placeholder="ex: eletricista" value={assignForm.target_category} onChange={e => setAssignForm(p => ({ ...p, target_category: e.target.value }))} /></div>
              <div><Label>Cidade</Label><Input placeholder="ex: São Paulo" value={assignForm.target_city} onChange={e => setAssignForm(p => ({ ...p, target_city: e.target.value }))} /></div>
              <div><Label>Estado</Label><Input placeholder="ex: SP" value={assignForm.target_state} onChange={e => setAssignForm(p => ({ ...p, target_state: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAssignDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={assignMutation.isPending}>Atribuir</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminAdSlotsPage;
