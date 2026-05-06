import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AdminCitiesPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [cities, setCities] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', state: '' });

  const fetchCities = async () => {
    const { data } = await supabase.from('cities').select('*').order('name');
    setCities(data || []);
  };

  useEffect(() => { if (isAdmin) fetchCities(); }, [isAdmin]);

  const handleSave = async () => {
    if (!form.name || !form.slug) { toast.error('Nome e slug são obrigatórios'); return; }
    if (editId) {
      const { error } = await supabase.from('cities').update(form).eq('id', editId);
      if (error) { toast.error(error.message); return; }
      toast.success('Cidade atualizada!');
    } else {
      const { error } = await supabase.from('cities').insert(form);
      if (error) { toast.error(error.message); return; }
      toast.success('Cidade criada!');
    }
    setForm({ name: '', slug: '', state: '' });
    setShowForm(false);
    setEditId(null);
    fetchCities();
  };

  const handleEdit = (c: any) => {
    setForm({ name: c.name, slug: c.slug, state: c.state });
    setEditId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('cities').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Cidade removida');
    fetchCities();
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Cidades</h1>
          <p className="mt-1 text-sm text-muted-foreground">{cities.length} cidade(s)</p>
        </div>
        <Button variant="accent" size="sm" onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', slug: '', state: '' }); }}>
          <Plus className="mr-1 h-4 w-4" /> Nova Cidade
        </Button>
      </div>

      {showForm && (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground">{editId ? 'Editar' : 'Nova'} Cidade</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Nome</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Slug</label>
              <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="ex: curitiba"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Estado (UF)</label>
              <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                placeholder="ex: PR"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="accent" onClick={handleSave}>Salvar</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {cities.map(c => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card">
            <div>
              <p className="text-sm font-semibold text-foreground">{c.name}</p>
              <p className="text-xs text-muted-foreground">/{c.slug} · {c.state}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => handleEdit(c)}><Edit2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminCitiesPage;
