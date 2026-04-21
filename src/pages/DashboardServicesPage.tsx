import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { compressImage } from '@/lib/compressImage';
import { getSuggestedTags } from '@/data/tagSuggestions';
import { getTemplatesForCategory, DIFFERENTIAL_TAGS, buildExternalPrompt } from '@/data/serviceTemplates';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2, X, Search, ImagePlus, MapPin, Eye, Pause, Play, Zap, Tag, MapPinned, Copy, ExternalLink, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { useAuth } from '@/hooks/useAuth';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import UpsellBanner from '@/components/dashboard/UpsellBanner';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { trackAction } from '@/lib/errorReporter';
import { showSaveError } from '@/components/SaveErrorToast';
import NextStepPrompt from '@/components/dashboard/NextStepPrompt';
import LockedSlotCard from '@/components/dashboard/LockedSlotCard';
import { celebrate } from '@/lib/celebrate';
import { handleImageError } from '@/lib/imageResolver';

// Heavy editor sub-components — only loaded when the edit Dialog opens
const SmartCategoryPicker = lazy(() => import('@/components/SmartCategoryPicker'));
const ServiceImageUpload = lazy(() => import('@/components/dashboard/ServiceImageDragUploader'));

const SuspenseFallback = () => (
  <div className="flex justify-center p-8">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);
import { format } from 'date-fns';
import { useGeoCity } from '@/hooks/useGeoCity';
import { CITIES_INDEX, type CityEntry } from '@/lib/citiesIndex';
import { normalize } from '@/lib/normalize';

// Template-based description helpers (zero AI cost)
const DescriptionTemplatePanel = ({
  categorySlugs,
  serviceName,
  categoryName,
  cityName,
  onApply,
}: {
  categorySlugs: string[];
  serviceName: string;
  categoryName?: string;
  cityName?: string;
  onApply: (text: string) => void;
}) => {
  const [open, setOpen] = useState(false);

  const templates = useMemo(() => {
    return categorySlugs.flatMap(s => getTemplatesForCategory(s));
  }, [categorySlugs]);

  const handleCopyPrompt = () => {
    const prompt = buildExternalPrompt(serviceName || 'meu serviço', categoryName, cityName);
    navigator.clipboard.writeText(prompt).then(() => {
      toast.success('Prompt copiado! Cole no ChatGPT ou Gemini.', { duration: 4000 });
    }).catch(() => toast.error('Não foi possível copiar'));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
        >
          <FileText className="h-3 w-3" />
          Frases Prontas
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <span className="text-muted-foreground text-[10px]">•</span>
        <button
          type="button"
          onClick={handleCopyPrompt}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
        >
          <Copy className="h-3 w-3" /> Copiar Prompt
        </button>
        <a
          href="https://chatgpt.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-accent"
        >
          <ExternalLink className="h-2.5 w-2.5" /> ChatGPT
        </a>
        <a
          href="https://gemini.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-accent"
        >
          <ExternalLink className="h-2.5 w-2.5" /> Gemini
        </a>
      </div>

      {open && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Category templates */}
          {templates.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">📝 Modelos para sua categoria</p>
              <div className="grid gap-1.5">
                {templates.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { onApply(t.description); setOpen(false); toast.success(`Modelo "${t.label}" aplicado!`); }}
                    className="text-left rounded-md border border-border bg-card px-3 py-2 hover:border-accent/40 hover:bg-accent/5 transition-colors group"
                  >
                    <span className="text-xs font-medium text-foreground group-hover:text-accent">{t.label}</span>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Differential tags */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">🏷️ Tags de Diferencial</p>
            <div className="flex flex-wrap gap-1.5">
              {DIFFERENTIAL_TAGS.map((dt) => (
                <button
                  key={dt.label}
                  type="button"
                  onClick={() => {
                    onApply(dt.value);
                    toast.success(`"${dt.label}" adicionado!`);
                  }}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-accent/40 hover:bg-accent/5 transition-colors"
                >
                  {dt.label}
                </button>
              ))}
            </div>
          </div>

          {templates.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">Selecione uma categoria para ver modelos específicos, ou use o botão "Copiar Prompt" para gerar com IA externa gratuita.</p>
          )}
        </div>
      )}
    </div>
  );
};



