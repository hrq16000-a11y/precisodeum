import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CategoryIcon from '@/components/CategoryIcon';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { trackAction } from '@/lib/errorReporter';
import { showSaveError } from '@/components/SaveErrorToast';
import AvatarUpload from '@/components/AvatarUpload';
import PhoneMaskedInput from '@/components/PhoneMaskedInput';
import ProfileTypeSwitcher from '@/components/ProfileTypeSwitcher';
import { sanitizePhone, isValidWhatsApp, autoFillWhatsApp, toCanonical } from '@/lib/whatsapp';
import { generateProviderSlug } from '@/lib/slugify';
import { fetchAllMunicipalities, geocodeCity, reverseGeocode, normalize, type CityResult } from '@/lib/geoUtils';
import { useQuery } from '@tanstack/react-query';
import { Search, LocateFixed, Loader2, MapPin, CheckCircle2, User, Briefcase, Globe, HelpCircle, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const DashboardProfilePage = () => {
  const { user, profile, provider, loading, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('pessoal');

  // City selector state
  const [citySearch, setCitySearch] = useState('');
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [allCities, setAllCities] = useState<CityResult[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  // Category selector state
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);

  const [form, setForm] = useState({
    full_name: '', phone: '', business_name: '', description: '',
    city: '', state: '', neighborhood: '', whatsapp: '', website: '',
    years_experience: 0, category_id: '', category_name: '', category_custom: '',
    cnpj: '', ibge_code: '',
    latitude: null as number | null, longitude: null as number | null,
    account_kind: '' as '' | 'autonomo' | 'empresa',
  });

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  // Load categories
  const { data: categories = [] } = useQuery({
    queryKey: ['profile-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id, name, icon, parent_id').is('deleted_at', null).order('name');
      return data || [];
    },
  });

  const macroCategories = useMemo(() => categories.filter((c: any) => !c.parent_id), [categories]);
  const subsByParent = useMemo(() => {
    const map: Record<string, any[]> = {};
    categories.forEach((c: any) => { if (c.parent_id) (map[c.parent_id] ??= []).push(c); });
    return map;
  }, [categories]);

  const filteredCategoryTree = useMemo(() => {
    if (!categorySearch.trim()) {
      return macroCategories.map((m: any) => ({ macro: m, subs: subsByParent[m.id] || [] }));
    }
    const q = normalize(categorySearch);
    const results: { macro: any; subs: any[] }[] = [];
    for (const macro of macroCategories) {
      const macroName = normalize(macro.name);
      const subs = (subsByParent[macro.id] || []).filter((s: any) => normalize(s.name).includes(q));
      if (macroName.includes(q) || subs.length > 0) {
        results.push({ macro, subs: macroName.includes(q) ? subsByParent[macro.id] || [] : subs });
      }
    }
    return results;
  }, [categorySearch, macroCategories, subsByParent]);

  // City filtering
  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return allCities.slice(0, 10);
    const q = normalize(citySearch);
    const terms = q.split(/\s+/).filter(Boolean);
    return allCities
      .filter((c) => {
        const cityNorm = normalize(c.name);
        const stateNorm = normalize(c.state);
        return terms.every((t) => cityNorm.includes(t) || stateNorm.includes(t));
      })
      .slice(0, 10);
  }, [citySearch, allCities]);

  const loadCities = useCallback(() => {
    if (allCities.length > 0) return;
    setCitiesLoading(true);
    fetchAllMunicipalities().then((cities) => {
      setAllCities(cities);
      setCitiesLoading(false);
    });
  }, [allCities.length]);

  // Pre-populate form from profile/provider
  useEffect(() => {
    if (profile) {
      setForm(prev => ({ ...prev, full_name: profile.full_name || '', phone: profile.phone || '' }));
    }
    if (provider) {
      const catName = categories.find((c: any) => c.id === provider.category_id)?.name || '';
      const inferredKind: '' | 'autonomo' | 'empresa' =
        (provider as any).cnpj ? 'empresa' :
        ((provider as any).account_kind === 'empresa' || (provider as any).account_kind === 'autonomo') ? (provider as any).account_kind :
        provider.business_name ? 'empresa' : '';
      setForm(prev => ({
        ...prev,
        business_name: provider.business_name || '',
        description: provider.description || '',
        city: provider.city || '',
        state: provider.state || '',
        neighborhood: provider.neighborhood || '',
        whatsapp: provider.whatsapp || '',
        website: provider.website || '',
        years_experience: provider.years_experience || 0,
        category_id: provider.category_id || '',
        category_name: catName,
        category_custom: (provider as any).category_custom || '',
        cnpj: (provider as any).cnpj || '',
        ibge_code: (provider as any).ibge_code || '',
        latitude: provider.latitude ?? null,
        longitude: provider.longitude ?? null,
        account_kind: inferredKind,
      }));
      if (provider.city) {
        setCitySearch(provider.state ? `${provider.city}, ${provider.state}` : provider.city);
      }
      if (catName) setCategorySearch(catName);
      else if ((provider as any).category_custom) setCategorySearch((provider as any).category_custom);
    }
  }, [profile, provider, categories]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'years_experience' ? Number(value) : value }));
  };

  const handlePhoneChange = (name: string, rawValue: string) => {
    setForm(prev => ({ ...prev, [name]: rawValue }));
  };

  const handleCategorySelect = (cat: any) => {
    setForm(prev => ({ ...prev, category_id: cat.id, category_name: cat.name, category_custom: '' }));
    setCategorySearch(cat.name);
    setShowCategorySuggestions(false);
  };

  const handleCitySelect = async (c: CityResult) => {
    setForm(prev => ({ ...prev, city: c.name, state: c.state, ibge_code: c.ibgeCode }));
    setCitySearch(`${c.name}, ${c.state}`);
    setShowCitySuggestions(false);
    const { latitude, longitude } = await geocodeCity(c.name, c.state);
    setForm(prev => ({ ...prev, latitude, longitude }));
  };

  const handleAutoLocate = async () => {
    setLocating(true);
    loadCities();
    try {
      if (!navigator?.geolocation) { setLocating(false); return; }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const { city: detectedCity, state: detectedState } = await reverseGeocode(lat, lon);
          if (detectedCity) {
            const cities = await fetchAllMunicipalities();
            const normalizedDetected = normalize(detectedCity);
            const match = cities.find(c => normalize(c.name) === normalizedDetected && (
              !detectedState || normalize(c.state) === normalize(detectedState) ||
              detectedState.toLowerCase().includes(c.state.toLowerCase())
            ));
            if (match) {
              setForm(prev => ({ ...prev, city: match.name, state: match.state, ibge_code: match.ibgeCode, latitude: lat, longitude: lon }));
              setCitySearch(`${match.name}, ${match.state}`);
            } else {
              setForm(prev => ({ ...prev, city: detectedCity, state: detectedState, ibge_code: '', latitude: lat, longitude: lon }));
              setCitySearch(`${detectedCity}, ${detectedState}`);
            }
          }
          setLocating(false);
        },
        () => { setLocating(false); toast.error('Não foi possível detectar sua localização'); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
      );
    } catch { setLocating(false); }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.full_name.trim()) { toast.error('Nome completo é obrigatório'); return; }
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) { toast.error('Telefone deve ter pelo menos 10 dígitos'); return; }
    if (!form.city.trim() || !form.state.trim()) { toast.error('Selecione sua cidade na lista'); return; }
    if (!form.category_id && !form.category_custom) { toast.error('Selecione uma categoria ou digite "Outro"'); return; }
    const finalWhatsapp = autoFillWhatsApp(form.whatsapp, form.phone);
    if (finalWhatsapp && !isValidWhatsApp(finalWhatsapp)) { toast.error('Número de WhatsApp inválido (deve ter 10 ou 11 dígitos)'); return; }
    const finalPhone = toCanonical(form.phone);
    if (form.phone.trim() && !finalPhone) { toast.error('Número de telefone inválido (deve ter 10 ou 11 dígitos)'); return; }
    const cnpjDigits = form.cnpj.replace(/\D/g, '');
    if (cnpjDigits && cnpjDigits.length !== 14) { toast.error('CNPJ deve ter 14 dígitos'); return; }

    setSaving(true);
    let { latitude, longitude } = form;
    if (form.city && (latitude == null || longitude == null)) {
      try { const coords = await geocodeCity(form.city, form.state); latitude = coords.latitude; longitude = coords.longitude; } catch {}
    }

    try {
      trackAction('profile_save_start', 'Salvando dados do perfil');
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: form.full_name, phone: form.phone, email: user.email || '',
      }).eq('id', user.id);
      if (profileError) {
        await showSaveError({ actionContext: 'Salvar perfil pessoal', componentName: 'DashboardProfilePage', errorMessage: profileError.message, retryFn: handleSave });
        setSaving(false); return;
      }

      const isAutonomo = form.account_kind === 'autonomo';
      const finalCnpj = isAutonomo ? null : (cnpjDigits || null);
      const finalBusinessName = isAutonomo ? null : (form.business_name || null);

      const providerPayload = {
        business_name: finalBusinessName, description: form.description,
        city: form.city, state: form.state, neighborhood: form.neighborhood,
        whatsapp: finalWhatsapp, website: form.website || null, years_experience: form.years_experience,
        category_id: form.category_id || null, category_custom: form.category_custom || null,
        cnpj: finalCnpj, ibge_code: form.ibge_code || null, latitude, longitude,
      };

      if (provider) {
        const { error } = await supabase.from('providers').update(providerPayload as any).eq('id', provider.id);
        if (error) {
          await showSaveError({ actionContext: 'Salvar dados profissionais', componentName: 'DashboardProfilePage', errorMessage: error.message, retryFn: handleSave });
          setSaving(false); return;
        }
      } else {
        const { data: existing } = await supabase.from('providers').select('id').eq('user_id', user.id).limit(1);
        if (existing && existing.length > 0) {
          const { error } = await supabase.from('providers').update({ ...providerPayload, phone: finalPhone } as any).eq('id', existing[0].id);
          if (error) {
            await showSaveError({ actionContext: 'Atualizar provedor existente', componentName: 'DashboardProfilePage', errorMessage: error.message, retryFn: handleSave });
            setSaving(false); return;
          }
        } else {
          const slug = generateProviderSlug(form.full_name, form.city);
          const { error } = await supabase.from('providers').insert({ ...providerPayload, user_id: user.id, phone: finalPhone, slug, status: 'pending' } as any);
          if (error) {
            await showSaveError({ actionContext: 'Criar perfil profissional', componentName: 'DashboardProfilePage', errorMessage: error.message, retryFn: handleSave });
            setSaving(false); return;
          }
        }
      }
      await refetchProfile();
      trackAction('profile_save_success', 'Perfil salvo com sucesso');
      toast.success('Perfil salvo com sucesso!');
    } catch (err: any) {
      await showSaveError({
        actionContext: 'Salvar perfil (erro inesperado)',
        componentName: 'DashboardProfilePage',
        errorMessage: err.message || 'Erro desconhecido',
        errorStack: err.stack,
        retryFn: handleSave,
      });
    } finally { setSaving(false); }
  };

  const initials = form.full_name.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  useEffect(() => { if (profile?.avatar_url) setAvatarUrl(profile.avatar_url); }, [profile]);

  // Profile completeness
  const completeness = useMemo(() => {
    const fields = [
      !!form.full_name.trim(),
      !!form.phone.trim(),
      !!avatarUrl,
      !!form.city.trim(),
      !!(form.category_id || form.category_custom),
      !!form.description.trim(),
      !!form.whatsapp.trim(),
      !!form.business_name?.trim(),
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [form, avatarUrl]);

  const displayName = form.full_name || 'Usuário';

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all';
  const labelCls = 'mb-1.5 block text-sm font-medium text-foreground';

  return (
    <DashboardLayout>
      <motion.div initial="hidden" animate="visible" variants={fadeIn} className="max-w-3xl">
        {/* Header with help link */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Meu Perfil</h1>
            <p className="mt-1 text-sm text-muted-foreground">Edite suas informações profissionais</p>
          </div>
          <Link to="/ajuda" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-accent hover:border-accent/30 transition-colors">
            <HelpCircle className="h-3.5 w-3.5" /> Precisa de ajuda?
          </Link>
        </div>

        {/* Progress bar */}
        <motion.div
          className="mt-5 rounded-xl border border-border bg-card p-4 shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">Completude do perfil</span>
            <span className={`text-xs font-bold ${completeness === 100 ? 'text-emerald-500' : 'text-accent'}`}>{completeness}%</span>
          </div>
          <Progress value={completeness} className="h-2" />
          {completeness < 100 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Complete seu perfil para ter mais visibilidade e atrair mais clientes.
            </p>
          )}
        </motion.div>

        {/* Avatar + Preview */}
        <motion.div
          className="mt-5 rounded-xl border border-border bg-card p-5 shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center gap-5">
            <AvatarUpload userId={user!.id} currentUrl={avatarUrl} initials={initials} onUploaded={setAvatarUrl} />
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-lg font-bold text-foreground truncate">{displayName}</h2>
              <p className="text-xs text-muted-foreground">
                {form.category_name || form.category_custom || 'Profissional'} {form.city && `• ${form.city}`}
              </p>
              {provider?.slug && (
                <Link
                  to={`/profissional/${provider.slug}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  <Eye className="h-3 w-3" /> Ver perfil público
                </Link>
              )}
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          className="mt-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-11">
              <TabsTrigger value="pessoal" className="gap-1.5 text-xs sm:text-sm">
                <User className="h-3.5 w-3.5" /> Pessoal
              </TabsTrigger>
              <TabsTrigger value="profissional" className="gap-1.5 text-xs sm:text-sm">
                <Briefcase className="h-3.5 w-3.5" /> Profissional
              </TabsTrigger>
              <TabsTrigger value="localizacao" className="gap-1.5 text-xs sm:text-sm">
                <MapPin className="h-3.5 w-3.5" /> Localização
              </TabsTrigger>
            </TabsList>

            {/* Tab: Pessoal */}
            <TabsContent value="pessoal">
              <motion.div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4" variants={fadeIn} initial="hidden" animate="visible">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Nome completo *</label>
                    <input name="full_name" value={form.full_name} onChange={handleChange} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Telefone *</label>
                    <PhoneMaskedInput name="phone" value={form.phone} onChange={handlePhoneChange} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>WhatsApp</label>
                    <PhoneMaskedInput name="whatsapp" value={form.whatsapp} onChange={handlePhoneChange} className={inputCls} />
                    {!form.whatsapp && form.phone && (
                      <button type="button" onClick={() => setForm(prev => ({ ...prev, whatsapp: prev.phone }))} className="mt-1 text-xs text-accent hover:underline">
                        Copiar do telefone
                      </button>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Website</label>
                    <input name="website" value={form.website} onChange={handleChange} placeholder="https://" className={inputCls} />
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* Tab: Profissional */}
            <TabsContent value="profissional">
              <motion.div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4" variants={fadeIn} initial="hidden" animate="visible">
                {/* Pergunta inicial: Autônomo ou Empresa? */}
                <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <HelpCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Você atua como Profissional Autônomo ou Empresa?</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Isso ajuda a personalizar seu perfil e os campos exibidos.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, account_kind: 'autonomo', cnpj: '', business_name: '' }))}
                      className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left transition-all ${
                        form.account_kind === 'autonomo'
                          ? 'border-accent bg-accent/15 shadow-sm'
                          : 'border-border bg-card hover:border-accent/50'
                      }`}
                    >
                      <User className={`h-4 w-4 shrink-0 ${form.account_kind === 'autonomo' ? 'text-accent' : 'text-muted-foreground'}`} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Autônomo</p>
                        <p className="text-[10px] text-muted-foreground">Profissional individual (sem CNPJ)</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, account_kind: 'empresa' }))}
                      className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left transition-all ${
                        form.account_kind === 'empresa'
                          ? 'border-accent bg-accent/15 shadow-sm'
                          : 'border-border bg-card hover:border-accent/50'
                      }`}
                    >
                      <Briefcase className={`h-4 w-4 shrink-0 ${form.account_kind === 'empresa' ? 'text-accent' : 'text-muted-foreground'}`} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Empresa / Agência</p>
                        <p className="text-[10px] text-muted-foreground">Possui CNPJ e nome fantasia</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {form.account_kind === 'empresa' && (
                    <div>
                      <label className={labelCls}>Nome do negócio</label>
                      <input name="business_name" value={form.business_name} onChange={handleChange} className={inputCls} />
                    </div>
                  )}

                  {/* Hierarchical category picker */}
                  <div className="relative">
                    <label className={labelCls}>Categoria principal *</label>
                    {(form.category_name || form.category_custom) && (
                      <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
                        {form.category_name || form.category_custom}
                        <button type="button" onClick={() => {
                          setForm(prev => ({ ...prev, category_id: '', category_name: '', category_custom: '' }));
                          setCategorySearch('');
                        }} className="ml-0.5 hover:text-destructive">✕</button>
                      </div>
                    )}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <input
                        type="text" value={categorySearch}
                        onChange={(e) => { setCategorySearch(e.target.value); setShowCategorySuggestions(true); if (!e.target.value) setForm(prev => ({ ...prev, category_id: '', category_name: '', category_custom: '' })); }}
                        onFocus={() => setShowCategorySuggestions(true)}
                        placeholder="Digite para buscar..."
                        className={`${inputCls} pl-9`}
                      />
                    </div>
                    {showCategorySuggestions && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-56 overflow-y-auto">
                        {filteredCategoryTree.length > 0 ? (
                          filteredCategoryTree.map(({ macro, subs }) => (
                            <div key={macro.id}>
                              {subs.length > 0 ? (
                                <>
                                  <div className="sticky top-0 bg-muted/60 backdrop-blur-sm px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                     <CategoryIcon icon={macro.icon} size={12} className="text-muted-foreground" /> {macro.name}
                                  </div>
                                  {subs.map((sub: any) => (
                                    <button key={sub.id} type="button" onClick={() => handleCategorySelect(sub)}
                                      className={`w-full pl-6 pr-3 py-2 text-left text-sm hover:bg-muted transition-colors ${form.category_id === sub.id ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'}`}>
                                      <CategoryIcon icon={sub.icon} size={12} className="text-current" /> {sub.name}
                                    </button>
                                  ))}
                                </>
                              ) : (
                                <button type="button" onClick={() => handleCategorySelect(macro)}
                                  className={`w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors ${form.category_id === macro.id ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'}`}>
                                  <CategoryIcon icon={macro.icon} size={14} className="text-current" /> {macro.name}
                                </button>
                              )}
                            </div>
                          ))
                        ) : categorySearch.trim() ? (
                          <div className="px-3 py-3 text-center text-xs text-muted-foreground">Nenhuma categoria encontrada</div>
                        ) : null}
                        <button type="button" onClick={() => {
                          const customVal = categorySearch.trim() || 'Outro';
                          setForm(prev => ({ ...prev, category_id: '', category_name: '', category_custom: customVal }));
                          setCategorySearch(customVal);
                          setShowCategorySuggestions(false);
                        }} className="w-full border-t border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted transition-colors">
                          Outro {categorySearch.trim() ? `("${categorySearch.trim()}")` : ''}
                        </button>
                      </div>
                    )}
                    {showCategorySuggestions && (
                      <div className="fixed inset-0 z-10" onClick={() => setShowCategorySuggestions(false)} />
                    )}
                  </div>

                  {form.account_kind === 'empresa' && (
                    <div>
                      <label className={labelCls}>CNPJ <span className="text-muted-foreground font-normal">(opcional)</span></label>
                      <input type="text" value={form.cnpj} onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, '').slice(0, 14);
                        if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
                        else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');
                        else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
                        else if (v.length > 2) v = v.replace(/^(\d{2})(\d{1,3})/, '$1.$2');
                        setForm(prev => ({ ...prev, cnpj: v }));
                      }} placeholder="00.000.000/0000-00" className={inputCls} />
                    </div>
                  )}

                  <div>
                    <label className={labelCls}>Anos de experiência</label>
                    <input name="years_experience" type="number" value={form.years_experience} onChange={handleChange} className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Descrição profissional</label>
                  <textarea name="description" rows={4} value={form.description} onChange={handleChange} className={`${inputCls} resize-none`} />
                </div>
              </motion.div>
            </TabsContent>

            {/* Tab: Localização */}
            <TabsContent value="localizacao">
              <motion.div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4" variants={fadeIn} initial="hidden" animate="visible">
                <div>
                  <label className={labelCls}>Cidade *</label>
                  <button type="button" onClick={handleAutoLocate} disabled={locating}
                    className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50">
                    {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
                    {locating ? 'Detectando...' : '📍 Usar minha localização'}
                  </button>
                  <div className="relative" ref={cityDropdownRef}>
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input type="text" value={citySearch}
                      onChange={(e) => { setCitySearch(e.target.value); setShowCitySuggestions(true); loadCities(); setForm(prev => ({ ...prev, city: '', state: '', latitude: null, longitude: null })); }}
                      onFocus={() => { setShowCitySuggestions(true); loadCities(); }}
                      placeholder="Digite sua cidade..."
                      className={`${inputCls} pl-9`}
                    />
                    {showCitySuggestions && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
                        {citiesLoading && (
                          <div className="flex items-center justify-center gap-2 px-3 py-3">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Carregando municípios...</span>
                          </div>
                        )}
                        {!citiesLoading && filteredCities.length === 0 && citySearch.trim() && (
                          <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma cidade encontrada</p>
                        )}
                        {!citiesLoading && filteredCities.map((c, i) => (
                          <button key={`${c.name}-${c.state}-${i}`} type="button" onClick={() => handleCitySelect(c)}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors ${form.city === c.name && form.state === c.state ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'}`}>
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate">{c.name}</span>
                            <span className="text-xs text-muted-foreground">{c.state}</span>
                            {form.city === c.name && form.state === c.state && <CheckCircle2 className="h-3.5 w-3.5 text-accent" />}
                          </button>
                        ))}
                      </div>
                    )}
                    {showCitySuggestions && (
                      <div className="fixed inset-0 z-10" onClick={() => setShowCitySuggestions(false)} />
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Estado</label>
                    <input type="text" value={form.state} readOnly placeholder="Auto-preenchido"
                      className={`${inputCls} bg-muted/50 cursor-not-allowed uppercase`} />
                  </div>
                  <div>
                    <label className={labelCls}>Bairro</label>
                    <input name="neighborhood" value={form.neighborhood} onChange={handleChange} className={inputCls} />
                  </div>
                </div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Account type switcher */}
        <div className="mt-5">
          <ProfileTypeSwitcher />
        </div>

        {/* Save button */}
        <motion.div
          className="mt-5 flex gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Button variant="accent" onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none sm:min-w-[180px]">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar Perfil'}
          </Button>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
};

export default DashboardProfilePage;
