import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ImageUploadField from '@/components/ImageUploadField';

const AdminHighlightsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [highlights, setHighlights] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', description: '', image_url: '', link_url: '', display_order: 0 });
  const [editing, setEditing] = useState<string | null>(null);

  const fetch = async () => {
    const { data } = await supabase.from('highlights' as any).select('*').order('display_order');
    if (data) setHighlights(data);
  };

  useEffect(() => { if (isAdmin) fetch(); }, [isAdmin]);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Título obrigatório'); return; }
    if (editing) {
      const { error } = await (supabase.from('highlights' as any) as any).update({
        title: form.title, description: form.description,
        image_url: form.image_url || null, link_url: form.link_url || null,
        display_order: form.display_order, updated_at: new Date().toISOString(),
      }).eq('id', editing);
      if (error) { toast.error(error.message); return; }
      toast.success('Destaque atualizado!');
    } else {
      const { error } = await (supabase.from('highlights' as any) as any).insert({
        title: form.title, description: form.description,
        image_url: form.image_url || null, link_url: form.link_url || null,
        display_order: form.display_order,
      });
      if (error) { toast.error(error.message); return; }
      toast.success('Destaque criado!');
    }
    setForm({ title: '', description: '', image_url: '', link_url: '', display_order: 0 });
    setEditing(null);
    fetch();
  };

  const handleDelete = async (id: string) => {
    await (supabase.from('highlights' as any) as any).delete().eq('id', id);
    toast.success('Destaque removido!');
    fetch();
  };

  const startEdit = (h: any) => {
    setEditing(h.id);
    setForm({ title: h.title, description: h.description, image_url: h.image_url || '', link_url: h.link_url || '', display_order: h.display_order });
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <Sparkles className="h-6 w-6" /> Destaques Rotativos
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Gerencie os banners de destaque da página inicial</p>

      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card space-y-3">
        <h3 className="text-sm font-bold text-foreground">{editing ? 'Editar Destaque' : 'Novo Destaque'}</h3>
        <input placeholder="Título" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        <textarea placeholder="Descrição" rows={2} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        <ImageUploadField
          value={form.image_url}
          onChange={(url) => setForm(p => ({ ...p, image_url: url }))}
          bucket="service-images"
          folder="highlights"
          label="Imagem do destaque"
          placeholder="https://..."
        />
        <input placeholder="Link de destino (ex: /cadastro)" value={form.link_url} onChange={(e) => setForm(p => ({ ...p, link_url: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        <input type="number" placeholder="Ordem" value={form.display_order} onChange={(e) => setForm(p => ({ ...p, display_order: Number(e.target.value) }))}
          className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        <div className="flex gap-2">
          <Button variant="accent" onClick={handleSave}><Save className="mr-1 h-4 w-4" /> {editing ? 'Atualizar' : 'Criar'}</Button>
          {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm({ title: '', description: '', image_url: '', link_url: '', display_order: 0 }); }}>Cancelar</Button>}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {highlights.map((h: any) => (
          <div key={h.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="min-w-0 flex-1 flex items-center gap-3">
              {h.image_url && <img src={h.image_url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />}
              <div>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${h.active ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                  <h3 className="text-sm font-bold text-foreground truncate">{h.title}</h3>
                  <span className="text-xs text-muted-foreground">#{h.display_order}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground truncate">{h.description}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => startEdit(h)}>Editar</Button>
              <Button variant="outline" size="sm" onClick={() => handleDelete(h.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminHighlightsPage;
