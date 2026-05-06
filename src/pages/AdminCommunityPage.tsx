import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAdmin } from '@/hooks/useAdmin';

const emptyForm = { title: '', description: '', url: '', icon: '🔗', display_order: 0, active: true };

const AdminCommunityPage = () => {
  const { isAdmin, loading } = useAdmin();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['admin-community-links'],
    queryFn: async () => {
      const { data } = await supabase.from('community_links' as any).select('*').order('display_order');
      return data || [];
    },
    enabled: isAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { title: form.title, description: form.description, url: form.url, icon: form.icon, display_order: form.display_order, active: form.active };
      if (editingId) {
        await supabase.from('community_links' as any).update(payload).eq('id', editingId);
      } else {
        await supabase.from('community_links' as any).insert(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-links'] });
      toast.success(editingId ? 'Link atualizado' : 'Link criado');
      closeDialog();
    },
    onError: () => toast.error('Erro ao salvar'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('community_links' as any).delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-links'] });
      toast.success('Link removido');
    },
  });

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(emptyForm); };

  const openEdit = (link: any) => {
    setEditingId(link.id);
    setForm({ title: link.title, description: link.description || '', url: link.url, icon: link.icon || '🔗', display_order: link.display_order, active: link.active });
    setDialogOpen(true);
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Comunidade dos Prestadores</h1>
          <p className="text-sm text-muted-foreground">Gerencie links e recursos para os profissionais</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button variant="accent" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
              <Plus className="h-4 w-4" /> Novo Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? 'Editar Link' : 'Novo Link'}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>URL *</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Ícone (emoji)</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} /></div>
                <div><Label>Ordem</Label><Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button type="submit" variant="accent" disabled={saveMutation.isPending}>Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 space-y-2">
        {isLoading ? <p className="text-muted-foreground">Carregando...</p> : links.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhum link cadastrado.</p>
        ) : (links as any[]).map((link) => (
          <div key={link.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl">{link.icon}</span>
              <div>
                <h3 className="text-sm font-medium text-foreground">{link.title}</h3>
                <p className="text-xs text-muted-foreground truncate max-w-xs">{link.url}</p>
              </div>
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${link.active ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
                {link.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => window.open(link.url, '_blank')}><ExternalLink className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => openEdit(link)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(link.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminCommunityPage;
