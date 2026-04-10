import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';
import { useQuery } from '@tanstack/react-query';
import { useSeoHead } from '@/hooks/useSeoHead';
import { User, Briefcase, Building2, ArrowRight, ArrowLeft, CheckCircle2, Search, LocateFixed, Loader2, MapPin } from 'lucide-react';
import PhoneMaskedInput from '@/components/PhoneMaskedInput';
import { fetchAllMunicipalities, geocodeCity, reverseGeocode, normalize, type CityResult } from '@/lib/geoUtils';
import { useAuth } from '@/hooks/useAuth';

const ACCOUNT_TYPES = [
  {
    value: 'client',
    label: 'Cliente',
    icon: User,
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
    selectedColor: 'bg-blue-500 text-white border-blue-500',
    desc: 'Busco profissionais e serviços',
    features: [
      'Encontrar profissionais na sua cidade',
      'Conversar com profissionais',
      'Visualizar perfis, serviços e portfólios',
      'Solicitar orçamentos',
    ],
    restrictions: [
      'Não publica serviços ou vagas',
    ],
  },
  {
    value: 'provider',
    label: 'Profissional',
    icon: Briefcase,
    color: 'bg-accent/10 text-accent border-accent/30',
    selectedColor: 'bg-accent text-accent-foreground border-accent',
    desc: 'Ofereço serviços e quero clientes',
    features: [
      'Página profissional própria (landing page)',
      'Cadastrar serviços com imagens',
      'Montar portfólio com fotos',
      'Receber leads e contatos',
      'Publicar vagas (com aprovação)',
    ],
    restrictions: [],
  },
  {
    value: 'rh',
    label: 'Agência / RH',
    icon: Building2,
    color: 'bg-purple-500/10 text-purple-600 border-purple-200',
    selectedColor: 'bg-purple-600 text-white border-purple-600',
    desc: 'Publico vagas e recruto profissionais',
    features: [
      'Publicar vagas com auto-aprovação',
      'Visualizar perfis completos de profissionais',
      'Avaliar e contatar profissionais',
      'Gerenciar processos seletivos',
    ],
    restrictions: [
      'Não cadastra serviços profissionais',
    ],
  },
];

const STEP_TYPE = 'type';
const STEP_DATA = 'data';

