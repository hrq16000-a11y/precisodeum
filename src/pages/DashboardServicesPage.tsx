import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Edit2, X, Search, AlertTriangle, ImagePlus, MapPin, Eye, Pause, Play } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ServiceImageUpload from '@/components/ServiceImageUpload';
import { handleImageError } from '@/lib/imageResolver';
import { format } from 'date-fns';

const CATEGORY_FILTERS = [
  { label: 'Todas', value: 'all', icon: '🔥' },
  { label: 'Venda', value: 'venda', icon: '🛒' },
  { label: 'Compra', value: 'compra', icon: '💰' },
  { label: 'Serviço', value: 'servico', icon: '🏠' },
  { label: 'Troca', value: 'troca', icon: '🔄' },
  { label: 'Aluguel', value: 'aluguel', icon: '🏢' },
  { label: 'Doação', value: 'doacao', icon: '🎁' },
  { label: 'Promoção', value: 'promocao', icon: '％' },
  { label: 'Vaga de Emprego', value: 'vaga', icon: '👔' },
];

const DashboardServicesPage = () => {
  const { user, provider, profile, loading, refetchProfile } = useAuth();
  const { canCreateService, remainingServices, limits, loading: limitsLoading, refetch: refetchLimits } = useAccountLimits();
  const navigate = useNavigate();
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [serviceImages, setServiceImages] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [newServicePhoto, setNewServicePhoto] = useState<File | null>(null);
  const [newServicePhotoPreview, setNewServicePhotoPreview] = useState<string | null>(null);
  const categoryContainerRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    service_name: '',
    description: '',
    price: '',
    whatsapp: '',
    service_area: '',
    address: '',
    working_hours: '',
    website: '',
    category_type: 'venda',
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryContainerRef.current && !categoryContainerRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (data) {
      const serviceIds = data.map(s => s.id);
      
      // Fetch categories and images in parallel
      const [scRes, imgRes] = await Promise.all([
        supabase.from('service_categories').select('service_id, category_id, categories(name, icon)').in('service_id', serviceIds),
        supabase.from('service_images').select('service_id, image_url').in('service_id', serviceIds).order('display_order'),
      ]);

      const catMap: Record<string, any[]> = {};
      (scRes.data || []).forEach((sc: any) => {
        if (!catMap[sc.service_id]) catMap[sc.service_id] = [];
        catMap[sc.service_id].push(sc.categories);
      });

      const imgMap: Record<string, string> = {};
      (imgRes.data || []).forEach((img: any) => {
        if (!imgMap[img.service_id]) imgMap[img.service_id] = img.image_url;
      });
      setServiceImages(imgMap);

      setServices(data.map(s => ({ ...s, serviceCategories: catMap[s.id] || [] })));
    }
  };

  useEffect(() => {
    if (provider) fetchServices();
  }, [provider]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'whatsapp') {
      setForm(prev => ({ ...prev, [name]: value.replace(/\D/g, '').replace(/^0+/, '') }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
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
    if (error) { toast.error('Erro ao criar perfil: ' + error.message); return null; }
    await refetchProfile();
    return data.id;
  };

  const profileType = (profile as any)?.profile_type || (profile as any)?.role || 'client';
  const isRH = profileType === 'rh';

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem excede 5MB'); return; }
    setNewServicePhoto(file);
    setNewServicePhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async (serviceId: string): Promise<void> => {
    if (!newServicePhoto || !user) return;
    const ext = newServicePhoto.name.split('.').pop();
    const path = `${user.id}/${serviceId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('service-images').upload(path, newServicePhoto);
    if (error) return;
    const { data: urlData } = supabase.storage.from('service-images').getPublicUrl(path);
    await supabase.from('service_images').insert({
      service_id: serviceId,
      image_url: urlData.publicUrl,
      display_order: 0,
    });
  };

  const handleSave = async () => {
    if (isRH) { toast.error('Agências RH não podem cadastrar serviços.'); return; }
    if (!editId && !canCreateService) {
      toast.error(limits?.can_create_services === false
        ? 'Seu tipo de conta não permite criar serviços.'
        : `Limite de serviços atingido (${limits?.max_services}).`);
      return;
    }
    if (!form.service_name.trim()) { toast.error('Título é obrigatório'); return; }

    const providerId = await ensureProvider();
    if (!providerId) return;

    const payload = {
      service_name: form.service_name,
      description: form.description,
      whatsapp: form.whatsapp || provider?.whatsapp || '',
      service_area: form.service_area,
      address: provider ? [provider.neighborhood, provider.city, provider.state].filter(Boolean).join(', ') : form.address,
      working_hours: form.working_hours,
      website: form.website,
      price: form.price || null,
    } as any;

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

    if (serviceId) {
      await supabase.from('service_categories').delete().eq('service_id', serviceId);
      if (selectedCategoryIds.length > 0) {
        await supabase.from('service_categories').insert(
          selectedCategoryIds.map(catId => ({ service_id: serviceId!, category_id: catId }))
        );
      }
      // Upload photo if selected
      if (!editId && newServicePhoto) {
        await uploadPhoto(serviceId);
      }
    }

    toast.success(editId ? 'Anúncio atualizado!' : 'Anúncio publicado!');
    resetForm();
    setShowDialog(false);
    await fetchServices();
    refetchLimits();
  };

  const resetForm = () => {
    setForm({ service_name: '', description: '', price: '', whatsapp: '', service_area: '', address: '', working_hours: '', website: '', category_type: 'venda' });
    setSelectedCategoryIds([]);
    setEditId(null);
    setNewServicePhoto(null);
    setNewServicePhotoPreview(null);
  };

  const handleEdit = async (s: any) => {
    setForm({
      service_name: s.service_name,
      description: s.description || '',
      price: s.price || '',
      whatsapp: s.whatsapp || '',
      service_area: s.service_area || '',
      address: s.address || '',
      working_hours: s.working_hours || '',
      website: (s as any).website || provider?.website || '',
      category_type: 'venda',
    });
    setEditId(s.id);
    const { data } = await supabase.from('service_categories').select('category_id').eq('service_id', s.id);
    setSelectedCategoryIds((data || []).map((d: any) => d.category_id));
    setNewServicePhoto(null);
    setNewServicePhotoPreview(null);
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('services').delete().eq('id', id);
    toast.success('Anúncio removido');
    fetchServices();
  };

  const handlePause = async (s: any) => {
    const newDate = s.deleted_at ? null : new Date().toISOString();
    await supabase.from('services').update({ deleted_at: newDate }).eq('id', s.id);
    toast.success(newDate ? 'Anúncio pausado' : 'Anúncio reativado');
    fetchServices();
  };

  // Filter services
  const filtered = services.filter(s => {
    if (searchQuery && !s.service_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  return (
    <DashboardLayout>
      {/* Limits banner */}
      {!limitsLoading && limits && limits.can_create_services && remainingServices !== null && remainingServices === 0 && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Limite de {limits.max_services} anúncio(s) atingido. Atualize seu plano.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Meus Anúncios</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{services.length} anúncio{services.length !== 1 ? 's' : ''}</p>
        </div>
        <Button
          variant="accent"
          disabled={!canCreateService}
          onClick={() => {
            if (!canCreateService) { toast.error('Limite atingido.'); return; }
            resetForm();
            setShowDialog(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Novo Anúncio
        </Button>
      </div>

      {/* Search */}
      <div className="mt-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar anúncios..."
          className="w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Category filter tabs */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORY_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === f.value
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      {/* Service cards */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-foreground font-semibold">Nenhum anúncio encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Crie seu primeiro anúncio para começar a vender.</p>
          </div>
        )}
        {filtered.map(s => {
          const imgUrl = serviceImages[s.id];
          return (
            <div key={s.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden group">
              {/* Image area */}
              <div className="relative aspect-[4/3] bg-muted">
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={s.service_name}
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImagePlus className="h-10 w-10 opacity-30" />
                  </div>
                )}
                {/* Category chips */}
                {s.serviceCategories?.length > 0 && (
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {s.serviceCategories.slice(0, 2).map((cat: any, i: number) => (
                      <span key={i} className="rounded-full bg-card/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm">
                        {cat.icon} {cat.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3 space-y-1.5">
                <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-1">{s.service_name}</h3>
                
                <div className="flex items-center gap-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    s.deleted_at ? 'bg-muted text-muted-foreground' : 'bg-green-100 text-green-700'
                  }`}>
                    {s.deleted_at ? 'Pausado' : 'Ativo'}
                  </span>
                </div>

                {s.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{s.description}</p>
                )}

                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  {s.address && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" /> {s.address.split(',')[0]}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <Eye className="h-3 w-3" /> 0 views
                  </span>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(s.created_at), 'dd/MM/yyyy')}
                  {s.price && <span className="ml-2 font-medium text-foreground">R$ {s.price}</span>}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1.5 border-t border-border">
                  <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => handleEdit(s)}>
                    <Edit2 className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => handlePause(s)}>
                    {s.deleted_at ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-8 text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { resetForm(); } setShowDialog(open); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              📦 {editId ? 'Editar Anúncio' : 'Novo Anúncio'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Title */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Título *</label>
              <input
                name="service_name"
                value={form.service_name}
                onChange={handleChange}
                placeholder="Ex: iPhone 15 Pro Max 256GB"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Descrição</label>
              <textarea
                name="description"
                rows={3}
                value={form.description}
                onChange={handleChange}
                placeholder="Detalhes do produto ou serviço..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground resize-none focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
              />
            </div>

            {/* Price + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Preço (R$)</label>
                <input
                  name="price"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Categoria</label>
                <select
                  name="category_type"
                  value={form.category_type}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                >
                  {CATEGORY_FILTERS.filter(f => f.value !== 'all').map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* City + WhatsApp */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Cidade *</label>
                <input
                  name="service_area"
                  value={form.service_area || (provider ? provider.city : '')}
                  onChange={handleChange}
                  placeholder="Selecione"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">WhatsApp</label>
                <input
                  name="whatsapp"
                  value={form.whatsapp || (provider?.whatsapp ? provider.whatsapp.replace(/^55/, '') : '')}
                  onChange={handleChange}
                  placeholder="(61) 99999-9999"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                />
              </div>
            </div>

            {/* Photo upload area */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Foto do Anúncio</label>
              {editId && user ? (
                <div className="rounded-lg border border-border p-3">
                  <ServiceImageUpload serviceId={editId} userId={user.id} />
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                  <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 flex flex-col items-center justify-center gap-2 hover:border-accent/40 transition-colors">
                    {newServicePhotoPreview ? (
                      <div className="relative w-full">
                        <img src={newServicePhotoPreview} alt="Preview" className="w-full h-32 object-cover rounded-md" />
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setNewServicePhoto(null); setNewServicePhotoPreview(null); }}
                          className="absolute top-1 right-1 rounded-full bg-card p-1 shadow"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <ImagePlus className="h-8 w-8 text-muted-foreground/50" />
                        <span className="text-sm text-muted-foreground">Clique para enviar foto</span>
                        <span className="text-[10px] text-muted-foreground/70">JPG, PNG • Max 5MB</span>
                      </>
                    )}
                  </div>
                </label>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { resetForm(); setShowDialog(false); }}>
                Cancelar
              </Button>
              <Button variant="accent" className="flex-1" onClick={handleSave}>
                📢 {editId ? 'Salvar' : 'Publicar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DashboardServicesPage;
