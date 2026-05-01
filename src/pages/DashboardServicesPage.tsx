import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { compressImage } from '@/lib/compressImage';
import { getSuggestedTags } from '@/data/tagSuggestions';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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
import { formatServiceArea, stripLegacyAreaPrefixes, isCatalogedCity } from '@/lib/serviceAreaFormat';
import { CELEBRATION_IDS, celebrate } from '@/lib/celebrate';
import { handleImageError } from '@/lib/imageResolver';
import {
  lintServiceDescription,
  sanitizePastedCity,
  rewriteWithQuality,
  computeAdScore,
  shouldBlockByLeilao,
  LEILAO_BLOCK_THRESHOLD,
} from '@/lib/serviceQualityLinter';
import { CheckCircle2, AlertTriangle, Sparkles, Award } from 'lucide-react';
import AdQualityScore from '@/components/dashboard/AdQualityScore';
import AdLivePreview from '@/components/dashboard/AdLivePreview';
import GoldChecklist from '@/components/dashboard/GoldChecklist';
import WizardLegalDisclaimer from '@/components/dashboard/WizardLegalDisclaimer';
import MetroExpandSuggestion from '@/components/dashboard/MetroExpandSuggestion';
import GeoPermissionStep from '@/components/dashboard/GeoPermissionStep';
import {
  loadServiceWizardDraft,
  clearServiceWizardDraft,
  useServiceWizardDraftAutosave,
} from '@/hooks/useServiceWizardDraft';
import { Checkbox } from '@/components/ui/checkbox';
import { findMetroByPole, getMetroMembers } from '@/lib/metroRegions';
import { validateWhatsapp } from '@/lib/whatsapp';
import { UserCheck } from 'lucide-react';
import type { QualityBlockState } from '@/components/dashboard/QualityBlockModal';

// Heavy editor sub-components — only loaded when the edit Sheet opens (lazy chunks)
const SmartCategoryPicker = lazy(() => import('@/components/SmartCategoryPicker'));
const ServiceImageUpload = lazy(() => import('@/components/dashboard/ServiceImageDragUploader'));
const DescriptionTemplatePanel = lazy(() => import('@/components/dashboard/DescriptionTemplatePanel'));
const QualityBlockModal = lazy(() => import('@/components/dashboard/QualityBlockModal'));
const SuspenseFallback = lazy(() => import('@/components/dashboard/SuspenseFallback'));

