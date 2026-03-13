import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DashboardServicesPage = () => {
  const { user, provider, loading } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ service_name: '', description: '', price: '', service_area: '' });

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  const fetchServices = async () => {
    if (!provider) return;
    const { data } = await supabase.from('services').select('*').eq('provider_id', provider.id).order('created_at');
    if (data) setServices(data);
  };

  useEffect(() => { fetchServices(); }, [provider]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!provider) { toast.error('Complete seu perfil primeiro na aba Perfil'); return; }
    if (!form.service_name.trim()) { toast.error('Nome do serviço é obrigatório'); return; }

    if (editId) {
      const { error } = await supabase.from('services').update(form).eq('id', editId);
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }
      toast.success('Serviço atualizado!');
    } else {
      const { error } = await supabase.from('services').insert({ ...form, provider_id: provider.id });
      if (error) { toast.error('Erro ao adicionar: ' + error.message); return; }
      toast.success('Serviço adicionado!');
    }
    setForm({ service_name: '', description: '', price: '', service_area: '' });
    setShowForm(false);
    setEditId(null);
    fetchServices();
  };

  const handleEdit = (s: any) => {
    setForm({ service_name: s.service_name, description: s.description, price: s.price || '', service_area: s.service_area });
    setEditId(s.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('services').delete().eq('id', id);
    toast.success('Serviço removido');
    fetchServices();
  };

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Serviços</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie seus serviços oferecidos</p>
        </div>
        <Button variant="accent" size="sm" onClick={() => { setShowForm(true); setEditId(null); setForm({ service_name: '', description: '', price: '', service_area: '' }); }}>
          <Plus className="mr-1 h-4 w-4" /> Novo Serviço
        </Button>
      </div>

      {showForm && (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground">{editId ? 'Editar' : 'Novo'} Serviço</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Nome do serviço</label>
              <input name="service_name" value={form.service_name} onChange={handleChange} required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Preço</label>
              <input name="price" value={form.price} onChange={handleChange} placeholder="Ex: R$ 200"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Descrição</label>
            <textarea name="description" rows={2} value={form.description} onChange={handleChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Área de atendimento</label>
            <input name="service_area" value={form.service_area} onChange={handleChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </div>
          <div className="flex gap-2">
            <Button variant="accent" onClick={handleSave}>Salvar</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {services.length === 0 && !showForm && (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-foreground font-semibold">Nenhum serviço cadastrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Adicione seus serviços para que clientes possam encontrá-lo.</p>
          </div>
        )}
        {services.map(s => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card">
            <div>
              <p className="text-sm font-semibold text-foreground">{s.service_name}</p>
              <p className="text-xs text-muted-foreground">{s.description}</p>
              <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                {s.price && <span className="font-medium text-accent">{s.price}</span>}
                {s.service_area && <span>{s.service_area}</span>}
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => handleEdit(s)}><Edit2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default DashboardServicesPage;
