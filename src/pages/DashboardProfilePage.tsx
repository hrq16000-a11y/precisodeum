import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AvatarUpload from '@/components/AvatarUpload';
import PhoneMaskedInput from '@/components/PhoneMaskedInput';
import ProfileTypeSwitcher from '@/components/ProfileTypeSwitcher';
import { sanitizePhone, isValidWhatsApp, autoFillWhatsApp, toCanonical } from '@/lib/whatsapp';
import { generateProviderSlug } from '@/lib/slugify';
import { fetchAllMunicipalities, geocodeCity, reverseGeocode, normalize, type CityResult } from '@/lib/geoUtils';
import { useQuery } from '@tanstack/react-query';
import { Search, LocateFixed, Loader2, MapPin, CheckCircle2 } from 'lucide-react';

const DashboardProfilePage = () => {
  const { user, profile, provider, loading, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

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
      }));
      // Set city search display
      if (provider.city) {
        setCitySearch(provider.state ? `${provider.city}, ${provider.state}` : provider.city);
      }
      // Set category search display
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

    // Validate required fields
    if (!form.full_name.trim()) {
      toast.error('Nome completo é obrigatório');
      return;
    }

    // Phone validation: min 10 digits
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Telefone deve ter pelo menos 10 dígitos');
      return;
    }

    // City/state must be selected
    if (!form.city.trim() || !form.state.trim()) {
      toast.error('Selecione sua cidade na lista');
      return;
    }

    // Category required: category_id OR category_custom
    if (!form.category_id && !form.category_custom) {
      toast.error('Selecione uma categoria ou digite "Outro"');
      return;
    }

    // WhatsApp validation
    const finalWhatsapp = autoFillWhatsApp(form.whatsapp, form.phone);
    if (finalWhatsapp && !isValidWhatsApp(finalWhatsapp)) {
      toast.error('Número de WhatsApp inválido (deve ter 10 ou 11 dígitos)');
      return;
    }
    const finalPhone = toCanonical(form.phone);
    if (form.phone.trim() && !finalPhone) {
      toast.error('Número de telefone inválido (deve ter 10 ou 11 dígitos)');
      return;
    }

    // CNPJ validation
    const cnpjDigits = form.cnpj.replace(/\D/g, '');
    if (cnpjDigits && cnpjDigits.length !== 14) {
      toast.error('CNPJ deve ter 14 dígitos');
      return;
    }

    setSaving(true);

    // Geocode fallback
    let { latitude, longitude } = form;
    if (form.city && (latitude == null || longitude == null)) {
      try {
        const coords = await geocodeCity(form.city, form.state);
        latitude = coords.latitude;
        longitude = coords.longitude;
      } catch { /* proceed without coords */ }
    }

    try {
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: form.full_name,
        phone: form.phone,
        email: user.email || '',
      }).eq('id', user.id);

      if (profileError) {
        toast.error('Erro ao salvar perfil: ' + profileError.message);
        setSaving(false);
        return;
      }

      const providerPayload = {
        business_name: form.business_name || null,
        description: form.description,
        city: form.city,
        state: form.state,
        neighborhood: form.neighborhood,
        whatsapp: finalWhatsapp,
        website: form.website || null,
        years_experience: form.years_experience,
        category_id: form.category_id || null,
        category_custom: form.category_custom || null,
        cnpj: cnpjDigits || null,
        ibge_code: form.ibge_code || null,
        latitude,
        longitude,
      };

      if (provider) {
        const { error: providerError } = await supabase.from('providers').update(providerPayload as any).eq('id', provider.id);
        if (providerError) {
          toast.error('Erro ao salvar dados profissionais: ' + providerError.message);
          setSaving(false);
          return;
        }
      } else {
        const { data: existingProviders } = await supabase
          .from('providers').select('id').eq('user_id', user.id).limit(1);

        if (existingProviders && existingProviders.length > 0) {
          const { error: updateError } = await supabase.from('providers').update({
            ...providerPayload, phone: finalPhone,
          } as any).eq('id', existingProviders[0].id);
          if (updateError) {
            toast.error('Erro ao atualizar perfil profissional: ' + updateError.message);
            setSaving(false);
            return;
          }
        } else {
          const slug = generateProviderSlug(form.full_name, form.city);
          const { error: insertError } = await supabase.from('providers').insert({
            ...providerPayload, user_id: user.id, phone: finalPhone, slug, status: 'pending',
          } as any);
          if (insertError) {
            toast.error('Erro ao criar perfil profissional: ' + insertError.message);
            setSaving(false);
            return;
          }
        }
      }

      await refetchProfile();
      toast.success('Perfil salvo com sucesso!');
    } catch (err: any) {
      toast.error('Erro inesperado: ' + (err.message || 'Tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  const initials = form.full_name.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

  useEffect(() => {
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
  }, [profile]);

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Meu Perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">Edite suas informações profissionais</p>

      <div className="mt-6 max-w-2xl space-y-6">
        {/* Avatar upload */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card flex items-center gap-6">
          <AvatarUpload userId={user!.id} currentUrl={avatarUrl} initials={initials} onUploaded={setAvatarUrl} />
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Foto de Perfil</h2>
            <p className="text-sm text-muted-foreground">Clique no ícone da câmera para alterar (max 2MB)</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground">Dados Pessoais</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Nome completo *</label>
              <input name="full_name" value={form.full_name} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Telefone *</label>
              <PhoneMaskedInput name="phone" value={form.phone} onChange={handlePhoneChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground">Dados Profissionais</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Nome do negócio</label>
              <input name="business_name" value={form.business_name} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>

            {/* Hierarchical category picker */}
            <div className="relative">
              <label className="mb-1 block text-sm font-medium text-foreground">Categoria principal *</label>
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
                  type="text"
                  value={categorySearch}
                  onChange={(e) => {
                    setCategorySearch(e.target.value);
                    setShowCategorySuggestions(true);
                    if (!e.target.value) setForm(prev => ({ ...prev, category_id: '', category_name: '', category_custom: '' }));
                  }}
                  onFocus={() => setShowCategorySuggestions(true)}
                  placeholder="Digite para buscar..."
                  className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground"
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
                              {macro.icon} {macro.name}
                            </div>
                            {subs.map((sub: any) => (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => handleCategorySelect(sub)}
                                className={`w-full pl-6 pr-3 py-2 text-left text-sm hover:bg-muted transition-colors ${form.category_id === sub.id ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'}`}
                              >
                                {sub.icon} {sub.name}
                              </button>
                            ))}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleCategorySelect(macro)}
                            className={`w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors ${form.category_id === macro.id ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'}`}
                          >
                            {macro.icon} {macro.name}
                          </button>
                        )}
                      </div>
                    ))
                  ) : categorySearch.trim() ? (
                    <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                      Nenhuma categoria encontrada
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      const customVal = categorySearch.trim() || 'Outro';
                      setForm(prev => ({ ...prev, category_id: '', category_name: '', category_custom: customVal }));
                      setCategorySearch(customVal);
                      setShowCategorySuggestions(false);
                    }}
                    className="w-full border-t border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    🏷️ Outro {categorySearch.trim() ? `("${categorySearch.trim()}")` : ''}
                  </button>
                </div>
              )}
              {showCategorySuggestions && (
                <div className="fixed inset-0 z-10" onClick={() => setShowCategorySuggestions(false)} />
              )}
            </div>

            {/* CNPJ */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                CNPJ <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={form.cnpj}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, '').slice(0, 14);
                  if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
                  else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');
                  else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
                  else if (v.length > 2) v = v.replace(/^(\d{2})(\d{1,3})/, '$1.$2');
                  setForm(prev => ({ ...prev, cnpj: v }));
                }}
                placeholder="00.000.000/0000-00"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>

            {/* Smart city selector */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground">Cidade *</label>
              <button
                type="button"
                onClick={handleAutoLocate}
                disabled={locating}
                className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
              >
                {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
                {locating ? 'Detectando...' : '📍 Usar minha localização'}
              </button>
              <div className="relative" ref={cityDropdownRef}>
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={citySearch}
                  onChange={(e) => {
                    setCitySearch(e.target.value);
                    setShowCitySuggestions(true);
                    loadCities();
                    setForm(prev => ({ ...prev, city: '', state: '', latitude: null, longitude: null }));
                  }}
                  onFocus={() => { setShowCitySuggestions(true); loadCities(); }}
                  placeholder="Digite sua cidade..."
                  className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground"
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
                      <button
                        key={`${c.name}-${c.state}-${i}`}
                        type="button"
                        onClick={() => handleCitySelect(c)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors ${
                          form.city === c.name && form.state === c.state ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'
                        }`}
                      >
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

            {/* State readonly */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Estado</label>
              <input
                type="text"
                value={form.state}
                readOnly
                placeholder="Auto-preenchido"
                className="w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-foreground uppercase cursor-not-allowed"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Bairro</label>
              <input name="neighborhood" value={form.neighborhood} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">WhatsApp</label>
              <PhoneMaskedInput name="whatsapp" value={form.whatsapp} onChange={handlePhoneChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              {!form.whatsapp && form.phone && (
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, whatsapp: prev.phone }))}
                  className="mt-1 text-xs text-accent hover:underline"
                >
                  Copiar do telefone
                </button>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Website</label>
              <input name="website" value={form.website} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Anos de experiência</label>
              <input name="years_experience" type="number" value={form.years_experience} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Descrição profissional</label>
            <textarea name="description" rows={4} value={form.description} onChange={handleChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </div>
        </div>

        {/* Account type switcher */}
        <ProfileTypeSwitcher />

        <Button variant="accent" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar Perfil'}
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default DashboardProfilePage;
