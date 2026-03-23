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
import { Textarea } from '@/components/ui/textarea';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import {
  Megaphone, Users, FileText, StickyNote, AlertTriangle, Eye, MousePointerClick,
  Plus, Trash2, Search, Filter, Calendar, TrendingUp, ArrowRight
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────
interface Sponsor {
  id: string; title: string; active: boolean; tier: string; position: string;
  impressions: number; clicks: number; start_date: string | null; end_date: string | null;
  image_url: string | null; link_url: string | null; display_order: number; created_at: string;
}

// ─── Component ──────────────────────────────────────────────────────
const AdminSponsorCrmPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Auth check moved after all hooks (below)

  // ─── Data Queries ─────────────────────────────────────────────────
  const { data: sponsors = [] } = useQuery({
    queryKey: ['admin-sponsors'],
    queryFn: async () => {
      const { data } = await supabase.from('sponsors').select('*').order('display_order');
      return (data || []) as Sponsor[];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['admin-sponsor-contacts'],
    queryFn: async () => {
      const { data } = await supabase.from('sponsor_contacts' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['admin-sponsor-campaigns'],
    queryFn: async () => {
      const { data } = await supabase.from('sponsor_campaigns' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['admin-sponsor-contracts'],
    queryFn: async () => {
      const { data } = await supabase.from('sponsor_contracts' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['admin-sponsor-notes'],
    queryFn: async () => {
      const { data } = await supabase.from('sponsor_notes' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  // ─── Alerts ───────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const items: { type: string; message: string; sponsorId: string; sponsorTitle: string }[] = [];
    const now = new Date();
    sponsors.forEach(s => {
      if (s.end_date) {
        const end = new Date(s.end_date);
        const diff = differenceInDays(end, now);
        if (diff < 0) {
          items.push({ type: 'expired', message: `Expirado há ${Math.abs(diff)} dias`, sponsorId: s.id, sponsorTitle: s.title });
        } else if (diff <= 7) {
          items.push({ type: 'expiring', message: `Expira em ${diff} dia(s)`, sponsorId: s.id, sponsorTitle: s.title });
        }
      }
      if (!s.active) {
        items.push({ type: 'inactive', message: 'Banner inativo', sponsorId: s.id, sponsorTitle: s.title });
      }
    });
    return items;
  }, [sponsors]);

  // ─── Filters ──────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');

  const filteredSponsors = useMemo(() => {
    return sponsors.filter(s => {
      if (searchTerm && !s.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (statusFilter === 'active' && !s.active) return false;
      if (statusFilter === 'inactive' && s.active) return false;
      if (statusFilter === 'expired' && !(s.end_date && new Date(s.end_date) < new Date())) return false;
      if (tierFilter !== 'all' && s.tier !== tierFilter) return false;
      return true;
    });
  }, [sponsors, searchTerm, statusFilter, tierFilter]);

  // ─── Dialogs ──────────────────────────────────────────────────────
  const [linkDialog, setLinkDialog] = useState(false);
  const [linkForm, setLinkForm] = useState({ sponsor_id: '', user_email: '', company_name: '', contact_name: '', phone: '' });

  const [campaignDialog, setCampaignDialog] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ sponsor_id: '', name: '', description: '', status: 'draft', start_date: '', end_date: '', budget: '' });

  const [contractDialog, setContractDialog] = useState(false);
  const [contractForm, setContractForm] = useState({ sponsor_id: '', contract_number: '', status: 'draft', start_date: '', end_date: '', value: '', notes: '' });

  const [noteDialog, setNoteDialog] = useState(false);
  const [noteForm, setNoteForm] = useState({ sponsor_id: '', content: '' });

  // ─── Mutations ────────────────────────────────────────────────────
  const linkMutation = useMutation({
    mutationFn: async () => {
      // Find user by email
      const { data: profiles } = await supabase.from('profiles').select('id, email').eq('email', linkForm.user_email).limit(1);
      if (!profiles || profiles.length === 0) throw new Error('Usuário não encontrado com esse e-mail');
      const userId = profiles[0].id;
      const { error } = await supabase.from('sponsor_contacts' as any).insert({
        sponsor_id: linkForm.sponsor_id,
        user_id: userId,
        company_name: linkForm.company_name,
        contact_name: linkForm.contact_name,
        phone: linkForm.phone,
        email: linkForm.user_email,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-contacts'] });
      toast.success('Patrocinador vinculado ao usuário!');
      setLinkDialog(false);
      setLinkForm({ sponsor_id: '', user_email: '', company_name: '', contact_name: '', phone: '' });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao vincular'),
  });

  const campaignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sponsor_campaigns' as any).insert({
        sponsor_id: campaignForm.sponsor_id,
        name: campaignForm.name,
        description: campaignForm.description,
        status: campaignForm.status,
        start_date: campaignForm.start_date || null,
        end_date: campaignForm.end_date || null,
        budget: campaignForm.budget ? Number(campaignForm.budget) : 0,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-campaigns'] });
      toast.success('Campanha criada!');
      setCampaignDialog(false);
      setCampaignForm({ sponsor_id: '', name: '', description: '', status: 'draft', start_date: '', end_date: '', budget: '' });
    },
    onError: () => toast.error('Erro ao criar campanha'),
  });

  const contractMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sponsor_contracts' as any).insert({
        sponsor_id: contractForm.sponsor_id,
        contract_number: contractForm.contract_number,
        status: contractForm.status,
        start_date: contractForm.start_date || null,
        end_date: contractForm.end_date || null,
        value: contractForm.value ? Number(contractForm.value) : 0,
        notes: contractForm.notes,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-contracts'] });
      toast.success('Contrato criado!');
      setContractDialog(false);
      setContractForm({ sponsor_id: '', contract_number: '', status: 'draft', start_date: '', end_date: '', value: '', notes: '' });
    },
    onError: () => toast.error('Erro ao criar contrato'),
  });

  const noteMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase.from('sponsor_notes' as any).insert({
        sponsor_id: noteForm.sponsor_id,
        author_id: user.id,
        content: noteForm.content,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-notes'] });
      toast.success('Nota adicionada!');
      setNoteDialog(false);
      setNoteForm({ sponsor_id: '', content: '' });
    },
    onError: () => toast.error('Erro ao salvar nota'),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('sponsor_notes' as any).delete().eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sponsor-notes'] }),
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('sponsor_campaigns' as any).delete().eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sponsor-campaigns'] }),
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('sponsor_contracts' as any).delete().eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sponsor-contracts'] }),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('sponsor_contacts' as any).delete().eq('id', id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-contacts'] });
      toast.success('Vínculo removido');
    },
  });

  // ─── Sponsor select helper ───────────────────────────────────────
  const SponsorSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Selecionar patrocinador" /></SelectTrigger>
      <SelectContent>
        {sponsors.map(s => (
          <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const getSponsorTitle = (id: string) => sponsors.find(s => s.id === id)?.title || id;

  if (adminLoading) return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;
  if (!isAdmin) { navigate('/'); return null; }

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">CRM Patrocinadores</h1>
          <p className="text-sm text-muted-foreground">Gestão completa de relacionamento comercial</p>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" /> Alertas ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {alerts.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={a.type === 'expired' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {a.type === 'expired' ? 'Expirado' : a.type === 'expiring' ? 'Expirando' : 'Inativo'}
                      </Badge>
                      <span className="font-medium">{a.sponsorTitle}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{a.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <Megaphone className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{sponsors.length}</p>
                <p className="text-[11px] text-muted-foreground">Patrocinadores</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{contacts.length}</p>
                <p className="text-[11px] text-muted-foreground">Vínculos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{campaigns.length}</p>
                <p className="text-[11px] text-muted-foreground">Campanhas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{contracts.length}</p>
                <p className="text-[11px] text-muted-foreground">Contratos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <Eye className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{sponsors.reduce((a, s) => a + s.impressions, 0).toLocaleString('pt-BR')}</p>
                <p className="text-[11px] text-muted-foreground">Impressões totais</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="links">Vínculos</TabsTrigger>
            <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
            <TabsTrigger value="contracts">Contratos</TabsTrigger>
            <TabsTrigger value="notes">Notas Internas</TabsTrigger>
          </TabsList>

          {/* ─── Overview Tab ──────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar patrocinador..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                  <SelectItem value="expired">Expirados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Planos</SelectItem>
                  <SelectItem value="basic">Básico</SelectItem>
                  <SelectItem value="destaque">Destaque</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patrocinador</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Impressões</TableHead>
                    <TableHead>Cliques</TableHead>
                    <TableHead>CTR</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vínculo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSponsors.map(s => {
                    const expired = s.end_date && new Date(s.end_date) < new Date();
                    const ctr = s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(1) : '0.0';
                    const hasContact = contacts.some((c: any) => c.sponsor_id === s.id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.title}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize text-[10px]">{s.tier}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {s.start_date ? format(new Date(s.start_date), 'dd/MM/yy') : '—'} → {s.end_date ? format(new Date(s.end_date), 'dd/MM/yy') : '∞'}
                        </TableCell>
                        <TableCell className="text-xs"><span className="flex items-center gap-1"><Eye className="h-3 w-3" />{s.impressions.toLocaleString('pt-BR')}</span></TableCell>
                        <TableCell className="text-xs"><span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" />{s.clicks.toLocaleString('pt-BR')}</span></TableCell>
                        <TableCell className="text-xs font-medium">{ctr}%</TableCell>
                        <TableCell>
                          <Badge variant={expired ? 'destructive' : s.active ? 'default' : 'secondary'} className="text-[10px]">
                            {expired ? 'Expirado' : s.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {hasContact ? (
                            <Badge variant="outline" className="text-[10px] text-accent">Vinculado</Badge>
                          ) : (
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
                              setLinkForm(p => ({ ...p, sponsor_id: s.id }));
                              setLinkDialog(true);
                            }}>
                              <Plus className="h-3 w-3 mr-1" /> Vincular
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredSponsors.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum patrocinador encontrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ─── Links Tab ─────────────────────────────────────────── */}
          <TabsContent value="links" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Vínculos Patrocinador ↔ Usuário</h2>
              <Button size="sm" onClick={() => setLinkDialog(true)}><Plus className="h-4 w-4 mr-1" /> Vincular</Button>
            </div>
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patrocinador</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{getSponsorTitle(c.sponsor_id)}</TableCell>
                      <TableCell>{c.contact_name || '—'}</TableCell>
                      <TableCell>{c.company_name || '—'}</TableCell>
                      <TableCell className="text-xs">{c.email || '—'}</TableCell>
                      <TableCell className="text-xs">{c.phone || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => unlinkMutation.mutate(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {contacts.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum vínculo.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ─── Campaigns Tab ─────────────────────────────────────── */}
          <TabsContent value="campaigns" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Campanhas</h2>
              <Button size="sm" onClick={() => setCampaignDialog(true)}><Plus className="h-4 w-4 mr-1" /> Nova Campanha</Button>
            </div>
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patrocinador</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Orçamento</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{getSponsorTitle(c.sponsor_id)}</TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-[10px] capitalize">{c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.start_date ? format(new Date(c.start_date), 'dd/MM/yy') : '—'} → {c.end_date ? format(new Date(c.end_date), 'dd/MM/yy') : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.budget > 0 ? `R$ ${Number(c.budget).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => deleteCampaignMutation.mutate(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {campaigns.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma campanha.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ─── Contracts Tab ─────────────────────────────────────── */}
          <TabsContent value="contracts" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Contratos</h2>
              <Button size="sm" onClick={() => setContractDialog(true)}><Plus className="h-4 w-4 mr-1" /> Novo Contrato</Button>
            </div>
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patrocinador</TableHead>
                    <TableHead>Nº Contrato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{getSponsorTitle(c.sponsor_id)}</TableCell>
                      <TableCell>{c.contract_number || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-[10px] capitalize">{c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.start_date ? format(new Date(c.start_date), 'dd/MM/yy') : '—'} → {c.end_date ? format(new Date(c.end_date), 'dd/MM/yy') : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.value > 0 ? `R$ ${Number(c.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => deleteContractMutation.mutate(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {contracts.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum contrato.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ─── Notes Tab ─────────────────────────────────────────── */}
          <TabsContent value="notes" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Notas Internas</h2>
              <Button size="sm" onClick={() => setNoteDialog(true)}><Plus className="h-4 w-4 mr-1" /> Nova Nota</Button>
            </div>
            <div className="space-y-3">
              {notes.length > 0 ? notes.map((n: any) => (
                <Card key={n.id}>
                  <CardContent className="py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StickyNote className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium">{getSponsorTitle(n.sponsor_id)}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(n.created_at), 'dd/MM/yy HH:mm')}</span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{n.content}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteNoteMutation.mutate(n.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              )) : (
                <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma nota.</CardContent></Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Link Dialog ─────────────────────────────────────────── */}
      <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vincular Patrocinador a Usuário</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); linkMutation.mutate(); }} className="space-y-4">
            <div><Label>Patrocinador *</Label><SponsorSelect value={linkForm.sponsor_id} onChange={v => setLinkForm(p => ({ ...p, sponsor_id: v }))} /></div>
            <div><Label>E-mail do Usuário *</Label><Input required type="email" value={linkForm.user_email} onChange={e => setLinkForm(p => ({ ...p, user_email: e.target.value }))} placeholder="usuario@email.com" /></div>
            <div><Label>Nome do Contato</Label><Input value={linkForm.contact_name} onChange={e => setLinkForm(p => ({ ...p, contact_name: e.target.value }))} /></div>
            <div><Label>Empresa</Label><Input value={linkForm.company_name} onChange={e => setLinkForm(p => ({ ...p, company_name: e.target.value }))} /></div>
            <div><Label>Telefone</Label><Input value={linkForm.phone} onChange={e => setLinkForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setLinkDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={linkMutation.isPending}>Vincular</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Campaign Dialog ─────────────────────────────────────── */}
      <Dialog open={campaignDialog} onOpenChange={setCampaignDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); campaignMutation.mutate(); }} className="space-y-4">
            <div><Label>Patrocinador *</Label><SponsorSelect value={campaignForm.sponsor_id} onChange={v => setCampaignForm(p => ({ ...p, sponsor_id: v }))} /></div>
            <div><Label>Nome *</Label><Input required value={campaignForm.name} onChange={e => setCampaignForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Textarea value={campaignForm.description} onChange={e => setCampaignForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>Status</Label>
              <Select value={campaignForm.status} onValueChange={v => setCampaignForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Início</Label><Input type="date" value={campaignForm.start_date} onChange={e => setCampaignForm(p => ({ ...p, start_date: e.target.value }))} /></div>
              <div><Label>Fim</Label><Input type="date" value={campaignForm.end_date} onChange={e => setCampaignForm(p => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
            <div><Label>Orçamento (R$)</Label><Input type="number" step="0.01" value={campaignForm.budget} onChange={e => setCampaignForm(p => ({ ...p, budget: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCampaignDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={campaignMutation.isPending}>Criar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Contract Dialog ─────────────────────────────────────── */}
      <Dialog open={contractDialog} onOpenChange={setContractDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Contrato</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); contractMutation.mutate(); }} className="space-y-4">
            <div><Label>Patrocinador *</Label><SponsorSelect value={contractForm.sponsor_id} onChange={v => setContractForm(p => ({ ...p, sponsor_id: v }))} /></div>
            <div><Label>Nº do Contrato</Label><Input value={contractForm.contract_number} onChange={e => setContractForm(p => ({ ...p, contract_number: e.target.value }))} /></div>
            <div><Label>Status</Label>
              <Select value={contractForm.status} onValueChange={v => setContractForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="expired">Expirado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Início</Label><Input type="date" value={contractForm.start_date} onChange={e => setContractForm(p => ({ ...p, start_date: e.target.value }))} /></div>
              <div><Label>Fim</Label><Input type="date" value={contractForm.end_date} onChange={e => setContractForm(p => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={contractForm.value} onChange={e => setContractForm(p => ({ ...p, value: e.target.value }))} /></div>
            <div><Label>Observações</Label><Textarea value={contractForm.notes} onChange={e => setContractForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setContractDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={contractMutation.isPending}>Criar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Note Dialog ─────────────────────────────────────────── */}
      <Dialog open={noteDialog} onOpenChange={setNoteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Nota Interna</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); noteMutation.mutate(); }} className="space-y-4">
            <div><Label>Patrocinador *</Label><SponsorSelect value={noteForm.sponsor_id} onChange={v => setNoteForm(p => ({ ...p, sponsor_id: v }))} /></div>
            <div><Label>Conteúdo *</Label><Textarea required rows={4} value={noteForm.content} onChange={e => setNoteForm(p => ({ ...p, content: e.target.value }))} placeholder="Anotação interna sobre o patrocinador..." /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNoteDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={noteMutation.isPending}>Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminSponsorCrmPage;
