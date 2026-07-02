import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MousePointerClick, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const emptyForm = { title: '', subtitle: '', button_text: '', button_link: '/', icon: 'Sparkles', variant: 'primary', section: 'mid', display_order: 0, active: true };

const AdminCtaBlocksPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editing, setEditing] = useState<string | null>(null);

  const fetchItems = async () => {
    const { data } = await supabase.from('home_cta_blocks').select('*').order('display_order');
    if (data) setItems(data);
  };

  useEffect(() => { if (isAdmin) fetchItems(); }, [isAdmin]);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Título obrigatório'); return; }
    const payload = { ...form, updated_at: new Date().toISOString() };
    if (editing) {
      const { error } = await (supabase.from('home_cta_blocks') as any).update(payload).eq('id', editing);
      if (error) { toast.error(error.message); return; }
      toast.success('Bloco CTA atualizado!');
    } else {
      const { error } = await (supabase.from('home_cta_blocks') as any).insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Bloco CTA criado!');
    }
    setForm({ ...emptyForm });
    setEditing(null);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    await (supabase.from('home_cta_blocks') as any).delete().eq('id', id);
    toast.success('Bloco CTA removido!');
    fetchItems();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await (supabase.from('home_cta_blocks') as any).update({ active: !current, updated_at: new Date().toISOString() }).eq('id', id);
    fetchItems();
  };

  const startEdit = (item: any) => {
    setEditing(item.id);
    setForm({
      title: item.title, subtitle: item.subtitle, button_text: item.button_text,
      button_link: item.button_link, icon: item.icon, variant: item.variant,
      section: item.section, display_order: item.display_order, active: item.active,
    });
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <MousePointerClick className="h-6 w-6" /> Blocos CTA da Home
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Gerencie os blocos de chamada para ação (CTA) da página inicial</p>

      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card space-y-3">
        <h3 className="text-sm font-bold text-foreground">{editing ? 'Editar Bloco CTA' : 'Novo Bloco CTA'}</h3>
        <Input placeholder="Título" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} />
        <Input placeholder="Subtítulo" value={form.subtitle} onChange={(e) => setForm(p => ({ ...p, subtitle: e.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Texto do botão" value={form.button_text} onChange={(e) => setForm(p => ({ ...p, button_text: e.target.value }))} />
          <Input placeholder="Link do botão (ex: /cadastro)" value={form.button_link} onChange={(e) => setForm(p => ({ ...p, button_link: e.target.value }))} />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Input placeholder="Ícone (Lucide)" value={form.icon} onChange={(e) => setForm(p => ({ ...p, icon: e.target.value }))} />
          <Select value={form.variant} onValueChange={(v) => setForm(p => ({ ...p, variant: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="primary">Primário</SelectItem>
              <SelectItem value="secondary">Secundário</SelectItem>
              <SelectItem value="accent">Destaque</SelectItem>
            </SelectContent>
          </Select>
          <Select value={form.section} onValueChange={(v) => setForm(p => ({ ...p, section: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mid">Meio</SelectItem>
              <SelectItem value="final">Final</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input type="number" placeholder="Ordem" value={form.display_order} onChange={(e) => setForm(p => ({ ...p, display_order: Number(e.target.value) }))} className="w-20" />
            <Switch checked={form.active} onCheckedChange={(v) => setForm(p => ({ ...p, active: v }))} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="accent" onClick={handleSave}><Save className="mr-1 h-4 w-4" /> {editing ? 'Atualizar' : 'Criar'}</Button>
          {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm({ ...emptyForm }); }}>Cancelar</Button>}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {items.map((item: any) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${item.active ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{item.section}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{item.variant}</span>
                <span className="text-xs text-muted-foreground">#{item.display_order}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground truncate">{item.subtitle} → {item.button_text} ({item.button_link})</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Switch checked={item.active} onCheckedChange={() => toggleActive(item.id, item.active)} />
              <Button variant="outline" size="sm" onClick={() => startEdit(item)}>Editar</Button>
              <Button variant="outline" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum bloco CTA cadastrado.</p>}
      </div>
    </AdminLayout>
  );
};

export default AdminCtaBlocksPage;
