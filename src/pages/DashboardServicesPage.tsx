import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, X, Search } from 'lucide-react';
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
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [form, setForm] = useState({
    service_name: '',
    description: '',
    whatsapp: '',
    service_area: '',
    address: '',
    working_hours: '',
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
      .select('*')
      .eq('provider_id', provider.id)
      .order('created_at');

    if (data) {
      // Fetch categories for each service
      const serviceIds = data.map(s => s.id);
      const { data: scData } = await supabase
        .from('service_categories')
        .select('service_id, category_id, categories(name, icon)')
        .in('service_id', serviceIds);

      const catMap: Record<string, any[]> = {};
      (scData || []).forEach((sc: any) => {
        if (!catMap[sc.service_id]) catMap[sc.service_id] = [];
        catMap[sc.service_id].push(sc.categories);
      });

      setServices(data.map(s => ({ ...s, serviceCategories: catMap[s.id] || [] })));
    }
  };

  useEffect(() => {
    if (provider) fetchServices();
  }, [provider]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const ensureProvider = async (): Promise<string | null> => {
    if (provider) return provider.id;
    if (!user) return null;

    const slug = `profissional-${Date.now()}`;
    const { data, error } = await supabase
      .from('providers')
      .insert({ user_id: user.id, slug, status: 'pending' })
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
      service_area: form.service_area,
      address: form.address,
      working_hours: form.working_hours,
    };

    let serviceId = editId;

    if (editId) {
      const { error } = await supabase.from('services').update(payload).eq('id', editId);
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }
    } else {
      const { data, error } = await supabase
        .from('services')
        .insert({ ...payload, provider_id: providerId })
        .select('id')
        .single();
      if (error) { toast.error('Erro ao adicionar: ' + error.message); return; }
      serviceId = data.id;
    }

    // Update categories: delete old, insert new
    if (serviceId) {
      await supabase.from('service_categories').delete().eq('service_id', serviceId);
      if (selectedCategoryIds.length > 0) {
        await supabase.from('service_categories').insert(
          selectedCategoryIds.map(catId => ({ service_id: serviceId!, category_id: catId }))
        );
      }
    }

    toast.success(editId ? 'Serviço atualizado!' : 'Serviço adicionado!');
    setForm({ service_name: '', description: '', whatsapp: '', service_area: '', address: '', working_hours: '' });
    setSelectedCategoryIds([]);
    setShowForm(false);
    setEditId(null);
    fetchServices();
  };

  const handleEdit = async (s: any) => {
    setForm({
      service_name: s.service_name,
      description: s.description || '',
      whatsapp: s.whatsapp || '',
      service_area: s.service_area || '',
      address: s.address || '',
      working_hours: s.working_hours || '',
    });
    setEditId(s.id);

    // Load existing categories for this service
    const { data } = await supabase
      .from('service_categories')
      .select('category_id')
      .eq('service_id', s.id);
    setSelectedCategoryIds((data || []).map((d: any) => d.category_id));

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
          setCategorySearch('');
          const providerCategory = provider?.category_id || '';
          setSelectedCategoryIds(providerCategory ? [providerCategory] : []);
          setForm({
            service_name: '',
            description: '',
            whatsapp: provider?.whatsapp || '',
            service_area: '',
            address: '',
            working_hours: provider?.working_hours || '',
          });
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
              <input name="service_name" value={form.service_name} onChange={handleChange}
                placeholder="Ex: Instalação elétrica residencial"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">WhatsApp</label>
              <input name="whatsapp" value={form.whatsapp} onChange={handleChange}
                placeholder="Ex: 11999999999"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
          </div>

          {/* Multi-select categories */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Categorias</label>
            {selectedCategoryIds.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {selectedCategoryIds.map(catId => {
                  const cat = categories.find(c => c.id === catId);
                  if (!cat) return null;
                  return (
                    <span key={catId} className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
                      {cat.icon} {cat.name}
                      <button onClick={() => toggleCategory(catId)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {categories
                .filter(c => !selectedCategoryIds.includes(c.id))
                .map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.id)}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                  >
                    {c.icon} {c.name}
                  </button>
                ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Descrição</label>
            <textarea name="description" rows={3} value={form.description} onChange={handleChange}
              placeholder="Descreva o serviço oferecido..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Endereço <span className="text-muted-foreground">(opcional)</span></label>
              <input name="address" value={form.address} onChange={handleChange}
                placeholder="Ex: Rua das Flores, 123 - Centro"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Horário de atendimento <span className="text-muted-foreground">(opcional)</span></label>
              <input name="working_hours" value={form.working_hours} onChange={handleChange}
                placeholder="Ex: Seg a Sex, 8h às 18h"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Área de atendimento <span className="text-muted-foreground">(opcional)</span></label>
              <input name="service_area" value={form.service_area} onChange={handleChange}
                placeholder="Ex: São Paulo - Zona Sul"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
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
                <p className="text-sm font-semibold text-foreground">{s.service_name}</p>
                {s.serviceCategories?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.serviceCategories.map((cat: any, i: number) => (
                      <span key={i} className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                        {cat.icon} {cat.name}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {s.whatsapp && <span>📱 {s.whatsapp}</span>}
                  {s.address && <span>📍 {s.address}</span>}
                  {s.working_hours && <span>🕐 {s.working_hours}</span>}
                  {s.service_area && <span>🗺️ {s.service_area}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
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
