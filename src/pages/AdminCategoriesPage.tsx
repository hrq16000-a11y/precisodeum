import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit2, ChevronRight, icons } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import IconPicker from '@/components/admin/IconPicker';

/** Render a Lucide icon by name, falling back to emoji */
const DynIcon = ({ name, size = 20 }: { name: string; size?: number }) => {
  const Icon = (icons as Record<string, any>)[name];
  if (Icon) return <Icon size={size} strokeWidth={1.75} className="text-slate-600" />;
  return <span style={{ fontSize: size }}>{name}</span>;
};

const AdminCategoriesPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [categories, setCategories] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', icon: 'Wrench', parent_id: '' });

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').is('deleted_at', null).order('name');
    setCategories(data || []);
  };

  useEffect(() => { if (isAdmin) fetchCategories(); }, [isAdmin]);

  const parentCategories = categories.filter(c => !(c as any).parent_id);
  const getChildren = (parentId: string) => categories.filter(c => (c as any).parent_id === parentId);

  const handleSave = async () => {
    if (!form.name || !form.slug) { toast.error('Nome e slug são obrigatórios'); return; }
    const payload: any = { name: form.name, slug: form.slug, icon: form.icon };
    if (form.parent_id) payload.parent_id = form.parent_id;
    else payload.parent_id = null;

    if (editId) {
      const { error } = await supabase.from('categories').update(payload).eq('id', editId);
      if (error) { toast.error(error.message); return; }
      toast.success('Categoria atualizada!');
    } else {
      const { error } = await supabase.from('categories').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Categoria criada!');
    }
    setForm({ name: '', slug: '', icon: 'Wrench', parent_id: '' });
    setShowForm(false);
    setEditId(null);
    fetchCategories();
  };

  const handleEdit = (c: any) => {
    setForm({ name: c.name, slug: c.slug, icon: c.icon, parent_id: c.parent_id || '' });
    setEditId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Categoria removida');
    fetchCategories();
  };

  const autoSlug = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Categorias</h1>
          <p className="mt-1 text-sm text-muted-foreground">{parentCategories.length} macro · {categories.length - parentCategories.length} sub</p>
        </div>
        <Button variant="accent" size="sm" onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', slug: '', icon: 'Wrench', parent_id: '' }); }}>
          <Plus className="mr-1 h-4 w-4" /> Nova Categoria
        </Button>
      </div>

      {showForm && (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground">{editId ? 'Editar' : 'Nova'} Categoria</h2>

          {/* Preview card */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-sky-50 p-4 w-fit">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
              <DynIcon name={form.icon} size={24} />
            </span>
            <span className="text-sm font-bold text-foreground">{form.name || 'Nome da categoria'}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Categoria Pai (opcional)</label>
              <select
                value={form.parent_id}
                onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">— Nenhuma (macro) —</option>
                {parentCategories.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Nome</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: autoSlug(e.target.value) }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Slug</label>
              <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <IconPicker value={form.icon} onChange={(name) => setForm(f => ({ ...f, icon: name }))} />
          </div>
          <div className="flex gap-2">
            <Button variant="accent" onClick={handleSave}>Salvar</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {parentCategories.map(p => {
          const children = getChildren(p.id);
          return (
            <div key={p.id}>
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50">
                    <DynIcon name={p.icon} size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">/{p.slug} · {children.length} sub</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(p)}><Edit2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              {children.length > 0 && (
                <div className="ml-8 mt-1 space-y-1">
                  {children.map(c => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-3">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50">
                          <DynIcon name={c.icon} size={14} />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">/{c.slug}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(c)}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {categories.filter(c => (c as any).parent_id && !parentCategories.find(p => p.id === (c as any).parent_id)).map(c => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50">
                <DynIcon name={c.icon} size={20} />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">/{c.slug}</p>
              </div>
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

export default AdminCategoriesPage;
