import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Footprints, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

const emptyForm = { step: 1, title: '', description: '', icon: '🔍', display_order: 0, active: true };

const AdminHomeStepsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editing, setEditing] = useState<string | null>(null);

  const fetchItems = async () => {
    const { data } = await supabase.from('home_steps').select('*').order('display_order');
    if (data) setItems(data);
  };

  useEffect(() => { if (isAdmin) fetchItems(); }, [isAdmin]);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Título obrigatório'); return; }
    const payload = {
      step: form.step, title: form.title, description: form.description,
      icon: form.icon, display_order: form.display_order, active: form.active,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { error } = await (supabase.from('home_steps') as any).update(payload).eq('id', editing);
      if (error) { toast.error(error.message); return; }
      toast.success('Passo atualizado!');
    } else {
      const { error } = await (supabase.from('home_steps') as any).insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Passo criado!');
    }
    setForm({ ...emptyForm });
    setEditing(null);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    await (supabase.from('home_steps') as any).delete().eq('id', id);
    toast.success('Passo removido!');
    fetchItems();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await (supabase.from('home_steps') as any).update({ active: !current, updated_at: new Date().toISOString() }).eq('id', id);
    fetchItems();
  };

  const startEdit = (item: any) => {
    setEditing(item.id);
    setForm({ step: item.step, title: item.title, description: item.description, icon: item.icon, display_order: item.display_order, active: item.active });
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <Footprints className="h-6 w-6" /> Como Funciona — Passos
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Gerencie os passos exibidos na seção "Como Funciona" da home</p>

      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card space-y-3">
        <h3 className="text-sm font-bold text-foreground">{editing ? 'Editar Passo' : 'Novo Passo'}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Título" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} />
          <Input placeholder="Ícone (emoji)" value={form.icon} onChange={(e) => setForm(p => ({ ...p, icon: e.target.value }))} />
        </div>
        <textarea placeholder="Descrição" rows={2} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        <div className="flex gap-3 items-center">
          <Input type="number" placeholder="Nº Passo" value={form.step} onChange={(e) => setForm(p => ({ ...p, step: Number(e.target.value) }))} className="w-24" />
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
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${item.active ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                  <h3 className="text-sm font-bold text-foreground">Passo {item.step}: {item.title}</h3>
                  <span className="text-xs text-muted-foreground">#{item.display_order}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground truncate">{item.description}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Switch checked={item.active} onCheckedChange={() => toggleActive(item.id, item.active)} />
              <Button variant="outline" size="sm" onClick={() => startEdit(item)}>Editar</Button>
              <Button variant="outline" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum passo cadastrado.</p>}
      </div>
    </AdminLayout>
  );
};

export default AdminHomeStepsPage;
