import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MessageSquareQuote, Trash2, Save, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

const emptyForm = { name: '', city: '', text: '', rating: 5, display_order: 0, active: true };

const AdminTestimonialsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editing, setEditing] = useState<string | null>(null);

  const fetchItems = async () => {
    const { data } = await supabase.from('home_testimonials').select('*').order('display_order');
    if (data) setItems(data);
  };

  useEffect(() => { if (isAdmin) fetchItems(); }, [isAdmin]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.text.trim()) { toast.error('Nome e texto são obrigatórios'); return; }
    const payload = {
      name: form.name, city: form.city, text: form.text,
      rating: form.rating, display_order: form.display_order, active: form.active,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { error } = await (supabase.from('home_testimonials') as any).update(payload).eq('id', editing);
      if (error) { toast.error(error.message); return; }
      toast.success('Depoimento atualizado!');
    } else {
      const { error } = await (supabase.from('home_testimonials') as any).insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Depoimento criado!');
    }
    setForm({ ...emptyForm });
    setEditing(null);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    await (supabase.from('home_testimonials') as any).delete().eq('id', id);
    toast.success('Depoimento removido!');
    fetchItems();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await (supabase.from('home_testimonials') as any).update({ active: !current, updated_at: new Date().toISOString() }).eq('id', id);
    fetchItems();
  };

  const startEdit = (item: any) => {
    setEditing(item.id);
    setForm({ name: item.name, city: item.city, text: item.text, rating: item.rating, display_order: item.display_order, active: item.active });
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <MessageSquareQuote className="h-6 w-6" /> Depoimentos da Home
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Gerencie os depoimentos exibidos na página inicial</p>

      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card space-y-3">
        <h3 className="text-sm font-bold text-foreground">{editing ? 'Editar Depoimento' : 'Novo Depoimento'}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Nome" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
          <Input placeholder="Cidade" value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} />
        </div>
        <textarea placeholder="Texto do depoimento" rows={3} value={form.text} onChange={(e) => setForm(p => ({ ...p, text: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-1 text-sm text-foreground">
            <Star className="h-4 w-4 text-yellow-500" />
            <Input type="number" min={1} max={5} value={form.rating} onChange={(e) => setForm(p => ({ ...p, rating: Number(e.target.value) }))} className="w-16" />
          </label>
          <Input type="number" placeholder="Ordem" value={form.display_order} onChange={(e) => setForm(p => ({ ...p, display_order: Number(e.target.value) }))} className="w-24" />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Switch checked={form.active} onCheckedChange={(v) => setForm(p => ({ ...p, active: v }))} /> Ativo
          </label>
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
                <h3 className="text-sm font-bold text-foreground">{item.name}</h3>
                <span className="text-xs text-muted-foreground">{item.city}</span>
                <span className="text-xs text-yellow-500">{'★'.repeat(item.rating)}</span>
                <span className="text-xs text-muted-foreground">#{item.display_order}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground truncate">"{item.text}"</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Switch checked={item.active} onCheckedChange={() => toggleActive(item.id, item.active)} />
              <Button variant="outline" size="sm" onClick={() => startEdit(item)}>Editar</Button>
              <Button variant="outline" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum depoimento cadastrado.</p>}
      </div>
    </AdminLayout>
  );
};

export default AdminTestimonialsPage;
