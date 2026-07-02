import { useState, useMemo, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trash2, Pencil, ExternalLink, CheckCircle, XCircle, Search, Plus, Eye, ToggleLeft, ToggleRight, Archive, Briefcase, Clock, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAdminBulkActions } from '@/hooks/useAdminBulkActions';
import BulkActionsBar from '@/components/admin/BulkActionsBar';
import SelectionCheckbox from '@/components/admin/SelectionCheckbox';
import { logAuditAction } from '@/hooks/useAuditLog';
import PaginationControls from '@/components/PaginationControls';
import { parseJobText } from '@/lib/jobTextParser';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sparkles } from 'lucide-react';

const PAGE_SIZE = 20;

const OPPORTUNITY_TYPES = [
  { value: 'servico', label: 'Serviço' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'emprego', label: 'Emprego' },
];

const JOB_TYPES = [
  { value: '', label: 'Não especificado' },
  { value: 'clt', label: 'CLT' },
  { value: 'pj', label: 'PJ / Autônomo' },
  { value: 'estagio', label: 'Estágio' },
  { value: 'temporario', label: 'Temporário' },
  { value: 'aprendiz', label: 'Aprendiz' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'meio-periodo', label: 'Meio período' },
];

const WORK_MODELS = [
  { value: '', label: 'Não especificado' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'remoto', label: 'Remoto' },
  { value: 'hibrido', label: 'Híbrido' },
];

const emptyForm = {
  title: '', subtitle: '', description: '', category_id: '', opportunity_type: 'servico',
  job_type: '', work_model: '', city: '', state: '', neighborhood: '',
  contact_name: '', contact_phone: '', whatsapp: '', salary: '',
  benefits: '', activities: '', requirements: '', schedule: '',
  deadline: '', status: 'active', approval_status: 'approved',
  cover_image_url: '', user_id: '',
};

const AdminJobsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const queryClient = useQueryClient();
  const [editJob, setEditJob] = useState<any>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [isCreating, setIsCreating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pasteText, setPasteText] = useState('');
  const [detectedFields, setDetectedFields] = useState<string[]>([]);
  const [dialogTab, setDialogTab] = useState<'paste' | 'form'>('paste');

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('jobs')
        .select('*, categories(name, icon)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(500);
      return data || [];
    },
    enabled: isAdmin,
  });

  // Fetch profiles for creator names
  const { data: profiles = [] } = useQuery({
    queryKey: ['admin-jobs-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email');
      return data || [];
    },
    enabled: isAdmin,
  });

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach((p: any) => { m[p.id] = p.full_name || p.email || p.id; });
    return m;
  }, [profiles]);

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-jobs-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id, name').is('deleted_at', null).order('name');
      return data || [];
    },
    enabled: isAdmin,
  });

  const handleSmartParse = () => {
    if (!pasteText.trim()) return;
    const parsed = parseJobText(pasteText, categories);
    setEditForm(prev => ({
      ...prev,
      title: parsed.title || prev.title,
      subtitle: parsed.subtitle || prev.subtitle,
      description: parsed.description || prev.description,
      category_id: parsed.category_id || prev.category_id,
      opportunity_type: parsed.opportunity_type || prev.opportunity_type,
      job_type: parsed.job_type || prev.job_type,
      work_model: parsed.work_model || prev.work_model,
      activities: parsed.activities || prev.activities,
      requirements: parsed.requirements || prev.requirements,
      benefits: parsed.benefits || prev.benefits,
      schedule: parsed.schedule || prev.schedule,
      salary: parsed.salary || prev.salary,
      city: parsed.city || prev.city,
      state: parsed.state || prev.state,
      neighborhood: parsed.neighborhood || prev.neighborhood,
      contact_name: parsed.contact_name || prev.contact_name,
      contact_phone: parsed.contact_phone || prev.contact_phone,
      whatsapp: parsed.whatsapp || prev.whatsapp,
    }));
    setDetectedFields(parsed.detectedFields);
    setDialogTab('form');
    toast.success(`IA extraiu ${parsed.detectedFields.length} campos automaticamente!`);
  };

  const bulk = useAdminBulkActions({
    table: 'jobs',
    resourceType: 'job',
    onComplete: () => queryClient.invalidateQueries({ queryKey: ['admin-jobs'] }),
  });

  // Derive unique cities from jobs data
  const uniqueCities = useMemo(() => {
    const cities = new Set(jobs.map((j: any) => j.city).filter(Boolean));
    return Array.from(cities).sort() as string[];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    let list = filter === 'all' ? jobs : jobs.filter((j: any) => j.approval_status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((j: any) =>
        (j.title || '').toLowerCase().includes(q) ||
        (j.city || '').toLowerCase().includes(q) ||
        (j.contact_name || '').toLowerCase().includes(q)
      );
    }
    if (cityFilter) list = list.filter((j: any) => j.city === cityFilter);
    if (categoryFilter) list = list.filter((j: any) => j.category_id === categoryFilter);
    return list;
  }, [jobs, filter, search, cityFilter, categoryFilter]);

  const pendingCount = jobs.filter((j: any) => j.approval_status === 'pending').length;
  const activeCount = jobs.filter((j: any) => j.status === 'active' && j.approval_status === 'approved').length;
  const expiredCount = jobs.filter((j: any) => j.deadline && new Date(j.deadline) < new Date()).length;
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const paginated = filteredJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleToggleStatus = async (job: any) => {
    const newStatus = job.status === 'active' ? 'inactive' : 'active';
    await supabase.from('jobs').update({ status: newStatus } as any).eq('id', job.id);
    toast.success(newStatus === 'active' ? 'Vaga ativada' : 'Vaga desativada');
    queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta vaga?')) return;
    await supabase.from('jobs').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
    toast.success('Vaga movida para lixeira');
    await logAuditAction({ action: 'soft_delete', resource_type: 'job', resource_id: id });
    queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
  };

  const notifyUser = async (job: any, action: 'approved' | 'rejected') => {
    if (!job?.user_id) return;
    const msg = action === 'approved'
      ? `✅ Sua vaga "${job.title}" foi aprovada e já está visível no portal!`
      : `❌ Sua vaga "${job.title}" foi rejeitada. Entre em contato para mais informações.`;
    await supabase.from('notifications').insert({
      user_id: job.user_id,
      title: action === 'approved' ? 'Vaga aprovada' : 'Vaga rejeitada',
      message: msg,
      type: 'system',
    });
  };

  const handleApprove = async (id: string) => {
    const job = jobs.find((j: any) => j.id === id);
    await supabase.from('jobs').update({ approval_status: 'approved' } as any).eq('id', id);
    toast.success('Vaga aprovada!');
    await notifyUser(job, 'approved');
    await logAuditAction({ action: 'approve', resource_type: 'job', resource_id: id });
    queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
  };

  const handleReject = async (id: string) => {
    const job = jobs.find((j: any) => j.id === id);
    await supabase.from('jobs').update({ approval_status: 'rejected', status: 'inactive' } as any).eq('id', id);
    toast.success('Vaga rejeitada');
    await notifyUser(job, 'rejected');
    await logAuditAction({ action: 'reject', resource_type: 'job', resource_id: id });
    queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
  };

  const handleEdit = (job: any) => {
    setEditJob(job);
    setIsCreating(false);
    setDialogTab('form');
    setDetectedFields([]);
    setEditForm({
      title: job.title || '', subtitle: job.subtitle || '',
      description: job.description || '', category_id: job.category_id || '',
      opportunity_type: job.opportunity_type || 'servico',
      job_type: job.job_type || '', work_model: job.work_model || '',
      city: job.city || '', state: job.state || '', neighborhood: job.neighborhood || '',
      contact_name: job.contact_name || '', contact_phone: job.contact_phone || '',
      whatsapp: job.whatsapp || '', salary: job.salary || '',
      benefits: job.benefits || '', activities: job.activities || '',
      requirements: job.requirements || '', schedule: job.schedule || '',
      deadline: job.deadline || '', status: job.status || 'active',
      approval_status: job.approval_status || 'approved',
      cover_image_url: job.cover_image_url || '',
      user_id: job.user_id || '',
    });
  };

  const handleCreate = () => {
    setEditJob({ _new: true });
    setIsCreating(true);
    setEditForm({ ...emptyForm });
    setPasteText('');
    setDetectedFields([]);
    setDialogTab('paste');
  };

  const generateSlug = (title: string, city: string) => {
    const base = `${title}-${city}`.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${base}-${Date.now().toString(36)}`;
  };

  const handleSave = async () => {
    if (!editForm.title.trim()) { toast.error('Título é obrigatório'); return; }

    if (isCreating) {
      // Admin creates with auto-approved status
      const { data: adminUser } = await supabase.auth.getUser();
      if (!adminUser?.user) { toast.error('Não autenticado'); return; }
      const slug = generateSlug(editForm.title, editForm.city);
      const userId = editForm.user_id || adminUser.user.id;
      const { user_id: _uid, ...rest } = editForm;
      const payload: any = {
        ...rest,
        user_id: userId,
        slug,
        category_id: editForm.category_id || null,
        deadline: editForm.deadline || null,
      };
      const { error } = await supabase.from('jobs').insert(payload);
      if (error) { toast.error('Erro ao criar: ' + error.message); return; }
      toast.success('Vaga criada com sucesso!');
      await logAuditAction({ action: 'create', resource_type: 'job' });
    } else {
      const { user_id: formUserId, ...rest } = editForm;
      const payload: any = { ...rest, category_id: editForm.category_id || null, deadline: editForm.deadline || null, ...(formUserId ? { user_id: formUserId } : {}) };
      const { error } = await supabase.from('jobs').update(payload).eq('id', editJob.id);
      if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
      toast.success('Vaga atualizada');
      await logAuditAction({ action: 'update', resource_type: 'job', resource_id: editJob.id });
    }

    setEditJob(null);
    queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
  };

  const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
  const labelClass = "mb-1 block text-sm font-medium text-foreground";

  if (adminLoading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Gestão de Vagas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Controle absoluto sobre vagas da plataforma</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.href = '/admin/lixeira?type=job'}>
            <Archive className="h-4 w-4 mr-1" /> Lixeira
          </Button>
          <Button variant="accent" size="sm" onClick={handleCreate}><Plus className="mr-1 h-4 w-4" /> Nova Vaga</Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <Briefcase className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-1 text-lg font-bold text-foreground">{jobs.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <CheckCircle className="mx-auto h-5 w-5 text-green-600" />
          <p className="mt-1 text-lg font-bold text-foreground">{activeCount}</p>
          <p className="text-xs text-muted-foreground">Ativas</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <Clock className="mx-auto h-5 w-5 text-amber-600" />
          <p className="mt-1 text-lg font-bold text-foreground">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-red-600" />
          <p className="mt-1 text-lg font-bold text-foreground">{expiredCount}</p>
          <p className="text-xs text-muted-foreground">Expiradas</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'all', label: `Todas (${jobs.length})` },
            { value: 'pending', label: `Pendentes (${pendingCount})` },
            { value: 'approved', label: 'Aprovadas' },
            { value: 'rejected', label: 'Rejeitadas' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value as any); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${filter === f.value ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar vagas..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <select value={cityFilter} onChange={e => { setCityFilter(e.target.value); setPage(1); }} className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground">
          <option value="">Todas as cidades</option>
          {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground">
          <option value="">Todas as categorias</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {bulk.hasSelection && (
        <div className="mt-3">
          <BulkActionsBar
            count={bulk.selectionCount}
            onClear={bulk.clearSelection}
            onDelete={bulk.bulkSoftDelete}
            onExport={() => bulk.exportSelected(filteredJobs, 'vagas')}
            loading={bulk.bulkLoading}
          >
            <Button size="sm" variant="outline" onClick={() => bulk.bulkUpdate({ approval_status: 'approved' })} disabled={bulk.bulkLoading} className="text-green-600 border-green-200">
              <CheckCircle className="mr-1 h-3.5 w-3.5" /> Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk.bulkUpdate({ approval_status: 'rejected', status: 'inactive' })} disabled={bulk.bulkLoading} className="text-red-600 border-red-200">
              <XCircle className="mr-1 h-3.5 w-3.5" /> Rejeitar
            </Button>
          </BulkActionsBar>
        </div>
      )}

      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Carregando...</p>
      ) : (
        <div className="mt-6 space-y-2">
          {paginated.map((job: any) => (
            <div key={job.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <SelectionCheckbox
                  checked={bulk.selectedIds.has(job.id)}
                  onCheckedChange={() => bulk.toggleSelection(job.id)}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground text-sm line-clamp-1">{job.title}</h3>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${job.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {job.status === 'active' ? 'Ativa' : 'Inativa'}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      job.approval_status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      job.approval_status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {job.approval_status === 'pending' ? '⏳ Pendente' : job.approval_status === 'rejected' ? '❌ Rejeitada' : '✅ Aprovada'}
                    </span>
                    {job.deadline && new Date(job.deadline) < new Date() && (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Expirada</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(job.categories as any)?.name || 'Sem categoria'} · {job.city || '?'} · {new Date(job.created_at).toLocaleDateString('pt-BR')}
                    {job.view_count > 0 && <> · <Eye className="inline h-3 w-3" /> {job.view_count}</>}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Criado por: {profileMap[job.user_id] || job.user_id?.slice(0, 8)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                  <Switch
                    checked={job.status === 'active'}
                    onCheckedChange={() => handleToggleStatus(job)}
                    title={job.status === 'active' ? 'Desativar' : 'Ativar'}
                  />
                  {job.approval_status === 'pending' && (
                    <>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleApprove(job.id)} title="Aprovar">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleReject(job.id)} title="Rejeitar">
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => window.open(`/vaga/${job.slug || job.id}`, '_blank')}><ExternalLink className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(job)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDelete(job.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </div>
          ))}
          {filteredJobs.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma vaga encontrada.</p>}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4">
          <PaginationControls currentPage={page} totalItems={filteredJobs.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}

      {/* Full Edit / Create Dialog */}
      <Dialog open={!!editJob} onOpenChange={() => setEditJob(null)}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isCreating ? 'Nova Vaga' : 'Editar Vaga'}</DialogTitle></DialogHeader>

          {isCreating && (
            <Tabs value={dialogTab} onValueChange={v => setDialogTab(v as any)} className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="paste" className="flex-1 gap-1.5">
                  <Sparkles className="h-4 w-4" /> Colar Texto
                </TabsTrigger>
                <TabsTrigger value="form" className="flex-1">Formulário</TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="space-y-3 mt-3">
                <p className="text-sm text-muted-foreground">
                  Cole o texto da vaga abaixo e a IA irá extrair os campos automaticamente.
                </p>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  rows={10}
                  placeholder="Cole aqui o texto da vaga (ex: título, descrição, requisitos, salário, cidade...)"
                  className={inputClass}
                />
                <Button variant="accent" className="w-full gap-2" onClick={handleSmartParse} disabled={!pasteText.trim()}>
                  <Sparkles className="h-4 w-4" /> Extrair Dados com IA
                </Button>
                {detectedFields.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {detectedFields.map((f, i) => (
                      <span key={i} className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">{f}</span>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="form" className="mt-3">
                {detectedFields.length > 0 && (
                  <div className="mb-4 rounded-lg border border-accent/20 bg-accent/5 p-3">
                    <p className="text-xs font-medium text-accent mb-1.5">✨ Campos extraídos automaticamente:</p>
                    <div className="flex flex-wrap gap-1">
                      {detectedFields.map((f, i) => (
                        <span key={i} className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
          </TabsContent>
            </Tabs>
          )}

          <div className={`space-y-4 ${isCreating && dialogTab === 'paste' ? 'hidden' : ''} ${isCreating ? '' : 'mt-4'}`}>
            <div>
              <label className={labelClass}>Título *</label>
              <input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Subtítulo</label>
              <input value={editForm.subtitle} onChange={e => setEditForm(p => ({ ...p, subtitle: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Descrição</label>
              <textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={4} className={inputClass} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Categoria</label>
                <select value={editForm.category_id} onChange={e => setEditForm(p => ({ ...p, category_id: e.target.value }))} className={inputClass}>
                  <option value="">Sem categoria</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tipo de oportunidade</label>
                <select value={editForm.opportunity_type} onChange={e => setEditForm(p => ({ ...p, opportunity_type: e.target.value }))} className={inputClass}>
                  {OPPORTUNITY_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tipo de contrato</label>
                <select value={editForm.job_type} onChange={e => setEditForm(p => ({ ...p, job_type: e.target.value }))} className={inputClass}>
                  {JOB_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Modelo de trabalho</label>
                <select value={editForm.work_model} onChange={e => setEditForm(p => ({ ...p, work_model: e.target.value }))} className={inputClass}>
                  {WORK_MODELS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Cidade</label>
                <input value={editForm.city} onChange={e => setEditForm(p => ({ ...p, city: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Estado (UF)</label>
                <input value={editForm.state} onChange={e => setEditForm(p => ({ ...p, state: e.target.value }))} className={inputClass} maxLength={2} />
              </div>
              <div>
                <label className={labelClass}>Bairro</label>
                <input value={editForm.neighborhood} onChange={e => setEditForm(p => ({ ...p, neighborhood: e.target.value }))} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Nome do contato</label>
                <input value={editForm.contact_name} onChange={e => setEditForm(p => ({ ...p, contact_name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Telefone</label>
                <input value={editForm.contact_phone} onChange={e => setEditForm(p => ({ ...p, contact_phone: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>WhatsApp</label>
                <input value={editForm.whatsapp} onChange={e => setEditForm(p => ({ ...p, whatsapp: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Salário</label>
                <input value={editForm.salary} onChange={e => setEditForm(p => ({ ...p, salary: e.target.value }))} className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Atividades</label>
              <textarea value={editForm.activities} onChange={e => setEditForm(p => ({ ...p, activities: e.target.value }))} rows={3} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Requisitos</label>
              <textarea value={editForm.requirements} onChange={e => setEditForm(p => ({ ...p, requirements: e.target.value }))} rows={3} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Benefícios</label>
                <textarea value={editForm.benefits} onChange={e => setEditForm(p => ({ ...p, benefits: e.target.value }))} rows={2} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Horário</label>
                <input value={editForm.schedule} onChange={e => setEditForm(p => ({ ...p, schedule: e.target.value }))} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Prazo (deadline)</label>
                <input type="date" value={editForm.deadline} onChange={e => setEditForm(p => ({ ...p, deadline: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Imagem de capa (URL)</label>
                <input value={editForm.cover_image_url} onChange={e => setEditForm(p => ({ ...p, cover_image_url: e.target.value }))} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Status</label>
                <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} className={inputClass}>
                  <option value="active">Ativa</option>
                  <option value="inactive">Inativa</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Aprovação</label>
                <select value={editForm.approval_status} onChange={e => setEditForm(p => ({ ...p, approval_status: e.target.value }))} className={inputClass}>
                  <option value="approved">Aprovada</option>
                  <option value="pending">Pendente</option>
                  <option value="rejected">Rejeitada</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Proprietário (user_id)</label>
              <select value={editForm.user_id} onChange={e => setEditForm(p => ({ ...p, user_id: e.target.value }))} className={inputClass}>
                <option value="">{isCreating ? 'Eu mesmo (admin)' : 'Selecionar usuário'}</option>
                {profiles.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.full_name || p.email} ({p.id.slice(0, 8)})</option>
                ))}
              </select>
            </div>

            <Button variant="accent" className="w-full" onClick={handleSave}>
              {isCreating ? 'Criar Vaga' : 'Salvar Alterações'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminJobsPage;
