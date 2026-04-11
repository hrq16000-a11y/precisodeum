import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, Trash2, Save, Pencil, MousePointerClick, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ImageUploadField from '@/components/ImageUploadField';

const AdminHighlightsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [highlights, setHighlights] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: '', description: '', image_url: '', link_url: '',
    display_order: 0, icon: 'Sparkles', theme_color: 'text-orange-500', button_text: 'Saiba mais',
    start_date: '', end_date: '',
  });
  const [editing, setEditing] = useState<string | null>(null);

  const fetchData = async () => {
    const { data } = await supabase.from('highlights' as any).select('*').order('display_order');
    if (data) setHighlights(data);
  };

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin]);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Título obrigatório'); return; }
    const payload: any = {
      title: form.title, description: form.description,
      image_url: form.image_url || null, link_url: form.link_url || null,
      display_order: form.display_order,
      icon: form.icon || 'Sparkles',
      theme_color: form.theme_color || 'text-orange-500',
      button_text: form.button_text || 'Saiba mais',
      start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
    };
    if (editing) {
      const { error } = await (supabase.from('highlights' as any) as any).update({
        ...payload, updated_at: new Date().toISOString(),
      }).eq('id', editing);
      if (error) { toast.error(error.message); return; }
      toast.success('Destaque atualizado!');
    } else {
      const { error } = await (supabase.from('highlights' as any) as any).insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Destaque criado!');
    }
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setForm({ title: '', description: '', image_url: '', link_url: '', display_order: 0, icon: 'Sparkles', theme_color: 'text-orange-500', button_text: 'Saiba mais', start_date: '', end_date: '' });
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    await (supabase.from('highlights' as any) as any).delete().eq('id', id);
    toast.success('Destaque removido!');
    fetchData();
  };

  const startEdit = (h: any) => {
    setEditing(h.id);
    setForm({
      title: h.title, description: h.description,
      image_url: h.image_url || '', link_url: h.link_url || '',
      display_order: h.display_order,
      icon: h.icon || 'Sparkles',
      theme_color: h.theme_color || 'text-orange-500',
      button_text: h.button_text || 'Saiba mais',
      start_date: h.start_date ? h.start_date.slice(0, 16) : '',
      end_date: h.end_date ? h.end_date.slice(0, 16) : '',
    });
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Ícone (Lucide)</label>
            <input placeholder="Ex: Sparkles, Smartphone" value={form.icon} onChange={(e) => setForm(p => ({ ...p, icon: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cor tema (Tailwind)</label>
            <input placeholder="Ex: text-orange-500" value={form.theme_color} onChange={(e) => setForm(p => ({ ...p, theme_color: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </div>
        </div>
        <input placeholder="Texto do botão (ex: Saiba mais →)" value={form.button_text} onChange={(e) => setForm(p => ({ ...p, button_text: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Início</label>
            <input type="datetime-local" value={form.start_date} onChange={(e) => setForm(p => ({ ...p, start_date: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Fim</label>
            <input type="datetime-local" value={form.end_date} onChange={(e) => setForm(p => ({ ...p, end_date: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </div>
        </div>
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
          {editing && <Button variant="outline" onClick={resetForm}>Cancelar</Button>}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {highlights.map((h: any) => (
          <div key={h.id} className="rounded-xl border border-border bg-card p-3 shadow-card">
            <div className="flex items-start gap-3">
              {h.image_url && <img src={h.image_url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${h.active ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                  <h3 className="text-sm font-bold text-foreground truncate">{h.title}</h3>
                  <span className="text-xs text-muted-foreground shrink-0">#{h.display_order}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{h.description}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  <span>Ícone: {h.icon}</span>
                  <span>|</span>
                  <span>Cor: {h.theme_color}</span>
                  <span>|</span>
                  <span>Botão: {h.button_text}</span>
                  <span>|</span>
                  <span className="inline-flex items-center gap-0.5"><MousePointerClick className="h-3 w-3" /> {h.click_count ?? 0} cliques</span>
                </div>
                {(h.start_date || h.end_date) && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    {h.start_date ? new Date(h.start_date).toLocaleDateString('pt-BR') : '—'}
                    {' → '}
                    {h.end_date ? new Date(h.end_date).toLocaleDateString('pt-BR') : '—'}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => startEdit(h)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDelete(h.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminHighlightsPage;