import { format } from 'date-fns';
import { useGeoCity } from '@/hooks/useGeoCity';
import { CITIES_INDEX, type CityEntry } from '@/lib/citiesIndex';
import { normalize } from '@/lib/normalize';


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
  const [searchParams, setSearchParams] = useSearchParams();
  const geo = useGeoCity();
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  // Wizard step inside the create/edit dialog: 'form' (fields) | 'photos' (post-publish photo step)
  const [wizardStep, setWizardStep] = useState<'form' | 'photos'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Sub-step inside the 'form' wizard for NEW services (1=Básico, 2=Localização, 3=Contato). Editing skips this and shows everything.
  const [formStep, setFormStep] = useState<1 | 2 | 3 | 4>(1);
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

  // Kill-switch modal (score < 50% OR > 3 leilão hits)
  const [blockModal, setBlockModal] = useState<{ open: boolean; score: number; hits: number; reasons: string[] }>({
    open: false, score: 0, hits: 0, reasons: [],
  });
  // Final consent (Step 4) — checkbox de responsabilidade direta
  const [finalConsent, setFinalConsent] = useState(false);
  // Bônus visual quando o prestador expande para a RM
  const [metroBonus, setMetroBonus] = useState(false);

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

  // Persistência de rascunho — apenas para criação (não em edição) e quando o dialog está aberto.
  const draftEnabled = showDialog && !editId;
  useServiceWizardDraftAutosave(user?.id, draftEnabled, {
    form,
    selectedCategoryIds,
    citySearch,
    serviceRadius,
    isEmergency,
    seoTags,
    geoDetected,
    formStep,
  });

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

  useEffect(() => {
    if (loading || !user || !provider) return;
    if (searchParams.get('action') !== 'new') return;
    resetForm();
    setShowDialog(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('action');
    setSearchParams(nextParams, { replace: true });
  }, [loading, user, provider, searchParams, setSearchParams]);

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
      const compressed = await compressImage(newServicePhoto, { maxDimension: 1200, targetKB: 300 });
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
    // Friendly anti double-click: warn but don't crash
    if (isSubmitting) {
      toast.info('🚀 Calma, mestre! Já estamos salvando seu talento, só um segundo...', { duration: 2500 });
      return;
    }
    if (isRH) { toast.error('Agências RH não podem cadastrar serviços.'); return; }
    if (!editId && !canCreateService) {
      toast.error(limits?.can_create_services === false
        ? 'Seu tipo de conta não permite criar serviços.'
        : `Limite de serviços atingido (${limits?.max_services}).`);
      return;
    }
    const errors: Record<string, string> = {};
    if (!form.service_name.trim()) errors.service_name = 'Título é obrigatório';
    const cleanedArea = stripLegacyAreaPrefixes(form.service_area);
    if (!cleanedArea) {
      errors.service_area = 'Cidade é obrigatória';
    } else if (!isCatalogedCity(cleanedArea, ALL_CITIES)) {
      // Bloqueia digitação livre — só aceita seleção do autocomplete (IBGE).
      errors.service_area = 'Selecione uma cidade da lista (não digite manualmente)';
    }
    // Linter anti-leilão: avisa para qualquer hit, mas só BLOQUEIA o save
    // quando a descrição contém mais que LEILAO_BLOCK_THRESHOLD termos.
    const forbiddenHits = lintServiceDescription(form.description);
    if (forbiddenHits.length > 0 && !shouldBlockByLeilao(forbiddenHits)) {
      toast.warning(`Atenção: ${forbiddenHits.length} termo(s) de leilão na descrição`, {
        description: `Sugestão para "${forbiddenHits[0].term}": ${forbiddenHits[0].suggestion}`,
        duration: 5000,
      });
    }
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    // ── KILL-SWITCH (HARD STOP) ─────────────────────────────────────────────
    // Bloqueia fisicamente o save quando o anúncio não atinge o padrão mínimo.
    // Regras: score < 50% OU mais de 3 termos de leilão.
    const selectedSlugsForGate = selectedCategoryIds
      .map((id) => categories.find((c: any) => c.id === id)?.slug)
      .filter(Boolean) as string[];
    const cityValidatedForGate = isCatalogedCity(cleanedArea, ALL_CITIES);
    const gateScore = computeAdScore({
      description: form.description,
      hasOriginalPhoto: !!newServicePhoto || (!!editId && !!serviceImages[editId]),
      cityValidated: cityValidatedForGate,
      categorySlugs: selectedSlugsForGate,
    });
    const blockReasons: string[] = [];
    if (gateScore.score < 50) blockReasons.push(`Score atual ${gateScore.score}% (mínimo 50%)`);
    if (forbiddenHits.length > LEILAO_BLOCK_THRESHOLD) {
      blockReasons.push(`${forbiddenHits.length} termos de leilão (limite ${LEILAO_BLOCK_THRESHOLD})`);
    }
    if (blockReasons.length > 0) {
      // Auditoria fail-soft da tentativa bloqueada
      try {
        const providerId = provider?.id || null;
        await (supabase.from as any)('service_quality_log').insert({
          service_id: null,
          provider_id: providerId,
          user_id: user?.id,
          initial_score: gateScore.score,
          final_score: gateScore.score,
          forbidden_hits: gateScore.forbiddenHits.map((h) => h.term),
          category_keywords_hit: gateScore.matchedKeywords,
          description_length: form.description.trim().length,
          reason: 'blocked_by_policy',
        });
      } catch { /* fail-soft */ }
      setBlockModal({ open: true, score: gateScore.score, hits: forbiddenHits.length, reasons: blockReasons });
      return;
    }
    // Final consent é obrigatório para publicação (apenas em criação)
    if (!editId && !finalConsent) {
      toast.error('Confirme o termo de responsabilidade direta antes de publicar.');
      return;
    }

    // Coerência radius=city: trava service_area = provider.city
    let finalArea = cleanedArea;
    if (serviceRadius === 'city' && provider?.city) {
      finalArea = provider.city;
    }
    // Garante que vai para o banco já normalizado (trigger do DB também valida).
    if (finalArea !== form.service_area) {
      setForm((prev) => ({ ...prev, service_area: finalArea }));
    }
    setFormErrors({});
    setIsSubmitting(true);

    // Captura snapshot do score ANTES de qualquer manipulação final — usado
    // para auditar a evolução do anúncio (initial_score → final_score).
    const selectedSlugsForScore = selectedCategoryIds
      .map((id) => categories.find((c: any) => c.id === id)?.slug)
      .filter(Boolean) as string[];
    const initialScoreSnapshot = computeAdScore({
      description: form.description,
      hasOriginalPhoto: !!newServicePhoto || (!!editId && !!serviceImages[editId]),
      cityValidated: isCatalogedCity(stripLegacyAreaPrefixes(form.service_area), ALL_CITIES),
      categorySlugs: selectedSlugsForScore,
    }).score;

    trackAction('service_save_start', editId ? 'Editando serviço' : 'Criando serviço');

    try {
      const providerId = await ensureProvider();
      if (!providerId) return;

      const categoryId = selectedCategoryIds[0] || null;
      const payload = {
        service_name: form.service_name,
        description: form.description,
        whatsapp: form.whatsapp || provider?.whatsapp || '',
        service_area: finalArea,
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
        const { error } = await (supabase.rpc as any)('update_service_atomic', {
          p_service_id: editId,
          p_data: payload,
          p_category_ids: selectedCategoryIds,
        });
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
        celebrate({ intensity: 'mini', id: CELEBRATION_IDS.serviceSlot(serviceId!) });
        const finalScore = computeAdScore({
          description: form.description,
          hasOriginalPhoto: !!newServicePhoto,
          cityValidated: isCatalogedCity(stripLegacyAreaPrefixes(finalArea), ALL_CITIES),
          categorySlugs: selectedSlugsForScore,
        });
        // Auditoria de evolução do score (initial → final). Fail-soft.
        try {
          await (supabase.from as any)('service_quality_log').insert({
            service_id: serviceId,
            provider_id: providerId,
            user_id: user?.id,
            initial_score: initialScoreSnapshot,
            final_score: finalScore.score,
            forbidden_hits: finalScore.forbiddenHits.map((h) => h.term),
            category_keywords_hit: finalScore.matchedKeywords,
            description_length: form.description.trim().length,
            reason: 'publish',
          });
        } catch { /* fail-soft: auditoria não bloqueia publicação */ }
        if (finalScore.isPadrãoOuro) {
          celebrate({ intensity: 'big', id: `padrao-ouro-${serviceId}` });
          toast.success('Anúncio Padrão Ouro publicado!', {
            description: '+25 pontos extras de engajamento creditados.',
            duration: 6000,
          });
        }
        toast.success('🎉 Você ganhou um novo slot!', {
          description: unlockedNext
            ? `Seu ${newCount + 1}º espaço na vitrine já está liberado. Continue subindo!`
            : 'Você atingiu o nível máximo de serviços. Que máquina! 🚀',
          duration: 5000,
        });
        setEditId(serviceId!);
        setWizardStep('photos');
        // Serviço publicado — limpa o rascunho local.
        clearServiceWizardDraft(user?.id);
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
    } finally {
      setIsSubmitting(false);
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
    setFinalConsent(false);
    setMetroBonus(false);
    clearServiceWizardDraft(user?.id);
  };

  // Restore draft when opening dialog for a NEW service.
  // Disparado uma vez por abertura — não rehidrata em modo edição.
  const restoredOnOpenRef = useRef(false);
  useEffect(() => {
    if (!showDialog || editId) {
      restoredOnOpenRef.current = false;
      return;
    }
    if (restoredOnOpenRef.current) return;
    restoredOnOpenRef.current = true;
    const draft = loadServiceWizardDraft(user?.id);
    if (!draft) return;
    setForm(draft.form);
    setSelectedCategoryIds(draft.selectedCategoryIds);
    setCitySearch(draft.citySearch);
    setServiceRadius(draft.serviceRadius);
    setIsEmergency(draft.isEmergency);
    setSeoTags(draft.seoTags);
    setGeoDetected(draft.geoDetected);
    setFormStep(draft.formStep);
    toast.message('Rascunho restaurado', {
      description: 'Continuamos do ponto onde você parou.',
      duration: 3000,
    });
  }, [showDialog, editId, user?.id]);

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
    const { error } = await (supabase.rpc as any)('update_service_atomic', {
      p_service_id: id,
      p_data: { deleted_at: new Date().toISOString() },
      p_category_ids: null,
    });
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Serviço movido para a lixeira');
    fetchServices();
  };

  const handlePause = async (s: any) => {
    const newDate = s.deleted_at ? null : new Date().toISOString();
    const { error } = await (supabase.rpc as any)('update_service_atomic', {
      p_service_id: s.id,
      p_data: { deleted_at: newDate },
      p_category_ids: null,
    });
    if (error) { toast.error('Erro: ' + error.message); return; }
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-11 w-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

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
          <div className="col-span-full rounded-2xl border-2 border-dashed border-accent/30 bg-gradient-to-br from-accent/5 via-card to-card p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Plus className="h-8 w-8" />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-foreground">
              {services.length === 0
                ? 'Você ainda não possui serviços cadastrados'
                : 'Nenhum serviço encontrado'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
              {services.length === 0
                ? 'Cadastre seu primeiro serviço para começar a aparecer nas buscas e receber leads de clientes.'
                : 'Tente ajustar os termos da busca ou limpe o filtro.'}
            </p>
            {services.length === 0 && canCreateService && (
              <Button
                variant="accent"
                size="lg"
                className="mt-5 gap-2"
                onClick={() => { resetForm(); setShowDialog(true); }}
              >
                <Plus className="h-5 w-5" /> Cadastrar primeiro serviço
              </Button>
            )}
          </div>
        )}
        {filtered.map(s => {
          const imgUrl = serviceImages[s.id];
          return (
            <div key={s.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden group">
              <div className="relative aspect-[4/3] bg-muted">
                {imgUrl ? (
                  <img src={imgUrl} alt={s.service_name} loading="lazy" decoding="async" width={400} height={300} className="w-full h-full object-cover" onError={handleImageError} />
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
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-1 flex-1">{s.service_name}</h3>
                  <div className="flex items-center gap-1.5 shrink-0" title={s.deleted_at ? 'Serviço pausado — ative para aparecer nas buscas' : 'Serviço ativo — clique para pausar'}>
                    <Switch
                      checked={!s.deleted_at}
                      onCheckedChange={() => handlePause(s)}
                      aria-label={s.deleted_at ? 'Ativar serviço' : 'Pausar serviço'}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    s.deleted_at ? 'bg-muted text-muted-foreground' : 'bg-green-100 text-green-700'
                  }`}>
                    {s.deleted_at ? 'Pausado' : 'Ativo'}
                  </span>
                </div>
                {s.description && <p className="text-xs text-muted-foreground line-clamp-1">{s.description}</p>}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  {(() => {
                    const area = formatServiceArea(s.service_area, s.service_radius, provider?.city);
                    return area ? (
                      <span className="flex items-center gap-0.5" title="Área de atendimento">
                        <MapPin className="h-3 w-3" /> {area}
                      </span>
                    ) : null;
                  })()}
                  <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> {s.view_count ?? 0} views</span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(s.created_at), 'dd/MM/yyyy')}
                  </p>
                  {s.price && (
                    <p className="text-xs font-semibold text-foreground">
                      <span className="text-[10px] font-normal text-muted-foreground">Valores a partir de</span>{' '}
                      R$ {s.price}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1.5 border-t border-border">
                  <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => handleEdit(s)}>
                    <Edit2 className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/5 focus-visible:ring-destructive/40"
                    onClick={() => handleDelete(s.id)}
                    aria-label="Excluir serviço"
                    title="Excluir serviço"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {/* Próximo slot disponível — CTA claro com explicação de limites */}
        {(() => {
          const SERVICES_CAP = Math.min(5, limits?.max_services ?? 5);
          const used = services.length;
          if (used === 0 || used >= SERVICES_CAP) return null;
          const nextSlotNumber = used + 1;
          const remaining = SERVICES_CAP - used;
          const subline =
            limits?.max_services && limits.max_services <= 5
              ? `Você tem ${remaining} ${remaining === 1 ? 'vaga restante' : 'vagas restantes'} no seu plano (${SERVICES_CAP} no total). Cada serviço extra aumenta seu alcance no Google e nas buscas internas.`
              : 'Adicionar mais um serviço amplia seu alcance no Google e nas buscas internas. Você pode pausar ou editar a qualquer momento.';
          return (
            <button
              type="button"
              onClick={() => { resetForm(); setShowDialog(true); }}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent/40 bg-accent/5 p-5 text-center transition-colors hover:border-accent hover:bg-accent/10 min-h-[200px]"
              aria-label={`Cadastrar ${nextSlotNumber}º serviço`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Plus className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-accent">
                {nextSlotNumber}º slot disponível — adicionar serviço
              </p>
              <p className="text-[11px] text-muted-foreground leading-snug max-w-[220px]">
                {subline}
              </p>
            </button>
          );
        })()}
      </div>

      {/* ─── New/Edit Sheet (lazy mount: árvore só existe quando showDialog=true) ─── */}
      {showDialog && (
      <Sheet open={showDialog} onOpenChange={(open) => { if (!open) { resetForm(); } setShowDialog(open); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl p-0 flex flex-col gap-0 overflow-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:bg-accent/60 [&::-webkit-scrollbar-thumb]:rounded-full"
        >
          <SheetHeader className="px-5 pt-5 pb-2 shrink-0 text-left">
            <SheetTitle className="flex items-center gap-2 text-lg">
              {wizardStep === 'photos'
                ? <>📸 Adicione Fotos do Serviço</>
                : <>🔧 {editId ? 'Editar Serviço' : 'Novo Serviço'}</>}
            </SheetTitle>
            {wizardStep === 'photos' && (
              <p className="text-xs text-muted-foreground mt-1">
                Passo final: envie suas fotos. A primeira será a capa. Anúncios com foto recebem até <strong className="text-accent">3x mais contatos</strong>.
              </p>
            )}
          </SheetHeader>

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
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    formStep === n ? 'bg-accent text-accent-foreground' : formStep > n ? 'bg-accent/30 text-accent' : 'bg-muted text-muted-foreground'
                  }`}>
                    {formStep > n ? '✓' : n}
                  </div>
                  {n < 4 && <div className={`h-0.5 w-6 ${formStep > n ? 'bg-accent/40' : 'bg-muted'}`} />}
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground -mt-2">
              {formStep === 1 && 'Etapa 1 de 4 · Informações Básicas'}
              {formStep === 2 && 'Etapa 2 de 4 · Localização & Atendimento'}
              {formStep === 3 && 'Etapa 3 de 4 · Contato & Mídia'}
              {formStep === 4 && 'Etapa 4 de 4 · Revisão Final'}
            </p>

            {/* Contagem expressa — só na criação (não em edição) */}
            {!editId && (() => {
              const MAX = 5;
              const current = Math.min(services.length + 1, MAX);
              const remainingAfter = Math.max(0, MAX - current);
              let title = `Você está cadastrando seu ${current}º serviço`;
              let subtitle = `Após finalizar, você libera mais ${remainingAfter} cadastro${remainingAfter === 1 ? '' : 's'}.`;
              if (current === 1) {
                title = 'Seu 1º serviço — vamos começar!';
                subtitle = `Você poderá cadastrar até ${MAX} no total.`;
              } else if (current === MAX) {
                title = `Último serviço — após este você terá ${MAX} anúncios ativos`;
                subtitle = 'Capricha! Esse é o fechamento do seu portfólio.';
              } else if (current === MAX - 1) {
                title = 'Penúltimo serviço — falta só 1 depois deste';
                subtitle = `Após finalizar, restará ${remainingAfter} cadastro disponível.`;
              }
              return (
                <div
                  className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-center"
                  aria-label={`Serviço ${current} de ${MAX}`}
                >
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
                </div>
              );
            })()}

            {/* Barra de progresso global de qualidade — sempre visível durante o wizard */}
            <div className="rounded-lg border border-border bg-card/50 p-2">
              <AdQualityScore
                description={form.description}
                hasOriginalPhoto={!!newServicePhoto || (!!editId && !!serviceImages[editId])}
                cityValidated={isCatalogedCity(stripLegacyAreaPrefixes(form.service_area), ALL_CITIES)}
                categorySlugs={selectedCategoryIds.map((id) => categories.find((c: any) => c.id === id)?.slug).filter(Boolean) as string[]}
              />
            </div>

            {/* Prévia ao vivo do anúncio — atualiza a cada digitação */}
            <AdLivePreview
              title={form.service_name}
              description={form.description}
              city={stripLegacyAreaPrefixes(form.service_area)}
              cityValidated={isCatalogedCity(stripLegacyAreaPrefixes(form.service_area), ALL_CITIES)}
              hasOriginalPhoto={!!newServicePhoto || (!!editId && !!serviceImages[editId])}
              categoryName={categories.find((c: any) => selectedCategoryIds.includes(c.id))?.name}
              categorySlugs={selectedCategoryIds.map((id) => categories.find((c: any) => c.id === id)?.slug).filter(Boolean) as string[]}
            />

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

                {/* Auto-fill: importa Bio + Foto do perfil para acelerar o cadastro */}
                {!editId && (provider?.description || provider?.photo_url) && (
                  <button
                    type="button"
                    onClick={() => {
                      const bio = (provider?.description || '').trim();
                      const importedPhoto = !!provider?.photo_url;
                      if (!bio && !importedPhoto) {
                        toast.info('Seu perfil ainda não tem descrição nem foto para importar.');
                        return;
                      }
                      if (bio) {
                        setForm((prev) => ({
                          ...prev,
                          description: prev.description ? prev.description : bio,
                        }));
                      }
                      // Roda re-linter imediatamente para mostrar se a bio "serve"
                      const hits = bio ? lintServiceDescription(bio) : [];
                      const slugs = selectedCategoryIds
                        .map((id) => categories.find((c: any) => c.id === id)?.slug)
                        .filter(Boolean) as string[];
                      const score = computeAdScore({
                        description: bio || form.description,
                        hasOriginalPhoto: importedPhoto,
                        cityValidated: isCatalogedCity(stripLegacyAreaPrefixes(form.service_area), ALL_CITIES),
                        categorySlugs: slugs,
                      });
                      const tone = score.score >= 70 ? 'success' : score.score >= 40 ? 'info' : 'warning';
                      toast[tone](`Dados importados do seu perfil — score ${score.score}%`, {
                        description: hits.length > 0
                          ? `Atenção: ${hits.length} termo(s) de leilão detectado(s). Use "Reescrever com qualidade".`
                          : score.score >= 70
                            ? 'Sua bio do perfil está boa o suficiente para um anúncio de alta performance.'
                            : 'Sua bio precisa de ajustes para virar um anúncio de alta performance.',
                        duration: 5000,
                      });
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/5 hover:bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-colors"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Importar dados do meu perfil (Bio + Foto)
                  </button>
                )}

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
                    className={`w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground resize-none focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none ${formErrors.description ? 'border-destructive' : 'border-input'}`}
                  />
                  {/* Linter anti-leilão: sugestão + botão "Reescrever com qualidade" */}
                  {(() => {
                    const hits = lintServiceDescription(form.description);
                    if (hits.length === 0) return null;
                    return (
                      <div className="mt-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-2 space-y-1.5">
                        <p className="text-[11px] text-destructive font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {hits.length === 1
                            ? `Termo "${hits[0].term}" desvaloriza seu serviço.`
                            : `${hits.length} termos de leilão detectados (${hits.map(h => `"${h.term}"`).join(', ')}).`}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const next = rewriteWithQuality(form.description);
                              setForm(prev => ({ ...prev, description: next }));
                              setFormErrors(prev => ({ ...prev, description: '' }));
                              toast.success('Descrição reescrita com qualidade técnica!', {
                                description: `${hits.length} termo(s) substituído(s) por linguagem profissional.`,
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 text-[11px] font-semibold transition-colors"
                          >
                            <Sparkles className="h-3 w-3" />
                            Reescrever com qualidade
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const hit = hits[0];
                              const replaced = form.description.replace(new RegExp(`\\b${hit.term}\\b`, 'i'), '');
                              const next = `${replaced.trim()} ${hit.suggestion}`.trim();
                              setForm(prev => ({ ...prev, description: next }));
                              setFormErrors(prev => ({ ...prev, description: '' }));
                            }}
                            className="text-[11px] font-semibold text-accent hover:underline"
                          >
                            Aplicar só "{hits[0].term}"
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  {formErrors.description && <p className="text-xs text-destructive mt-1">{formErrors.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Preço (a partir de R$)</label>
                    <input
                      name="price"
                      value={form.price}
                      onChange={handleChange}
                      inputMode="decimal"
                      placeholder="A partir de R$ 150,00"
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
              {/* Passo de permissão de localização (GPS → IP fallback → manual) */}
              {!form.service_area && (
                <GeoPermissionStep
                  catalog={ALL_CITIES}
                  onConfirm={(city, state) => {
                    const match = ALL_CITIES.find(
                      c => c.value.toLowerCase() === city.toLowerCase()
                        && (!state || c.state === state)
                    );
                    if (match) { selectCity(match); setGeoDetected(true); }
                  }}
                  onSkipToManual={() => {
                    // foca o input de cidade
                    setTimeout(() => {
                      const el = cityRef.current?.querySelector('input') as HTMLInputElement | null;
                      el?.focus();
                    }, 50);
                  }}
                />
              )}
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
                      onPaste={(e) => {
                        e.preventDefault();
                        const pasted = e.clipboardData.getData('text');
                        const sanitized = sanitizePastedCity(pasted);
                        setCitySearch(sanitized);
                        setShowCityDropdown(true);
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
                  {/* Chip de geo-confirmação 1-clique */}
                  {!form.service_area && geo.city && (
                    <button
                      type="button"
                      onClick={() => {
                        const match = ALL_CITIES.find(
                          c => c.value.toLowerCase() === (geo.city || '').toLowerCase()
                            && (!geo.state || c.state === geo.state)
                        );
                        if (match) {
                          selectCity(match);
                          setGeoDetected(true);
                        }
                      }}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent/20 transition"
                    >
                      <MapPin className="h-3 w-3" />
                      Vimos que você está em {geo.city}{geo.state ? `/${geo.state}` : ''}. Confirmar?
                    </button>
                  )}
                  {geoDetected && form.service_area && (
                    <p className="text-[11px] text-accent mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" />Localização confirmada</p>
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

                {/* Sugestão 1-clique para expandir o raio para a Região Metropolitana */}
                <MetroExpandSuggestion
                  selectedCity={form.service_area}
                  serviceRadius={serviceRadius}
                  onExpandToMetro={() => {
                    setServiceRadius('metro');
                    setMetroBonus(true);
                    const members = getMetroMembers(form.service_area);
                    toast.success(`Alcance expandido para toda a região metropolitana (+${Math.max(1, members.length - 1)} cidades)`, { duration: 4000 });
                  }}
                />

                {/* Bônus visual: Alcance Expandido (RM) */}
                {metroBonus && serviceRadius === 'metro' && (
                  <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-700 p-2 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                      <strong>Alcance Expandido</strong> — seu anúncio aparecerá em buscas de até{' '}
                      <strong>{Math.max(1, getMetroMembers(form.service_area).length)} cidades</strong> da RM.
                    </p>
                  </div>
                )}
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
                  {(() => {
                    const candidate = form.whatsapp || provider?.whatsapp || '';
                    if (!candidate.trim()) return null;
                    const v = validateWhatsapp(candidate);
                    if (v.valid) {
                      return (
                        <p className="mt-1 text-[11px] text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Número válido — leads cairão direto no seu WhatsApp.
                        </p>
                      );
                    }
                    return (
                      <p className="mt-1 text-[11px] text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Formato inválido para link direto. Use DDD + 9 dígitos (ex.: 61999999999).
                      </p>
                    );
                  })()}
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

                {/* Score "Anúncio Padrão Ouro" — barra 0-100% */}
                <AdQualityScore
                  description={form.description}
                  hasOriginalPhoto={!!newServicePhoto || (!!editId && !!serviceImages[editId])}
                  cityValidated={isCatalogedCity(stripLegacyAreaPrefixes(form.service_area), ALL_CITIES)}
                  categorySlugs={selectedCategoryIds.map((id) => categories.find((c: any) => c.id === id)?.slug).filter(Boolean) as string[]}
                />

                {/* Disclaimer fixo de não-intermediação */}
                <WizardLegalDisclaimer />

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

            {/* ── Section 4: Revisão Final (Clean) ── */}
            {formStep === 4 && (() => {
              const cleanedArea = stripLegacyAreaPrefixes(form.service_area);
              const cityValidated = isCatalogedCity(cleanedArea, ALL_CITIES);
              const radiusLabel =
                serviceRadius === 'local' ? 'Atendimento no local' :
                serviceRadius === 'metro' ? 'Região Metropolitana' :
                'Toda a cidade';
              const divergence = serviceRadius === 'city' && provider?.city && cleanedArea && cleanedArea.toLowerCase() !== provider.city.toLowerCase();
              const score = computeAdScore({
                description: form.description,
                hasOriginalPhoto: !!newServicePhoto || (!!editId && !!serviceImages[editId]),
                cityValidated,
                hasPrice: !!form.price?.trim(),
                hasCategory: selectedCategoryIds.length > 0,
              });
              return (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Revisão Final
                  </h3>
                  <div className="rounded-lg border border-border bg-card p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Título</p>
                        <p className="font-medium text-foreground truncate">{form.service_name || '—'}</p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Categoria</p>
                        <p className="font-medium text-foreground truncate">
                          {categories.find((c: any) => selectedCategoryIds.includes(c.id))?.name || '—'}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Cidade</p>
                        <p className="font-medium text-foreground truncate flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-accent" />
                          {cleanedArea || '—'}
                          {cityValidated && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Service area</p>
                        <p className="font-medium text-foreground truncate">
                          {formatServiceArea(cleanedArea, serviceRadius, provider?.city)}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Raio</p>
                        <p className="font-medium text-foreground truncate">{radiusLabel}</p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Cidade do perfil</p>
                        <p className="font-medium text-foreground truncate">{provider?.city || '—'}</p>
                      </div>
                    </div>

                    {/* Kill-switch: divergência city ↔ service_area com radius=city */}
                    {divergence && (
                      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <div className="flex-1 text-xs text-foreground space-y-1">
                          <p className="font-semibold text-destructive">Divergência detectada</p>
                          <p>
                            Você selecionou raio <strong>"Toda a cidade"</strong>, mas a cidade do serviço (<strong>{cleanedArea}</strong>) não coincide com a do seu perfil (<strong>{provider?.city}</strong>).
                          </p>
                          <p className="text-muted-foreground">Volte à etapa 2 para ajustar — não é possível publicar com essa inconsistência.</p>
                        </div>
                      </div>
                    )}

                    {/* Recompensa: Padrão Ouro */}
                    {score.isPadrãoOuro && (
                      <div className="rounded-lg border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 p-3 flex items-center gap-2">
                        <Award className="h-5 w-5 text-amber-500" />
                        <div className="flex-1 text-xs">
                          <p className="font-bold text-amber-700 dark:text-amber-300">Anúncio Padrão Ouro!</p>
                          <p className="text-muted-foreground">+25 pontos extras de engajamento ao publicar.</p>
                        </div>
                      </div>
                    )}

                    {/* Score breakdown final */}
                    <AdQualityScore
                      description={form.description}
                      hasOriginalPhoto={!!newServicePhoto || (!!editId && !!serviceImages[editId])}
                      cityValidated={cityValidated}
                      categorySlugs={selectedCategoryIds.map((id) => categories.find((c: any) => c.id === id)?.slug).filter(Boolean) as string[]}
                    />

                    {/* Checklist dinâmico do Padrão Ouro */}
                    <GoldChecklist
                      description={form.description}
                      hasOriginalPhoto={!!newServicePhoto || (!!editId && !!serviceImages[editId])}
                      cityValidated={cityValidated}
                      categorySlugs={selectedCategoryIds.map((id) => categories.find((c: any) => c.id === id)?.slug).filter(Boolean) as string[]}
                    />

                    {/* Disclaimer final + checkbox de responsabilidade direta */}
                    {!editId && (
                      <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 cursor-pointer">
                        <Checkbox
                          checked={finalConsent}
                          onCheckedChange={(v) => setFinalConsent(v === true)}
                          className="mt-0.5"
                        />
                        <span className="text-[12px] text-foreground leading-relaxed">
                          Entendo que a plataforma é apenas uma <strong>vitrine tecnológica</strong> e que sou o
                          <strong> único responsável pelo atendimento e garantia</strong> deste serviço. Os leads
                          chegam direto no meu WhatsApp/telefone, sem intermediação de pagamento.
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              );
            })()}

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
                  if (formStep > 1) setFormStep((formStep - 1) as 1 | 2 | 3 | 4);
                  else { resetForm(); setShowDialog(false); }
                }}>
                  {formStep > 1 ? '← Voltar' : 'Cancelar'}
                </Button>
                {formStep < 4 ? (
                  <Button variant="accent" className="flex-1 h-11 font-semibold" onClick={() => {
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
                    if (formStep === 3) {
                      // Bloqueia avanço se existirem termos proibidos pendentes
                      const hits = lintServiceDescription(form.description);
                      if (hits.length > 0) {
                        toast.error('Termos de leilão detectados', {
                          description: 'Use "Reescrever com qualidade" antes de avançar para a revisão.',
                        });
                        return;
                      }
                    }
                    setFormErrors({});
                    setFormStep((formStep + 1) as 1 | 2 | 3 | 4);
                  }}>
                    {formStep === 3 ? 'Revisar →' : 'Avançar →'}
                  </Button>
                ) : (() => {
                  const cleanedArea = stripLegacyAreaPrefixes(form.service_area);
                  const divergence = serviceRadius === 'city' && provider?.city && cleanedArea && cleanedArea.toLowerCase() !== provider.city.toLowerCase();
                  return (
                    <Button
                      variant="accent"
                      className="flex-1 h-11 font-semibold"
                      onClick={() => {
                        if (divergence) {
                          toast.error('Resolva a divergência cidade × raio antes de publicar.');
                          return;
                        }
                        handleSave();
                      }}
                      disabled={isSubmitting || !!divergence || (!editId && !finalConsent)}
                      title={
                        divergence
                          ? 'Divergência entre cidade do serviço e raio "Toda a cidade"'
                          : (!editId && !finalConsent)
                            ? 'Confirme o termo de responsabilidade para publicar'
                            : ''
                      }
                    >
                      {isSubmitting ? '⏳ Salvando...' : `📢 ${editId ? 'Salvar' : 'Publicar'}`}
                    </Button>
                  );
                })()}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
      )}

      <NextStepPrompt
        open={showNextStepPrompt}
        onClose={() => setShowNextStepPrompt(false)}
        context="service"
        providerSlug={provider?.slug ?? null}
      />

      {/* Kill-Switch: modal de conscientização quando score<50% ou >3 termos de leilão */}
      {/* Kill-Switch: lazy modal de conscientização quando score<50% ou >3 termos de leilão */}
      {blockModal.open && (
        <Suspense fallback={null}>
          <QualityBlockModal
            state={blockModal}
            onOpenChange={(o) => setBlockModal((s) => ({ ...s, open: o }))}
            onAcknowledge={() => setBlockModal({ open: false, score: 0, hits: 0, reasons: [] })}
          />
        </Suspense>
      )}
    </DashboardLayout>
  );
};

export default DashboardServicesPage;
