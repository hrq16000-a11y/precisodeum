import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GripVertical, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

interface PopularService {
  id: string;
  name: string;
  slug: string;
  category_name: string;
  category_slug: string | null;
  min_price: number;
  icon: string;
  description: string;
  display_order: number;
  active: boolean;
}

const emptyService: Omit<PopularService, 'id'> = {
  name: '', slug: '', category_name: '', category_slug: '', min_price: 0, icon: '🔧', description: '', display_order: 0, active: true,
};

const AdminPopularServicesPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [services, setServices] = useState<PopularService[]>([]);
  const [editing, setEditing] = useState<Partial<PopularService> | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetch = async () => {
    const { data } = await supabase.from('popular_services' as any).select('*').order('display_order');
    if (data) setServices(data as any);
  };

  useEffect(() => { if (isAdmin) fetch(); }, [isAdmin]);

  const generateSlug = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleSave = async () => {
    if (!editing?.name) { toast.error('Nome é obrigatório'); return; }
    const slug = editing.slug || generateSlug(editing.name);
    const payload = { ...editing, slug };

    if (isNew) {
      const { error } = await (supabase.from('popular_services' as any) as any).insert([payload]);
      if (error) { toast.error(error.message); return; }
      toast.success('Serviço criado!');
    } else {
      const { error } = await (supabase.from('popular_services' as any) as any).update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Serviço atualizado!');
    }
    setEditing(null); setIsNew(false); fetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este serviço?')) return;
    await (supabase.from('popular_services' as any) as any).delete().eq('id', id);
    toast.success('Excluído'); fetch();
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Serviços Populares</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie os serviços exibidos na homepage</p>
        </div>
        <Button variant="accent" onClick={() => { setEditing({ ...emptyService, display_order: services.length + 1 }); setIsNew(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>

      {editing && (
        <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-card space-y-3">
          <h3 className="font-display font-bold text-foreground">{isNew ? 'Novo Serviço' : 'Editar Serviço'}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Nome do serviço" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value, slug: generateSlug(e.target.value) })} />
            <Input placeholder="Slug" value={editing.slug || ''} onChange={e => setEditing({ ...editing, slug: e.target.value })} />
            <Input placeholder="Categoria" value={editing.category_name || ''} onChange={e => setEditing({ ...editing, category_name: e.target.value })} />
            <Input placeholder="Slug da categoria" value={editing.category_slug || ''} onChange={e => setEditing({ ...editing, category_slug: e.target.value })} />
            <Input type="number" placeholder="Preço mínimo (R$)" value={editing.min_price || 0} onChange={e => setEditing({ ...editing, min_price: Number(e.target.value) })} />
            <Input placeholder="Ícone (emoji)" value={editing.icon || ''} onChange={e => setEditing({ ...editing, icon: e.target.value })} />
            <Input type="number" placeholder="Ordem" value={editing.display_order || 0} onChange={e => setEditing({ ...editing, display_order: Number(e.target.value) })} />
          </div>
          <Textarea placeholder="Descrição do serviço" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
          <div className="flex gap-2">
            <Button variant="accent" onClick={handleSave}><Save className="mr-1 h-4 w-4" /> Salvar</Button>
            <Button variant="outline" onClick={() => { setEditing(null); setIsNew(false); }}><X className="mr-1 h-4 w-4" /> Cancelar</Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {services.map(s => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{s.icon}</span>
              <div>
                <h3 className="text-sm font-bold text-foreground">{s.name}</h3>
                <p className="text-xs text-muted-foreground">{s.category_name} · A partir de R$ {s.min_price.toFixed(2).replace('.', ',')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${s.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {s.active ? 'Ativo' : 'Inativo'}
              </span>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(s); setIsNew(false); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {services.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum serviço popular cadastrado.</p>}
      </div>
    </AdminLayout>
  );
};

export default AdminPopularServicesPage;