// Build flat city list once for autocomplete
const ALL_CITIES: { label: string; value: string; state: string }[] = [];
Object.values(CITIES_INDEX).forEach((entries: CityEntry[]) => {
  entries.forEach(e => {
    ALL_CITIES.push({ label: `${e.name} - ${e.state}`, value: e.name, state: e.state });
  });
});

const DashboardServicesPage = () => {
  const { user, provider, profile, loading, refetchProfile } = useAuth();
  const { canCreateService, remainingServices, limits, loading: limitsLoading, refetch: refetchLimits } = useAccountLimits();
  const navigate = useNavigate();
  const geo = useGeoCity();
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  // Wizard step inside the create/edit dialog: 'form' (fields) | 'photos' (post-publish photo step)
  const [wizardStep, setWizardStep] = useState<'form' | 'photos'>('form');
  // Sub-step inside the 'form' wizard for NEW services (1=Básico, 2=Localização, 3=Contato). Editing skips this and shows everything.
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [serviceImages, setServiceImages] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [newServicePhoto, setNewServicePhoto] = useState<File | null>(null);
  const [newServicePhotoPreview, setNewServicePhotoPreview] = useState<string | null>(null);
  const [showNextStepPrompt, setShowNextStepPrompt] = useState(false);

  // New professional fields
  const [isEmergency, setIsEmergency] = useState(false);
  const [serviceRadius, setServiceRadius] = useState('city');
  const [seoTags, setSeoTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // City autocomplete
  const [citySearch, setCitySearch] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [geoDetected, setGeoDetected] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    service_name: '',
    description: '',
    price: '',
    whatsapp: '',
    service_area: '',
    address: '',
    working_hours: '',
    website: '',
    instagram_url: '',
    facebook_url: '',
    youtube_url: '',
  });

  // Close city dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setShowCityDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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

  // Suggested tags based on selected categories
  const suggestedTags = useMemo(() => {
    const selectedSlugs = selectedCategoryIds.map(id => {
      const cat = categories.find((c: any) => c.id === id);
      return cat?.slug || '';
    }).filter(Boolean);
    return getSuggestedTags(selectedSlugs);
  }, [selectedCategoryIds, categories]);

  // Filtered cities for autocomplete
  const filteredCities = useMemo(() => {
    if (!citySearch || citySearch.length < 2) return [];
    const norm = normalize(citySearch);
    return ALL_CITIES.filter(c => {
      const cNorm = normalize(c.value);
      return cNorm.includes(norm) || c.label.toLowerCase().includes(citySearch.toLowerCase());
    }).slice(0, 15);
  }, [citySearch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'whatsapp') {
      setForm(prev => ({ ...prev, [name]: value.replace(/\D/g, '').replace(/^0+/, '') }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
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
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(newServicePhoto);
      const ext = compressed.name.split('.').pop();
      const path = `${user.id}/${serviceId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('service-images').upload(path, compressed);
      if (error) { toast.error('Erro ao enviar foto: ' + error.message); return; }
      const { data: urlData } = supabase.storage.from('service-images').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('service_images').insert({
        service_id: serviceId,
        image_url: urlData.publicUrl,
        display_order: 0,
      });
      if (dbErr) { toast.error('Erro ao salvar foto: ' + dbErr.message); return; }
      toast.success('Foto enviada com sucesso!');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Add tag
  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (!tag || seoTags.includes(tag)) { setTagInput(''); return; }
    if (seoTags.length >= 10) { toast.error('Máximo de 10 tags'); return; }
    setSeoTags(prev => [...prev, tag]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setSeoTags(prev => prev.filter(t => t !== tag));

  const handleSave = async () => {
    if (isRH) { toast.error('Agências RH não podem cadastrar serviços.'); return; }
    if (!editId && !canCreateService) {
      toast.error(limits?.can_create_services === false
        ? 'Seu tipo de conta não permite criar serviços.'
        : `Limite de serviços atingido (${limits?.max_services}).`);
      return;
    }
    const errors: Record<string, string> = {};
    if (!form.service_name.trim()) errors.service_name = 'Título é obrigatório';
    if (!form.service_area.trim()) errors.service_area = 'Cidade é obrigatória';
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});

    trackAction('service_save_start', editId ? 'Editando serviço' : 'Criando serviço');

    try {
      const providerId = await ensureProvider();
      if (!providerId) return;

      const categoryId = selectedCategoryIds[0] || null;
      const payload = {
        service_name: form.service_name,
        description: form.description,
        whatsapp: form.whatsapp || provider?.whatsapp || '',
        service_area: form.service_area,
        address: provider ? [provider.neighborhood, provider.city, provider.state].filter(Boolean).join(', ') : form.address,
        working_hours: form.working_hours,
        website: form.website,
        price: form.price || null,
        instagram_url: form.instagram_url,
        facebook_url: form.facebook_url,
        youtube_url: form.youtube_url,
        is_emergency: isEmergency,
        service_radius: serviceRadius,
        seo_tags: seoTags,
        category_id: categoryId,
        user_ref: provider?.user_ref || null,
      } as any;

      let serviceId = editId;

      if (editId) {
        const { error } = await supabase.from('services').update(payload).eq('id', editId);
        if (error) {
          await showSaveError({ actionContext: 'Atualizar serviço', componentName: 'DashboardServicesPage', errorMessage: error.message, retryFn: handleSave });
          return;
        }
      } else {
        const { data, error } = await (supabase as any).rpc('create_service_atomic', {
          _provider_id: providerId,
          _service_name: payload.service_name,
          _description: payload.description,
          _whatsapp: payload.whatsapp,
          _service_area: payload.service_area,
          _address: payload.address,
          _working_hours: payload.working_hours,
          _website: payload.website,
          _instagram_url: payload.instagram_url,
          _facebook_url: payload.facebook_url,
          _youtube_url: payload.youtube_url,
          _category_id: categoryId,
          _category_ids: selectedCategoryIds,
        });
        if (error || !data?.success) {
          await showSaveError({ actionContext: 'Criar novo serviço', componentName: 'DashboardServicesPage', errorMessage: error?.message || data?.error || 'Falha ao salvar serviço', retryFn: handleSave });
          return;
        }
        serviceId = data.service_id;
      }

      if (serviceId) {
        await supabase.from('service_categories').delete().eq('service_id', serviceId);
        if (selectedCategoryIds.length > 0) {
          await supabase.from('service_categories').insert(
            selectedCategoryIds.map(catId => ({ service_id: serviceId!, category_id: catId }))
          );
        }
        if (!editId && newServicePhoto) {
          await uploadPhoto(serviceId);
        }
      }

      trackAction('service_save_success', editId ? 'Serviço atualizado' : 'Serviço criado');

      if (editId) {
        // Editing existing service: keep current behavior (close + refresh)
        toast.success('Serviço atualizado com sucesso!', {
          description: 'Suas alterações já estão visíveis.',
          duration: 4000,
        });
        resetForm();
        setShowDialog(false);
      } else {
        // First publish: enter photos step (Wizard mode) — DO NOT close dialog
        const newCount = services.length + 1;
        const SERVICES_CAP = 5;
        const unlockedNext = newCount < SERVICES_CAP;
        celebrate({ intensity: 'mini' });
        toast.success('🎉 VOCÊ DESBLOQUEOU MAIS PODER!', {
          description: unlockedNext
            ? `Seu ${newCount + 1}º slot de serviço já está disponível. Continue subindo!`
            : 'Você atingiu o nível máximo de serviços. Que máquina! 🚀',
          duration: 5000,
        });
        setEditId(serviceId!);
        setWizardStep('photos');
        // Trigger "hand-holding" next-step prompt after a short delay
        setTimeout(() => setShowNextStepPrompt(true), 1200);
      }
      await fetchServices();
      refetchLimits();
    } catch (err: any) {
      await showSaveError({
        actionContext: 'Salvar serviço (erro inesperado)',
        componentName: 'DashboardServicesPage',
        errorMessage: err.message || 'Erro desconhecido',
        errorStack: err.stack,
        retryFn: handleSave,
      });
    }
  };

  const resetForm = () => {
    const detectedCity = geo.city || provider?.city || '';
    setForm({
      service_name: '',
      description: '',
      price: '',
      whatsapp: provider?.whatsapp ? provider.whatsapp.replace(/^55/, '') : '',
      service_area: detectedCity,
      address: provider ? [provider.neighborhood, provider.city, provider.state].filter(Boolean).join(', ') : '',
      working_hours: provider?.working_hours || '',
      website: provider?.website || '',
      instagram_url: '',
      facebook_url: '',
      youtube_url: '',
    });
    setCitySearch(detectedCity);
    setGeoDetected(!!geo.city && !provider?.city);
    setSelectedCategoryIds([]);
    setEditId(null);
    setNewServicePhoto(null);
    setNewServicePhotoPreview(null);
    setFormErrors({});
    setIsEmergency(false);
    setServiceRadius('city');
    setSeoTags([]);
    setTagInput('');
    setWizardStep('form');
    setFormStep(1);
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
      instagram_url: s.instagram_url || '',
      facebook_url: s.facebook_url || '',
      youtube_url: s.youtube_url || '',
    });
    setCitySearch(s.service_area || '');
    setGeoDetected(false);
    setIsEmergency(s.is_emergency || false);
    setServiceRadius(s.service_radius || 'city');
    setSeoTags(s.seo_tags || []);
    setEditId(s.id);
    const { data } = await supabase.from('service_categories').select('category_id').eq('service_id', s.id);
    setSelectedCategoryIds((data || []).map((d: any) => d.category_id));
    setNewServicePhoto(null);
    setNewServicePhotoPreview(null);
    setFormStep(1);
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este serviço? Ele será movido para a lixeira.')) return;
    await supabase.from('services').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    toast.success('Serviço movido para a lixeira');
    fetchServices();
  };

  const handlePause = async (s: any) => {
    const newDate = s.deleted_at ? null : new Date().toISOString();
    await supabase.from('services').update({ deleted_at: newDate }).eq('id', s.id);
    toast.success(newDate ? 'Serviço pausado' : 'Serviço reativado');
    fetchServices();
  };

  const selectCity = (city: { label: string; value: string; state: string }) => {
    setForm(prev => ({ ...prev, service_area: city.value }));
    setCitySearch(city.label);
    setShowCityDropdown(false);
    setGeoDetected(false);
    if (formErrors.service_area) setFormErrors(prev => ({ ...prev, service_area: '' }));
  };

  const clearCity = () => {
    setForm(prev => ({ ...prev, service_area: '' }));
    setCitySearch('');
    setGeoDetected(false);
  };

  const filtered = services.filter(s => {
    if (searchQuery && !s.service_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  return (
    <DashboardLayout>
      {!limitsLoading && limits && limits.can_create_services && remainingServices !== null && remainingServices === 0 && (
        <div className="mb-4"><UpsellBanner /></div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Meus Serviços</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{services.length} serviço{services.length !== 1 ? 's' : ''}</p>
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
          <Plus className="mr-1 h-4 w-4" /> Novo Serviço
        </Button>
      </div>

      <div className="mt-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar serviços..."
          className="w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Service cards */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-foreground font-semibold">Nenhum serviço encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Crie seu primeiro serviço para começar a receber clientes.</p>
          </div>
        )}
        {filtered.map(s => {
          const imgUrl = serviceImages[s.id];
          return (
            <div key={s.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden group">
              <div className="relative aspect-[4/3] bg-muted">
                {imgUrl ? (
                  <img src={imgUrl} alt={s.service_name} className="w-full h-full object-cover" onError={handleImageError} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImagePlus className="h-10 w-10 opacity-30" />
                  </div>
                )}
                {s.serviceCategories?.length > 0 && (
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {s.serviceCategories.slice(0, 2).map((cat: any, i: number) => (
                      <span key={i} className="inline-flex items-center gap-0.5 rounded-full bg-card/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm">
                        <CategoryIcon icon={cat.icon} size={12} className="text-current" /> {cat.name}
                      </span>
                    ))}
                  </div>
                )}
                {s.is_emergency && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    <Zap className="h-3 w-3" /> 24h
                  </span>
                )}
              </div>
              <div className="p-3 space-y-1.5">
                <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-1">{s.service_name}</h3>
                <div className="flex items-center gap-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    s.deleted_at ? 'bg-muted text-muted-foreground' : 'bg-green-100 text-green-700'
                  }`}>
                    {s.deleted_at ? 'Pausado' : 'Ativo'}
                  </span>
                </div>
                {s.description && <p className="text-xs text-muted-foreground line-clamp-1">{s.description}</p>}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  {s.service_area && (
                    <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {s.service_area}</span>
                  )}
                  <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> {s.view_count ?? 0} views</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(s.created_at), 'dd/MM/yyyy')}
                  {s.price && <span className="ml-2 font-medium text-foreground">R$ {s.price}</span>}
                </p>
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
        {/* Progressive unlock — show 1 locked "next slot" if user is below cap and has at least 1 service */}
        {(() => {
          const SERVICES_CAP = Math.min(5, limits?.max_services ?? 5);
          const used = services.length;
          if (used === 0 || used >= SERVICES_CAP) return null;
          const nextSlotNumber = used + 1;
          return <LockedSlotCard label={`${nextSlotNumber}º slot — bloqueado`} />;
        })()}
      </div>

      {/* ─── New/Edit Dialog ─── */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { resetForm(); } setShowDialog(open); }}>
        <DialogContent className="max-w-md p-0 flex flex-col max-h-[90vh] overflow-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:bg-accent/60 [&::-webkit-scrollbar-thumb]:rounded-full">
          <DialogHeader className="px-5 pt-5 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              {wizardStep === 'photos'
                ? <>📸 Adicione Fotos do Serviço</>
                : <>🔧 {editId ? 'Editar Serviço' : 'Novo Serviço'}</>}
            </DialogTitle>
            {wizardStep === 'photos' && (
              <p className="text-xs text-muted-foreground mt-1">
                Passo final: envie suas fotos. A primeira será a capa. Anúncios com foto recebem até <strong className="text-accent">3x mais contatos</strong>.
              </p>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:bg-accent/60 [&::-webkit-scrollbar-thumb]:rounded-full">

            {/* ── PHOTOS WIZARD STEP (post-publish) ── */}
            {wizardStep === 'photos' && editId && user && (
              <div className="space-y-3">
                <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 flex items-start gap-2">
                  <Zap className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <div className="text-xs text-foreground">
                    <p className="font-semibold">Serviço publicado com sucesso!</p>
                    <p className="text-muted-foreground mt-0.5">
                      Para finalizar, adicione fotos abaixo. A primeira foto será usada como capa do anúncio.
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <Suspense fallback={<SuspenseFallback />}>
                    <ServiceImageUpload serviceId={editId} userId={user.id} />
                  </Suspense>
                </div>
              </div>
            )}

            {/* ── FORM STEP (initial create or edit) ── */}
            {wizardStep === 'form' && (<>

            {/* Wizard Step Indicator */}
            <div className="flex items-center justify-center gap-2 -mt-1">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    formStep === n ? 'bg-accent text-accent-foreground' : formStep > n ? 'bg-accent/30 text-accent' : 'bg-muted text-muted-foreground'
                  }`}>
                    {formStep > n ? '✓' : n}
                  </div>
                  {n < 3 && <div className={`h-0.5 w-8 ${formStep > n ? 'bg-accent/40' : 'bg-muted'}`} />}
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground -mt-2">
              {formStep === 1 && 'Etapa 1 de 3 · Informações Básicas'}
              {formStep === 2 && 'Etapa 2 de 3 · Localização & Atendimento'}
              {formStep === 3 && 'Etapa 3 de 3 · Contato & Mídia'}
            </p>

            {/* ── Section 1: Informações Básicas ── */}
            {formStep === 1 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                📝 Informações Básicas
              </h3>
              <div className="rounded-lg border border-border bg-card p-3 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Título do Serviço *</label>
                  <input
                    name="service_name"
                    value={form.service_name}
                    onChange={handleChange}
                    placeholder="Ex: Instalação de Ar Condicionado"
                    className={`w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none ${formErrors.service_name ? 'border-destructive' : 'border-input'}`}
                  />
                  {formErrors.service_name && <p className="text-xs text-destructive mt-1">{formErrors.service_name}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-foreground">Descrição</label>
                  </div>
                  <DescriptionTemplatePanel
                    categorySlugs={selectedCategoryIds.map(id => {
                      const cat = categories.find((c: any) => c.id === id);
                      return cat?.slug || '';
                    }).filter(Boolean)}
                    serviceName={form.service_name}
                    categoryName={categories.find((c: any) => selectedCategoryIds.includes(c.id))?.name}
                    cityName={form.service_area}
                    onApply={(desc) => setForm(prev => ({ ...prev, description: prev.description ? `${prev.description}\n\n${desc}` : desc }))}
                  />
                  <textarea
                    name="description"
                    rows={3}
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Descreva seu serviço, diferenciais e o que está incluso no valor..."
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground resize-none focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Preço (R$)</label>
                    <input
                      name="price"
                      value={form.price}
                      onChange={handleChange}
                      placeholder="A partir de..."
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Categoria</label>
                    <Suspense fallback={<SuspenseFallback />}>
                      <SmartCategoryPicker
                        categories={categories}
                        selectedIds={selectedCategoryIds}
                        onToggle={toggleCategory}
                        maxSelections={1}
                        placeholder="Escolha 1 categoria..."
                      />
                    </Suspense>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* ── Section 2: Localização & Atendimento ── */}
            {formStep === 2 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MapPinned className="h-3.5 w-3.5" /> Localização & Atendimento
              </h3>
              <div className="rounded-lg border border-border bg-card p-3 space-y-3">
                {/* City autocomplete */}
                <div ref={cityRef} className="relative">
                  <label className="mb-1 block text-sm font-medium text-foreground">Cidade *</label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      value={citySearch}
                      onChange={(e) => {
                        setCitySearch(e.target.value);
                        setShowCityDropdown(true);
                        if (e.target.value.length < 2) setForm(prev => ({ ...prev, service_area: '' }));
                      }}
                      onFocus={() => { if (citySearch.length >= 2) setShowCityDropdown(true); }}
                      placeholder="Digite o nome da cidade..."
                      className={`w-full rounded-lg border bg-background pl-9 pr-8 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none ${formErrors.service_area ? 'border-destructive' : 'border-input'}`}
                    />
                    {form.service_area && (
                      <button type="button" onClick={clearCity} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {geoDetected && form.service_area && (
                    <p className="text-[11px] text-accent mt-0.5 flex items-center gap-1">📍 Localização detectada</p>
                  )}
                  {formErrors.service_area && <p className="text-xs text-destructive mt-1">{formErrors.service_area}</p>}
                  {showCityDropdown && filteredCities.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
                      {filteredCities.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectCity(c)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 text-foreground transition-colors"
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Service Radius */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Raio de Atendimento</label>
                  <Select value={serviceRadius} onValueChange={setServiceRadius}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">📍 Atendimento no local</SelectItem>
                      <SelectItem value="city">🏙️ Toda a cidade</SelectItem>
                      <SelectItem value="metro">🗺️ Região Metropolitana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Emergency Toggle */}
                <div className={`flex items-center justify-between rounded-lg p-3 transition-colors ${isEmergency ? 'bg-orange-50 border border-orange-200 dark:bg-orange-950/30 dark:border-orange-800' : 'bg-muted/50'}`}>
                  <div className="flex items-center gap-2">
                    <Zap className={`h-4 w-4 ${isEmergency ? 'text-orange-500' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">Atendimento 24h / Emergências</p>
                      <p className="text-[11px] text-muted-foreground">Apareça nos filtros de urgência</p>
                    </div>
                  </div>
                  <Switch checked={isEmergency} onCheckedChange={setIsEmergency} />
                </div>
              </div>
            </div>
            )}

            {/* ── Section 3: Contato & Mídia ── */}
            {formStep === 3 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                📱 Contato & Mídia
              </h3>
              <div className="rounded-lg border border-border bg-card p-3 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">WhatsApp</label>
                  <input
                    name="whatsapp"
                    value={form.whatsapp}
                    onChange={handleChange}
                    placeholder="(61) 99999-9999"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                  />
                </div>

                {/* Photos are added in the dedicated post-publish step (1 capa + até 4 extras com drag&drop) */}
                {!editId && (
                  <div className="rounded-lg bg-muted/30 border border-dashed border-border p-3 flex items-start gap-2">
                    <ImagePlus className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Você poderá adicionar <strong className="text-foreground">até 5 fotos</strong> (1 capa + 4 extras, com arrastar para reordenar) logo após publicar.
                    </p>
                  </div>
                )}
                {editId && user && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Fotos do Serviço</label>
                    <div className="rounded-lg border border-border p-3">
                      <Suspense fallback={<SuspenseFallback />}>
                        <ServiceImageUpload serviceId={editId} userId={user.id} />
                      </Suspense>
                    </div>
                  </div>
                )}

                {/* Social links */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Redes Sociais</label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">📸</span>
                    <input name="instagram_url" value={form.instagram_url} onChange={handleChange} placeholder="https://instagram.com/seu_perfil" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">📘</span>
                    <input name="facebook_url" value={form.facebook_url} onChange={handleChange} placeholder="https://facebook.com/sua_pagina" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">🎬</span>
                    <input name="youtube_url" value={form.youtube_url} onChange={handleChange} placeholder="https://youtube.com/watch?v=..." className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none" />
                  </div>
                </div>

                {/* Points Preview */}
                {!editId && (
                  <div className="rounded-lg bg-accent/5 border border-accent/10 p-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-accent shrink-0" />
                    <p className="text-xs text-foreground font-medium">
                      Este serviço te dará <span className="font-bold text-accent">+15 pontos</span> de engajamento!
                    </p>
                  </div>
                )}

                {/* SEO Tags */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" /> Palavras-chave / Tags
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                      placeholder="Ex: reformas, elétrica, urgência"
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addTag} className="shrink-0">+</Button>
                  </div>
                  {/* Tag suggestions based on categories */}
                  {suggestedTags.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] text-muted-foreground mb-1">Sugestões:</p>
                      <div className="flex flex-wrap gap-1">
                        {suggestedTags.filter(t => !seoTags.includes(t)).slice(0, 8).map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => { if (seoTags.length < 10) setSeoTags(prev => [...prev, tag]); }}
                            className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors"
                          >
                            +{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {seoTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {seoTags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2.5 py-0.5 text-xs font-medium">
                          #{tag}
                          <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}
            <div className="h-2" />
            </>)}
          </div>

          {/* ── Sticky Action Bar (varies per wizard step) ── */}
          <div className="shrink-0 border-t border-border bg-card px-5 py-3 flex gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            {wizardStep === 'photos' ? (
              <Button
                variant="accent"
                className="flex-1 h-11 font-semibold"
                onClick={() => { resetForm(); setShowDialog(false); }}
              >
                ✅ Concluir
              </Button>
            ) : (
              <>
                <Button variant="outline" className="flex-1 h-11" onClick={() => {
                  if (formStep > 1) setFormStep((formStep - 1) as 1 | 2 | 3);
                  else { resetForm(); setShowDialog(false); }
                }}>
                  {formStep > 1 ? '← Voltar' : 'Cancelar'}
                </Button>
                {formStep < 3 ? (
                  <Button variant="accent" className="flex-1 h-11 font-semibold" onClick={() => {
                    // Validate per step before advancing
                    if (formStep === 1 && !form.service_name.trim()) {
                      setFormErrors({ service_name: 'Título é obrigatório' });
                      toast.error('Informe o título do serviço');
                      return;
                    }
                    if (formStep === 2 && !form.service_area.trim()) {
                      setFormErrors({ service_area: 'Cidade é obrigatória' });
                      toast.error('Informe a cidade de atendimento');
                      return;
                    }
                    setFormErrors({});
                    setFormStep((formStep + 1) as 1 | 2 | 3);
                  }}>
                    Avançar →
                  </Button>
                ) : (
                  <Button variant="accent" className="flex-1 h-11 font-semibold" onClick={handleSave}>
                    📢 {editId ? 'Salvar' : 'Publicar'}
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <NextStepPrompt
        open={showNextStepPrompt}
        onClose={() => setShowNextStepPrompt(false)}
        context="service"
        providerSlug={provider?.slug ?? null}
      />
    </DashboardLayout>
  );
};

export default DashboardServicesPage;