const SignupPage = () => {
  const [step, setStep] = useState(STEP_TYPE);
  const [accountType, setAccountType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [allCities, setAllCities] = useState<CityResult[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', password: '',
    businessName: '', categoryId: '', categoryName: '', categoryCustom: '', city: '', state: '', description: '',
    cnpj: '',
    latitude: null as number | null, longitude: null as number | null,
  });
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading, profile: authProfile } = useAuth();

  // Redirect already-authenticated users (e.g. after Google OAuth)
  useEffect(() => {
    if (authLoading || !authUser) return;
    const type = authProfile?.profile_type || 'client';
    if (type === 'client') navigate('/', { replace: true });
    else if (type === 'rh') navigate('/dashboard/vagas', { replace: true });
    else navigate('/dashboard/servicos', { replace: true });
  }, [authUser, authLoading, authProfile, navigate]);

  useSeoHead({ title: 'Criar Conta', description: 'Cadastre-se na plataforma Preciso de um.', noindex: true });

  const { data: categories = [] } = useQuery({
    queryKey: ['signup-categories'],
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
    const q = categorySearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const results: { macro: any; subs: any[] }[] = [];
    for (const macro of macroCategories) {
      const macroName = (macro.name as string).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const subs = (subsByParent[macro.id] || []).filter((s: any) =>
        (s.name as string).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
      );
      if (macroName.includes(q) || subs.length > 0) {
        results.push({ macro, subs: macroName.includes(q) ? subsByParent[macro.id] || [] : subs });
      }
    }
    return results;
  }, [categorySearch, macroCategories, subsByParent]);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCategorySelect = (cat: any) => {
    setForm(prev => ({ ...prev, categoryId: cat.id, categoryName: cat.name }));
    setCategorySearch(cat.name);
    setShowCategorySuggestions(false);
  };

  const handleCitySelect = async (name: string, st: string) => {
    setForm(prev => ({ ...prev, city: name, state: st }));
    setCitySearch(`${name}, ${st}`);
    setShowCitySuggestions(false);
    const { latitude, longitude } = await geocodeCity(name, st);
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
            // Try to match with IBGE city list
            const cities = await fetchAllMunicipalities();
            const normalizedDetected = normalize(detectedCity);
            const match = cities.find(c => normalize(c.name) === normalizedDetected && (
              !detectedState || normalize(c.state) === normalize(detectedState) ||
              detectedState.toLowerCase().includes(c.state.toLowerCase())
            ));
            if (match) {
              setForm(prev => ({ ...prev, city: match.name, state: match.state, latitude: lat, longitude: lon }));
              setCitySearch(`${match.name}, ${match.state}`);
            } else {
              setForm(prev => ({ ...prev, city: detectedCity, state: detectedState, latitude: lat, longitude: lon }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    // Phone validation: 10 or 11 digits
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Telefone deve ter pelo menos 10 dígitos');
      return;
    }

    if (showProviderFields) {
      // Category required
      if (!form.categoryId && !form.categoryCustom) {
        toast.error('Selecione uma categoria ou digite "Outro"');
        return;
      }
      // City must come from valid selection
      if (!form.city || !form.state) {
        toast.error('Selecione sua cidade na lista');
        return;
      }
      // CNPJ validation if provided
      const cnpjDigits = form.cnpj.replace(/\D/g, '');
      if (cnpjDigits && cnpjDigits.length !== 14) {
        toast.error('CNPJ deve ter 14 dígitos');
        return;
      }
    }

    setLoading(true);

    // Geocode fallback if lat/lon missing but city exists
    let { latitude, longitude } = form;
    if (showProviderFields && form.city && (latitude == null || longitude == null)) {
      try {
        const coords = await geocodeCity(form.city, form.state);
        latitude = coords.latitude;
        longitude = coords.longitude;
      } catch { /* proceed without coords */ }
    }

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName, profile_type_chosen: true, profile_type: accountType },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('Este e-mail já está cadastrado. Tente fazer login.');
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }

    if (data.user) {
      const profileRole = accountType === 'rh' ? 'client' : accountType;
      await supabase.from('profiles').update({
        phone: form.phone,
        role: profileRole,
        profile_type: accountType,
      } as any).eq('id', data.user.id);

      if (accountType === 'provider') {
        const slug = `${form.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${form.city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
        const cnpjClean = form.cnpj ? form.cnpj.replace(/\D/g, '') : null;
        const { data: providerData } = await supabase.from('providers').insert({
          user_id: data.user.id,
          business_name: form.businessName || null,
          description: form.description,
          city: form.city,
          state: form.state,
          phone: form.phone,
          whatsapp: form.phone,
          category_id: form.categoryId || null,
          category_custom: form.categoryCustom || null,
          cnpj: cnpjClean || null,
          latitude,
          longitude,
          slug,
          status: 'pending',
        } as any).select('id').single();

        // Auto-create trial subscription (idempotent: skip if already exists)
        if (providerData?.id) {
          const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('provider_id', providerData.id)
            .in('status', ['trial', 'active'])
            .maybeSingle();

          if (!existingSub) {
            await supabase.from('subscriptions').insert({
              provider_id: providerData.id,
              plan: 'trial',
              status: 'trial',
              starts_at: new Date().toISOString(),
            });

            logAuditAction({
              action: 'subscription_created',
              resource_type: 'subscription',
              resource_id: providerData.id,
              details: { plan: 'trial' },
            }).catch(() => {});
          }
        }
      }
    }

    setLoading(false);
    toast.success('Conta criada com sucesso! Bem-vindo!');
    if (accountType === 'client') {
      navigate('/');
    } else if (accountType === 'rh') {
      navigate('/dashboard/vagas');
    } else {
      navigate('/dashboard/servicos');
    }
  };

  const handleGoogleSignup = async () => {
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error('Erro ao cadastrar com Google');
  };

  const selectedType = ACCOUNT_TYPES.find(t => t.value === accountType);
  const showProviderFields = accountType === 'provider';

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 items-center justify-center py-8 px-4">
        <div className="w-full max-w-lg">

          {/* STEP 1: Choose account type */}
          {step === STEP_TYPE && (
            <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-card">
              <h1 className="text-center font-display text-2xl font-bold text-foreground">Criar Conta</h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Escolha o tipo de conta que melhor se encaixa no seu perfil
              </p>

              <div className="mt-6 space-y-3">
                {ACCOUNT_TYPES.map(type => {
                  const Icon = type.icon;
                  const isSelected = accountType === type.value;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setAccountType(type.value)}
                      className={`w-full rounded-xl border-2 p-4 text-left transition-all ${isSelected ? type.selectedColor + ' shadow-md scale-[1.01]' : type.color + ' hover:shadow-sm'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-6 w-6 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display text-base font-bold">{type.label}</h3>
                          <p className={`text-xs mt-0.5 ${isSelected ? 'opacity-90' : 'text-muted-foreground'}`}>{type.desc}</p>
                        </div>
                        {isSelected && <CheckCircle2 className="h-5 w-5 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Features/Restrictions for selected type */}
              {selectedType && (
                <div className="mt-4 rounded-lg bg-muted/50 p-4 text-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <p className="font-semibold text-foreground mb-2">O que você pode fazer:</p>
                  <ul className="space-y-1.5">
                    {selectedType.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {selectedType.restrictions.length > 0 && (
                    <>
                      <p className="font-semibold text-foreground mt-3 mb-1.5">Limitações:</p>
                      <ul className="space-y-1">
                        {selectedType.restrictions.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="shrink-0 mt-0.5 text-destructive">✕</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              <Button
                variant="accent"
                className="mt-6 w-full"
                disabled={!accountType}
                onClick={() => setStep(STEP_DATA)}
              >
                Continuar <ArrowRight className="ml-1 h-4 w-4" />
              </Button>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                Já tem conta? <Link to="/login" className="font-medium text-accent hover:underline">Entrar</Link>
              </p>
            </div>
          )}

          {/* STEP 2: Form fields */}
          {step === STEP_DATA && (
            <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-card">
              <button
                onClick={() => setStep(STEP_TYPE)}
                className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>

              <div className="flex items-center gap-3 mb-6">
                {selectedType && (
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${selectedType.color}`}>
                    <selectedType.icon className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h1 className="font-display text-xl font-bold text-foreground">
                    Conta {selectedType?.label}
                  </h1>
                  <p className="text-xs text-muted-foreground">{selectedType?.desc}</p>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={handleGoogleSignup}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Cadastrar com Google
              </Button>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">ou preencha abaixo</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Nome completo *</label>
                  <input type="text" name="fullName" required value={form.fullName} onChange={handleChange}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-colors" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">E-mail *</label>
                  <input type="email" name="email" required value={form.email} onChange={handleChange}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-colors" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Telefone / WhatsApp *</label>
                  <PhoneMaskedInput
                    name="phone"
                    value={form.phone}
                    onChange={(name, raw) => setForm(prev => ({ ...prev, [name]: raw }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Senha * <span className="text-muted-foreground font-normal">(mínimo 6 caracteres)</span></label>
                  <input type="password" name="password" required minLength={6} value={form.password} onChange={handleChange}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-colors" />
                </div>

                {/* Provider-specific fields */}
                {showProviderFields && (
                  <>
                    <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
                      <p className="text-xs font-medium text-accent">
                        ✨ Complete os dados abaixo para criar sua página profissional
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Nome do negócio</label>
                      <input type="text" name="businessName" value={form.businessName} onChange={handleChange}
                        placeholder="Ex: João Eletricista"
                        className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-colors" />
                    </div>

                    {/* CNPJ opcional */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        CNPJ <span className="text-muted-foreground font-normal">(opcional — pontua no ranking)</span>
                      </label>
                      <input
                        type="text"
                        value={form.cnpj}
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, '').slice(0, 14);
                          // Apply mask: XX.XXX.XXX/XXXX-XX
                          if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
                          else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');
                          else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
                          else if (v.length > 2) v = v.replace(/^(\d{2})(\d{1,3})/, '$1.$2');
                          setForm(prev => ({ ...prev, cnpj: v }));
                        }}
                        placeholder="00.000.000/0000-00"
                        className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-colors"
                      />
                    </div>

                    {/* Smart category picker with hierarchy */}
                    <div className="relative">
                      <label className="mb-1 block text-sm font-medium text-foreground">Categoria principal</label>
                      {(form.categoryName || form.categoryCustom) && (
                        <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
                          {form.categoryName || form.categoryCustom}
                          <button type="button" onClick={() => {
                            setForm(prev => ({ ...prev, categoryId: '', categoryName: '', categoryCustom: '' }));
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
                            if (!e.target.value) setForm(prev => ({ ...prev, categoryId: '', categoryName: '', categoryCustom: '' }));
                          }}
                          onFocus={() => setShowCategorySuggestions(true)}
                          placeholder="Digite para buscar... Ex: Eletricista"
                          className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-colors"
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
                                        className={`w-full pl-6 pr-3 py-2 text-left text-sm hover:bg-muted transition-colors ${form.categoryId === sub.id ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'}`}
                                      >
                                        {sub.icon} {sub.name}
                                      </button>
                                    ))}
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleCategorySelect(macro)}
                                    className={`w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors ${form.categoryId === macro.id ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'}`}
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

                          {/* "Outro" option */}
                          <button
                            type="button"
                            onClick={() => {
                              const customVal = categorySearch.trim() || 'Outro';
                              setForm(prev => ({ ...prev, categoryId: '', categoryName: '', categoryCustom: customVal }));
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

                    {/* Smart city selector */}
                    <div>
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
                            // Invalidate selection when user edits after choosing
                            setForm(prev => ({ ...prev, city: '', state: '', latitude: null, longitude: null }));
                          }}
                          onFocus={() => { setShowCitySuggestions(true); loadCities(); }}
                          placeholder="Digite sua cidade..."
                          className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-colors"
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
                                onClick={() => handleCitySelect(c.name, c.state)}
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

                    {/* State auto-filled readonly */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Estado</label>
                      <input
                        type="text"
                        value={form.state}
                        readOnly
                        placeholder="Auto-preenchido"
                        className="w-full rounded-md border border-input bg-muted/50 px-3 py-2.5 text-sm text-foreground uppercase cursor-not-allowed"
                      />
                    </div>


                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Descrição profissional</label>
                      <textarea name="description" rows={3} value={form.description} onChange={handleChange}
                        placeholder="Descreva seus serviços e experiência..."
                        className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-colors resize-none" />
                    </div>
                  </>
                )}

                {/* RH-specific info */}
                {accountType === 'rh' && (
                  <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-800 dark:bg-purple-900/20">
                    <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
                      🏢 Sua conta de Agência/RH permite publicar vagas com auto-aprovação e acessar perfis de profissionais cadastrados.
                    </p>
                  </div>
                )}

                <Button type="submit" variant="accent" className="w-full text-base py-3" disabled={loading}>
                  {loading ? 'Criando conta...' : 'Criar minha conta'}
                </Button>
              </form>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                Já tem conta? <Link to="/login" className="font-medium text-accent hover:underline">Entrar</Link>
              </p>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SignupPage;
