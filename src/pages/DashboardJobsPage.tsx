import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ExternalLink, Copy, CopyPlus, Upload } from 'lucide-react';
import ImageUploadField from '@/components/ImageUploadField';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sanitizePhone, isValidWhatsApp, autoFillWhatsApp } from '@/lib/whatsapp';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SITE_BASE_URL } from '@/hooks/useSeoHead';

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

const sanitizeWhatsapp = sanitizePhone;

const emptyForm = {
  title: '', subtitle: '', category_id: '', opportunity_type: 'servico',
  description: '', activities: '', requirements: '', schedule: '', salary: '', benefits: '',
  city: '', state: '', neighborhood: '', contact_name: '', contact_phone: '',
  whatsapp: '', deadline: '', cover_image_url: '', status: 'active',
  job_type: '', work_model: '',
};

const getDefaultDeadline = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
};

const DashboardJobsPage = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'structured' | 'simple' | 'csv'>('structured');
  const [simpleText, setSimpleText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const profileType = (profile as any)?.profile_type || profile?.role || 'client';
  const canPostJobs = profileType === 'provider' || profileType === 'rh';

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [authLoading, user, navigate]);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['my-jobs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('jobs')
        .select('*, categories(name, icon)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['all-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id, name').order('name');
      return data || [];
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'whatsapp' ? sanitizeWhatsapp(value) : value }));
  };

  const generateSlug = (title: string, city: string) => {
    const base = `${title}-${city}`.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${base}-${Date.now().toString(36)}`;
  };

  const parseSimpleText = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const title = lines[0] || '';
    const cityMatch = text.match(/(?:local|cidade|localização)[:\s]*([^\n]+)/i);
    const salaryMatch = text.match(/(?:salário|salario|remuneração)[:\s]*([^\n]+)/i);
    const whatsappMatch = text.match(/(?:whatsapp|zap|wpp|contato)[:\s]*([\d\s()+-]+)/i);
    setForm(prev => ({
      ...prev,
      title: title.replace(/^vaga[:\s]*/i, ''),
      description: text,
      city: cityMatch?.[1]?.trim() || prev.city,
      salary: salaryMatch?.[1]?.trim() || prev.salary,
      whatsapp: whatsappMatch ? sanitizeWhatsapp(whatsappMatch[1]) : prev.whatsapp,
      deadline: prev.deadline || getDefaultDeadline(),
    }));
  };

  const getApprovalStatus = () => {
    if (profileType === 'rh') return 'approved';
    return 'pending';
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.title.trim()) { toast.error('Título é obrigatório'); return; }

    // Auto-fill WhatsApp from phone if empty
    const finalWhatsapp = autoFillWhatsApp(form.whatsapp, form.contact_phone);
    if (!finalWhatsapp) { toast.error('WhatsApp é obrigatório'); return; }
    if (!isValidWhatsApp(finalWhatsapp)) { toast.error('Número de WhatsApp inválido (deve ter 10 ou 11 dígitos)'); return; }
    setForm(prev => ({ ...prev, whatsapp: finalWhatsapp }));

    setSaving(true);
    const slug = generateSlug(form.title, form.city);
    const approvalStatus = editingId ? undefined : getApprovalStatus();
    const payload: any = {
      ...form,
      user_id: user.id,
      category_id: form.category_id || null,
      slug: editingId ? undefined : slug,
      deadline: form.deadline || getDefaultDeadline(),
      ...(approvalStatus ? { approval_status: approvalStatus } : {}),
    };
    if (editingId) { delete payload.slug; delete payload.user_id; delete payload.approval_status; }

    const { error } = editingId
      ? await supabase.from('jobs').update(payload).eq('id', editingId)
      : await supabase.from('jobs').insert(payload);

    if (error) toast.error('Erro ao salvar vaga');
    else {
      const msg = editingId ? 'Vaga atualizada!' : profileType === 'rh' ? 'Vaga publicada!' : 'Vaga enviada para aprovação!';
      toast.success(msg);
    }

    setSaving(false);
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
  };

  const handleEdit = (job: any) => {
    setForm({
      title: job.title || '', subtitle: job.subtitle || '',
      category_id: job.category_id || '', opportunity_type: job.opportunity_type || 'servico',
      description: job.description || '', activities: job.activities || '',
      requirements: job.requirements || '', schedule: job.schedule || '',
      salary: job.salary || '', benefits: job.benefits || '',
      city: job.city || '', state: job.state || '', neighborhood: job.neighborhood || '',
      contact_name: job.contact_name || '', contact_phone: job.contact_phone || '',
      whatsapp: job.whatsapp || '', deadline: job.deadline || '',
      cover_image_url: job.cover_image_url || '', status: job.status || 'active',
      job_type: (job as any).job_type || '', work_model: (job as any).work_model || '',
    });
    setEditingId(job.id);
    setMode('structured');
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta vaga?')) return;
    await supabase.from('jobs').delete().eq('id', id);
    toast.success('Vaga excluída');
    queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
  };

  const openNew = () => {
    setForm({ ...emptyForm, deadline: getDefaultDeadline() });
    setEditingId(null);
    setSimpleText('');
    setCsvText('');
    setDialogOpen(true);
  };

  const handleDuplicate = (job: any) => {
    setForm({
      title: `${job.title} (cópia)`, subtitle: job.subtitle || '',
      category_id: job.category_id || '', opportunity_type: job.opportunity_type || 'servico',
      description: job.description || '', activities: job.activities || '',
      requirements: job.requirements || '', schedule: job.schedule || '',
      salary: job.salary || '', benefits: job.benefits || '',
      city: job.city || '', state: job.state || '', neighborhood: job.neighborhood || '',
      contact_name: job.contact_name || '', contact_phone: job.contact_phone || '',
      whatsapp: job.whatsapp || '', deadline: getDefaultDeadline(),
      cover_image_url: job.cover_image_url || '', status: 'active',
      job_type: (job as any).job_type || '', work_model: (job as any).work_model || '',
    });
    setEditingId(null);
    setMode('structured');
    setDialogOpen(true);
    toast.info('Vaga duplicada — edite e publique');
  };

  const copyUrl = (job: any) => {
    const url = `${SITE_BASE_URL}/vaga/${job.slug || job.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  // CSV import
  const handleCsvImport = async () => {
    if (!user || !csvText.trim()) return;
    setCsvImporting(true);
    const lines = csvText.trim().split('\n');
    const header = lines[0].split(/[;,\t]/).map(h => h.trim().toLowerCase());
    const titleIdx = header.findIndex(h => h.includes('titulo') || h.includes('title') || h.includes('vaga'));
    const cityIdx = header.findIndex(h => h.includes('cidade') || h.includes('city'));
    const whatsIdx = header.findIndex(h => h.includes('whats') || h.includes('telefone') || h.includes('phone'));
    const descIdx = header.findIndex(h => h.includes('descri') || h.includes('description'));
    const salaryIdx = header.findIndex(h => h.includes('salar') || h.includes('remuner'));

    if (titleIdx === -1) { toast.error('CSV deve ter coluna "titulo" ou "title"'); setCsvImporting(false); return; }

    const rows = lines.slice(1).filter(l => l.trim());
    let created = 0;
    for (const row of rows) {
      const cols = row.split(/[;,\t]/).map(c => c.trim());
      const title = cols[titleIdx];
      if (!title) continue;
      const slug = generateSlug(title, cols[cityIdx] || '');
      await supabase.from('jobs').insert({
        user_id: user.id,
        title,
        city: cols[cityIdx] || '',
        whatsapp: whatsIdx >= 0 ? sanitizeWhatsapp(cols[whatsIdx] || '') : '',
        description: descIdx >= 0 ? cols[descIdx] || '' : '',
        salary: salaryIdx >= 0 ? cols[salaryIdx] || '' : '',
        slug,
        deadline: getDefaultDeadline(),
        approval_status: getApprovalStatus(),
      } as any);
      created++;
    }
    toast.success(`${created} vaga(s) importada(s)!`);
    setCsvImporting(false);
    setCsvText('');
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string || '');
      setMode('csv');
    };
    reader.readAsText(file);
  };

  const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
  const labelClass = "mb-1 block text-sm font-medium text-foreground";

  if (!canPostJobs) {
    return (
      <DashboardLayout>
        <h1 className="font-display text-2xl font-bold text-foreground">Vagas</h1>
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">Sua conta de cliente não tem permissão para postar vagas.</p>
          <p className="mt-2 text-sm text-muted-foreground">Entre em contato com o suporte para alterar seu tipo de conta.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Minhas Vagas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profileType === 'rh' ? 'Vagas publicadas automaticamente' : 'Vagas pendentes de aprovação'}
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> Importar CSV
          </Button>
          <Button variant="accent" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Nova Vaga</Button>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Carregando...</p>
      ) : jobs.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">Você ainda não publicou nenhuma vaga.</p>
          <Button variant="accent" className="mt-4" onClick={openNew}>Publicar primeira vaga</Button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {jobs.map((job: any) => (
            <div key={job.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-foreground truncate">{job.title}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${job.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {job.status === 'active' ? 'Ativa' : 'Inativa'}
                  </span>
                  {(job as any).approval_status === 'pending' && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Aguardando aprovação</span>
                  )}
                  {(job as any).approval_status === 'rejected' && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Rejeitada</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {(job.categories as any)?.icon} {(job.categories as any)?.name || 'Sem categoria'} · {job.city}{job.state ? `, ${job.state}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => copyUrl(job)} title="Copiar link"><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDuplicate(job)} title="Duplicar vaga"><CopyPlus className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => window.open(`/vaga/${job.slug || job.id}`, '_blank')}><ExternalLink className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(job)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(job.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Vaga' : 'Nova Vaga'}</DialogTitle>
          </DialogHeader>

          {!editingId && (
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="structured" className="flex-1">Estruturado</TabsTrigger>
                <TabsTrigger value="simple" className="flex-1">Colar Texto</TabsTrigger>
                <TabsTrigger value="csv" className="flex-1">CSV em Lote</TabsTrigger>
              </TabsList>

              <TabsContent value="simple" className="mt-4 space-y-4">
                <div>
                  <label className={labelClass}>Cole aqui o texto completo da vaga</label>
                  <textarea
                    value={simpleText}
                    onChange={(e) => setSimpleText(e.target.value)}
                    rows={10}
                    className={inputClass}
                    placeholder={"VAGA: Eletricista Residencial\nLocal: Curitiba - PR\nSalário: R$ 2.500\nWhatsApp: 41 99745-2053\n\nDescrição completa da vaga aqui..."}
                  />
                </div>
                <Button variant="outline" onClick={() => { parseSimpleText(simpleText); setMode('structured'); }}>
                  Extrair dados e revisar →
                </Button>
              </TabsContent>

              <TabsContent value="csv" className="mt-4 space-y-4">
                <div>
                  <label className={labelClass}>Cole o CSV (separado por vírgula, ponto-e-vírgula ou tab)</label>
                  <p className="text-xs text-muted-foreground mb-2">Colunas aceitas: titulo, cidade, whatsapp, descricao, salario</p>
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={8}
                    className={inputClass}
                    placeholder={"titulo;cidade;whatsapp;descricao;salario\nEletricista;Curitiba;41999999999;Vaga para eletricista;R$ 2.500"}
                  />
                </div>
                <Button variant="accent" onClick={handleCsvImport} disabled={csvImporting || !csvText.trim()}>
                  {csvImporting ? 'Importando...' : 'Importar Vagas em Lote'}
                </Button>
              </TabsContent>

              <TabsContent value="structured" className="mt-0" />
            </Tabs>
          )}

          {(mode === 'structured' || editingId) && (
            <div className="space-y-4 mt-4">
              <div>
                <label className={labelClass}>Título *</label>
                <input name="title" value={form.title} onChange={handleChange} required className={inputClass}
                  placeholder="Ex: Preciso de eletricista para instalação" />
              </div>
              <div>
                <label className={labelClass}>Subtítulo</label>
                <input name="subtitle" value={form.subtitle} onChange={handleChange} className={inputClass}
                  placeholder="Ex: Empresa de engenharia contrata" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Categoria</label>
                  <select name="category_id" value={form.category_id} onChange={handleChange} className={inputClass}>
                    <option value="">Selecione...</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Tipo de oportunidade</label>
                  <select name="opportunity_type" value={form.opportunity_type} onChange={handleChange} className={inputClass}>
                    {OPPORTUNITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Tipo de contrato</label>
                  <select name="job_type" value={form.job_type} onChange={handleChange} className={inputClass}>
                    {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Modelo de trabalho</label>
                  <select name="work_model" value={form.work_model} onChange={handleChange} className={inputClass}>
                    {WORK_MODELS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Descrição geral</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={3} className={inputClass}
                  placeholder="Descreva a oportunidade..." />
              </div>
              <div>
                <label className={labelClass}>🔧 Atividades</label>
                <textarea name="activities" value={form.activities} onChange={handleChange} rows={3} className={inputClass}
                  placeholder="Uma atividade por linha" />
              </div>
              <div>
                <label className={labelClass}>✅ Requisitos</label>
                <textarea name="requirements" value={form.requirements} onChange={handleChange} rows={3} className={inputClass}
                  placeholder="Um requisito por linha" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>🕘 Horário</label>
                  <input name="schedule" value={form.schedule} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>💰 Salário</label>
                  <input name="salary" value={form.salary} onChange={handleChange} className={inputClass}
                    placeholder="Ex: R$ 2.500 ou A combinar" />
                </div>
              </div>
              <div>
                <label className={labelClass}>🎁 Benefícios</label>
                <textarea name="benefits" value={form.benefits} onChange={handleChange} rows={2} className={inputClass}
                  placeholder="Um benefício por linha" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Cidade</label>
                  <input name="city" value={form.city} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Estado</label>
                  <input name="state" value={form.state} onChange={handleChange} maxLength={2} className={inputClass} placeholder="PR" />
                </div>
                <div>
                  <label className={labelClass}>Bairro</label>
                  <input name="neighborhood" value={form.neighborhood} onChange={handleChange} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Nome de contato</label>
                  <input name="contact_name" value={form.contact_name} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Telefone</label>
                  <input name="contact_phone" value={form.contact_phone} onChange={handleChange} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>WhatsApp *</label>
                  <input name="whatsapp" value={form.whatsapp} onChange={handleChange} className={inputClass}
                    placeholder="41999999999" />
                </div>
                <div>
                  <label className={labelClass}>Prazo (expiração)</label>
                  <input name="deadline" type="date" value={form.deadline} onChange={handleChange} className={inputClass} />
                </div>
              </div>
              <ImageUploadField
                value={form.cover_image_url}
                onChange={(url) => setForm(prev => ({ ...prev, cover_image_url: url }))}
                bucket="service-images"
                folder="jobs"
                label="Imagem de capa"
              />
              {editingId && (
                <div>
                  <label className={labelClass}>Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className={inputClass}>
                    <option value="active">Ativa</option>
                    <option value="inactive">Inativa</option>
                  </select>
                </div>
              )}
              <Button variant="accent" className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : editingId ? 'Atualizar Vaga' : profileType === 'rh' ? 'Publicar Vaga' : 'Enviar para Aprovação'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DashboardJobsPage;
