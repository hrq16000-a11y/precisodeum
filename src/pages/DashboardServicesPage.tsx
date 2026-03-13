import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ServiceImageUpload from '@/components/ServiceImageUpload';

const DashboardServicesPage = () => {
  const { user, provider, loading, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    service_name: '',
    description: '',
    whatsapp: '',
    category_id: '',
    service_area: '',
  });

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => {
      if (data) setCategories(data);
    });
  }, []);

  const fetchServices = async () => {
    if (!provider) return;
    const { data } = await supabase
      .from('services')
      .select('*, categories(name, icon)')
      .eq('provider_id', provider.id)
      .order('created_at');
    if (data) setServices(data);
  };

  useEffect(() => {
    if (provider) fetchServices();
  }, [provider]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Auto-create a minimal provider record if user doesn't have one
  const ensureProvider = async (): Promise<string | null> => {
    if (provider) return provider.id;
    if (!user) return null;

    const slug = `profissional-${Date.now()}`;
    const { data, error } = await supabase
      .from('providers')
      .insert({
        user_id: user.id,
        slug,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      toast.error('Erro ao criar perfil: ' + error.message);
      return null;
    }

    await refetchProfile();
    return data.id;
  };

  const handleSave = async () => {
    if (!form.service_name.trim()) {
      toast.error('Nome do serviço é obrigatório');
      return;
    }

    const providerId = await ensureProvider();
    if (!providerId) return;

    const payload = {
      service_name: form.service_name,
      description: form.description,
      whatsapp: form.whatsapp,
      category_id: form.category_id || null,
      service_area: form.service_area,
    };

    if (editId) {
      const { error } = await supabase.from('services').update(payload).eq('id', editId);
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }
      toast.success('Serviço atualizado!');
    } else {
      const { error } = await supabase.from('services').insert({ ...payload, provider_id: providerId });
      if (error) { toast.error('Erro ao adicionar: ' + error.message); return; }
      toast.success('Serviço adicionado!');
    }

    setForm({ service_name: '', description: '', whatsapp: '', category_id: '', service_area: '' });
    setShowForm(false);
    setEditId(null);
    fetchServices();
  };

  const handleEdit = (s: any) => {
    setForm({
      service_name: s.service_name,
      description: s.description || '',
      whatsapp: s.whatsapp || '',
      category_id: s.category_id || '',
      service_area: s.service_area || '',
    });
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
        <Button variant="accent" size="sm" onClick={() => {
          setShowForm(true);
          setEditId(null);
          setForm({ service_name: '', description: '', whatsapp: '', category_id: '', service_area: '' });
        }}>
          <Plus className="mr-1 h-4 w-4" /> Novo Serviço
        </Button>
      </div>

      {showForm && (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground">
            {editId ? 'Editar' : 'Novo'} Serviço
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Nome do serviço *</label>
              <input
                name="service_name"
                value={form.service_name}
                onChange={handleChange}
                placeholder="Ex: Instalação elétrica residencial"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Categoria</label>
              <select
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">Selecione...</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">WhatsApp</label>
              <input
                name="whatsapp"
                value={form.whatsapp}
                onChange={handleChange}
                placeholder="Ex: 11999999999"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Área de atendimento</label>
              <input
                name="service_area"
                value={form.service_area}
                onChange={handleChange}
                placeholder="Ex: São Paulo - Zona Sul"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Descrição</label>
            <textarea
              name="description"
              rows={3}
              value={form.description}
              onChange={handleChange}
              placeholder="Descreva o serviço oferecido..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
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
          <div key={s.id} className="rounded-xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {s.categories?.icon && <span>{s.categories.icon}</span>}
                  <p className="text-sm font-semibold text-foreground">{s.service_name}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                  {s.categories?.name && <span className="font-medium text-accent">{s.categories.name}</span>}
                  {s.whatsapp && <span>📱 {s.whatsapp}</span>}
                  {s.service_area && <span>📍 {s.service_area}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                >
                  {expandedId === s.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(s)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            {expandedId === s.id && user && (
              <div className="border-t border-border p-4">
                <ServiceImageUpload serviceId={s.id} userId={user.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default DashboardServicesPage;
