import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Eye, ExternalLink } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const OPPORTUNITY_TYPES = [
  { value: 'servico', label: 'Serviço' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'emprego', label: 'Emprego' },
];

const emptyForm = {
  title: '', category_id: '', opportunity_type: 'servico', description: '',
  city: '', state: '', neighborhood: '', contact_name: '', contact_phone: '',
  whatsapp: '', deadline: '', cover_image_url: '', status: 'active',
};

const DashboardJobsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [authLoading, user, navigate]);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['my-jobs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('jobs' as any)
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
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const generateSlug = (title: string, city: string) => {
    const base = `${title}-${city}`.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${base}-${Date.now().toString(36)}`;
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.title.trim()) { toast.error('Título é obrigatório'); return; }
    if (!form.description.trim()) { toast.error('Descrição é obrigatória'); return; }

    setSaving(true);
    const slug = generateSlug(form.title, form.city);
    const payload = {
      ...form,
      user_id: user.id,
      category_id: form.category_id || null,
      slug: editingId ? undefined : slug,
    };
    if (editingId) delete (payload as any).slug;

    if (editingId) {
      const { user_id, ...updatePayload } = payload;
      const { error } = await supabase.from('jobs' as any).update(updatePayload).eq('id', editingId);
      if (error) toast.error('Erro ao atualizar vaga');
      else toast.success('Vaga atualizada!');
    } else {
      const { error } = await supabase.from('jobs' as any).insert(payload);
      if (error) toast.error('Erro ao criar vaga');
      else toast.success('Vaga publicada!');
    }

    setSaving(false);
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
  };

  const handleEdit = (job: any) => {
    setForm({
      title: job.title || '',
      category_id: job.category_id || '',
      opportunity_type: job.opportunity_type || 'servico',
      description: job.description || '',
      city: job.city || '',
      state: job.state || '',
      neighborhood: job.neighborhood || '',
      contact_name: job.contact_name || '',
      contact_phone: job.contact_phone || '',
      whatsapp: job.whatsapp || '',
      deadline: job.deadline || '',
      cover_image_url: job.cover_image_url || '',
      status: job.status || 'active',
    });
    setEditingId(job.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta vaga?')) return;
    await supabase.from('jobs' as any).delete().eq('id', id);
    toast.success('Vaga excluída');
    queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
  };

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Minhas Vagas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Publique oportunidades de serviço ou trabalho</p>
        </div>
        <Button variant="accent" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Nova Vaga</Button>
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
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground truncate">{job.title}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${job.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {job.status === 'active' ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {(job.categories as any)?.icon} {(job.categories as any)?.name || 'Sem categoria'} · {job.city}{job.state ? `, ${job.state}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => window.open(`/vaga/${job.slug || job.id}`, '_blank')}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(job)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(job.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Vaga' : 'Nova Vaga'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Título *</label>
              <input name="title" value={form.title} onChange={handleChange} required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="Ex: Preciso de eletricista para instalação" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Categoria</label>
                <select name="category_id" value={form.category_id} onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                  <option value="">Selecione...</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Tipo</label>
                <select name="opportunity_type" value={form.opportunity_type} onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                  {OPPORTUNITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Descrição *</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="Descreva a oportunidade com detalhes..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Cidade</label>
                <input name="city" value={form.city} onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Estado</label>
                <input name="state" value={form.state} onChange={handleChange} maxLength={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="SP" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Bairro</label>
                <input name="neighborhood" value={form.neighborhood} onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Nome de contato</label>
                <input name="contact_name" value={form.contact_name} onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Telefone</label>
                <input name="contact_phone" value={form.contact_phone} onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">WhatsApp</label>
                <input name="whatsapp" value={form.whatsapp} onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="11999999999" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Prazo</label>
                <input name="deadline" value={form.deadline} onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="Ex: 30/04/2026" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">URL da imagem de capa</label>
              <input name="cover_image_url" value={form.cover_image_url} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="https://..." />
            </div>
            {editingId && (
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Status</label>
                <select name="status" value={form.status} onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                  <option value="active">Ativa</option>
                  <option value="inactive">Inativa</option>
                </select>
              </div>
            )}
            <Button variant="accent" className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Atualizar Vaga' : 'Publicar Vaga'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DashboardJobsPage;
