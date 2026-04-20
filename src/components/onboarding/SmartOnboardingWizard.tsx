import { useEffect, useRef, useState } from 'react';
import { Briefcase, UserRound, MapPin, Sparkles, Loader2, ArrowLeft, CheckCircle2, RotateCcw, PartyPopper, AlertCircle, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeoCity } from '@/hooks/useGeoCity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SmartCategoryPicker from '@/components/SmartCategoryPicker';
import CityAutocomplete from '@/components/CityAutocomplete';
import ServiceWizard from '@/components/dashboard/ServiceWizard';
import { useCategoriesWithCount } from '@/hooks/useProviders';

type ProfileType = 'provider' | 'client';
type WizardStep = 1 | 2 | 3 | 4;

const STORAGE_KEY = 'onboarding_wizard_state';

const CATEGORY_ICON_MAP: Record<string, string> = {
  eletricista: 'Zap', eletrica: 'Zap',
  encanador: 'Wrench', hidraulica: 'Wrench', encanamento: 'Wrench',
  pintor: 'Paintbrush', pintura: 'Paintbrush',
  pedreiro: 'Hammer', alvenaria: 'Hammer', construcao: 'Hammer',
  marceneiro: 'Hammer', marcenaria: 'Hammer',
  mecanico: 'Car', automotivo: 'Car',
  diarista: 'Sparkles', limpeza: 'Sparkles', faxina: 'Sparkles',
  cabeleireiro: 'Scissors', barbeiro: 'Scissors',
  jardineiro: 'Briefcase', jardinagem: 'Briefcase',
  frete: 'Truck', mudanca: 'Truck',
  ar: 'Snowflake', refrigeracao: 'Snowflake',
  dedetizador: 'Bug', dedetizacao: 'Bug',
  chaveiro: 'KeyRound',
};

function pickIconForCategory(name?: string | null): string {
  if (!name) return 'Sparkles';
  const norm = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const key of Object.keys(CATEGORY_ICON_MAP)) {
    if (norm.includes(key)) return CATEGORY_ICON_MAP[key];
  }
  return 'Briefcase';
}

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

interface PersistedState {
  step: WizardStep;
  profileType: ProfileType | null;
  city: string;
  state: string;
  fullName: string;
  selectedCategoryIds: string[];
}

const loadPersistedState = (): Partial<PersistedState> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const SmartOnboardingWizard = () => {
  const { user, refetchProfile } = useAuth();
  const { city: geoCity, state: geoState } = useGeoCity();
  const { data: categoriesData = [] } = useCategoriesWithCount();
  const navigate = useNavigate();

  const persisted = useRef<Partial<PersistedState>>(loadPersistedState());

  const [step, setStep] = useState<WizardStep>((persisted.current.step as WizardStep) || 1);
  const [profileType, setProfileType] = useState<ProfileType | null>(persisted.current.profileType ?? null);
  const [city, setCity] = useState(persisted.current.city ?? (geoCity || ''));
  const [state, setState] = useState(persisted.current.state ?? (geoState || ''));
  const [editingCity, setEditingCity] = useState(false);
  const [fullName, setFullName] = useState(
    persisted.current.fullName ??
    ((user?.user_metadata?.full_name as string) || user?.email?.split('@')[0] || '')
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    persisted.current.selectedCategoryIds ?? []
  );
  const [saving, setSaving] = useState(false);

  // After confirm: store provider so we can render the integrated ServiceWizard at Step 4
  const [savedProvider, setSavedProvider] = useState<any | null>(null);
  const [servicesCreated, setServicesCreated] = useState(0);
  const [showStep4Intro, setShowStep4Intro] = useState(false);

  // Persist progress
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        step, profileType, city, state, fullName, selectedCategoryIds,
      } satisfies PersistedState));
    } catch {}
  }, [step, profileType, city, state, fullName, selectedCategoryIds]);

  // Sync geo on first load only
  useEffect(() => {
    if (!editingCity && geoCity && !city) setCity(geoCity);
    if (geoState && !state) setState(geoState);
  }, [geoCity, geoState, editingCity, city, state]);

  const categoriesForPicker = categoriesData.map((c: any) => ({
    id: c.id, name: c.name, icon: c.icon, slug: c.slug, parent_id: c.parent_id,
  }));

  const selectedCategory = categoriesForPicker.find(c => c.id === selectedCategoryIds[0]);

  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const [pulseNext, setPulseNext] = useState(false);

  const handleToggleCategory = (id: string) => {
    setSelectedCategoryIds(prev => {
      const next = prev.includes(id) ? [] : [id];
      if (next.length === 1) {
        setTimeout(() => {
          nextBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setPulseNext(true);
          setTimeout(() => setPulseNext(false), 2400);
        }, 150);
      }
      return next;
    });
  };

  const clearPersisted = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const handleConfirm = async () => {
    if (!user?.id) {
      toast.error('Sessão expirada. Faça login novamente.');
      return;
    }
    if (!profileType) return;
    if (!city.trim()) {
      toast.error('Selecione sua cidade.');
      setStep(2);
      return;
    }
    setSaving(true);
    try {
      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          profile_type: profileType,
          role: profileType,
          onboarding_completed: true,
          full_name: fullName.trim() || undefined,
        } as any)
        .eq('id', user.id);
      if (profErr) throw profErr;

      const { error: metaErr } = await supabase.auth.updateUser({
        data: { profile_type_chosen: true, profile_type: profileType },
      });
      if (metaErr) throw metaErr;

      let providerRow: any = null;
      if (profileType === 'provider') {
        const { data: existing } = await supabase
          .from('providers')
          .select('*')
          .eq('user_id', user.id)
          .limit(1);
        if (existing && existing.length > 0) {
          providerRow = existing[0];
          // Patch city/category if missing
          await supabase.from('providers').update({
            city: city || providerRow.city,
            state: state || providerRow.state,
            category_id: selectedCategoryIds[0] || providerRow.category_id,
          }).eq('id', providerRow.id);
          providerRow = { ...providerRow, city, state, category_id: selectedCategoryIds[0] || providerRow.category_id };
        } else {
          const baseSlug = slugify(fullName || user.email?.split('@')[0] || 'profissional');
          const uniqueSlug = `${baseSlug}-${user.id.slice(0, 6)}`;
          const { data: created, error: provErr } = await supabase.from('providers').insert({
            user_id: user.id,
            slug: uniqueSlug,
            city: city || null,
            state: state || null,
            category_id: selectedCategoryIds[0] || null,
            status: 'pending',
          }).select('*').single();
          if (provErr) throw provErr;
          providerRow = created;
        }
      }

      const firstName = (fullName.trim().split(' ')[0] || 'Profissional');
      const initial = firstName.charAt(0).toUpperCase();
      const alias = `${firstName} ${initial}.`;
      await supabase.from('public_activities').insert({
        actor_alias: alias,
        action_text: 'acaba de se cadastrar',
        icon: pickIconForCategory(selectedCategory?.name),
        city: city || null,
        profile_type: profileType,
        category_name: selectedCategory?.name || null,
        is_seed: false,
      });

      const refreshedProfile = await refetchProfile();
      const confirmedProfileType = refreshedProfile?.profile_type ?? profileType;
      if (confirmedProfileType !== profileType) {
        throw new Error(`Profile type mismatch: expected ${profileType}, got ${confirmedProfileType ?? 'null'}`);
      }

      try {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
        setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.5 } }), 250);
      } catch {/* noop */}

      // Client → home immediately. Provider → Step 4 (integrated ServiceWizard).
      if (confirmedProfileType !== 'provider') {
        toast.success('Tudo pronto! Bem-vindo(a).');
        clearPersisted();
        if (import.meta.env.DEV) console.log('[Redirect Debug] Usuário tipo client indo para rota /');
        navigate('/', { replace: true });
        return;
      }

      // Provider flow continues inside the wizard
      toast.success('Perfil validado! Vamos criar seu primeiro serviço.');
      setSavedProvider(providerRow);
      setShowStep4Intro(true);
      setStep(4);
    } catch (err) {
      console.error('[Onboarding]', err);
      toast.error('Não conseguimos salvar. Tente novamente em instantes.');
    } finally {
      setSaving(false);
    }
  };

  const handleServiceCreated = () => {
    setServicesCreated(c => c + 1);
  };

  const finishToPublicProfile = () => {
    clearPersisted();
    const slug = savedProvider?.slug;
    const target = slug ? `/profissional/${slug}` : '/dashboard';
    if (import.meta.env.DEV) console.log(`[Redirect Debug] Usuário tipo provider indo para rota ${target}`);
    navigate(target, { replace: true });
  };

  // ========================================
  // STEP 4 — Integrated Service Creation
  // ========================================
  if (step === 4 && savedProvider) {
    return (
      <div className="fixed inset-0 z-[100] flex items-start justify-center bg-background/95 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="relative w-full max-w-lg my-6">
          {showStep4Intro && servicesCreated === 0 && (
            <div className="mb-4 rounded-2xl border-2 border-accent bg-gradient-to-br from-accent/10 to-transparent p-5 text-center animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-center mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <PartyPopper className="h-6 w-6" />
                </div>
              </div>
              <h2 className="font-display text-lg font-bold text-foreground">Perfil validado!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Agora descreva seu primeiro serviço para aparecer na busca.
              </p>
            </div>
          )}

          {servicesCreated > 0 && (
            <div className="mb-4 rounded-2xl border border-border bg-card p-5 text-center">
              <div className="flex justify-center mb-2">
                <CheckCircle2 className="h-10 w-10 text-accent" />
              </div>
              <h2 className="font-display text-lg font-bold text-foreground">
                {servicesCreated === 1 ? 'Primeiro serviço publicado!' : `${servicesCreated} serviços publicados!`}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Quer cadastrar mais um serviço ou já podemos liberar sua página?
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setShowStep4Intro(false); /* re-renders ServiceWizard for new entry */ window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  + Novo serviço
                </Button>
                <Button variant="accent" onClick={finishToPublicProfile}>
                  Ver minha página
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <ServiceWizard
              key={`sw-${servicesCreated}`}
              providerId={savedProvider.id}
              userId={user!.id}
              provider={savedProvider}
              categories={categoriesData}
              onComplete={handleServiceCreated}
              onCancel={() => {
                if (servicesCreated > 0) {
                  finishToPublicProfile();
                } else {
                  toast.info('Você precisa publicar pelo menos 1 serviço.');
                }
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4 overflow-y-auto">
      {saving && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-background/90 backdrop-blur-md gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
          <p className="text-base font-bold text-foreground text-center px-6">
            Segura as ferramentas!
          </p>
          <p className="text-sm text-muted-foreground text-center px-6 max-w-sm">
            Estamos preparando seu espaço na vitrine...
          </p>
        </div>
      )}

      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-300 my-auto">
        {step > 1 && (
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setProfileType(null);
              setSelectedCategoryIds([]);
            }}
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:border-accent transition-colors"
            title="Recomeçar do zero"
            aria-label="Recomeçar onboarding"
          >
            <RotateCcw className="h-3 w-3" /> Recomeçar
          </button>
        )}
        <div className="flex items-center justify-center gap-2 mb-5">
          {[1, 2, 3].map(n => (
            <span
              key={n}
              className={`h-1.5 rounded-full transition-all ${
                step === n ? 'w-8 bg-accent' : step > n ? 'w-4 bg-accent/60' : 'w-4 bg-muted'
              }`}
            />
          ))}
        </div>

        {/* STEP 1 — Identidade */}
        {step === 1 && (
          <>
            <h1 className="text-center font-display text-2xl font-bold text-foreground">
              Bem-vindo!
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Como você vai usar a plataforma?
            </p>

            <div className="mt-6 grid gap-3">
              <button
                onClick={() => { setProfileType('provider'); setStep(2); }}
                className="group rounded-2xl border-2 border-accent/30 bg-accent/5 p-5 text-left transition-all hover:border-accent hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Briefcase className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg font-bold text-foreground">Sou Profissional</h3>
                    <p className="text-xs text-muted-foreground">Quero divulgar meu serviço e receber clientes</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => { setProfileType('client'); setStep(2); }}
                className="group rounded-2xl border-2 border-blue-500/30 bg-blue-500/5 p-5 text-left transition-all hover:border-blue-500 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <UserRound className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg font-bold text-foreground">Sou Cliente</h3>
                    <p className="text-xs text-muted-foreground">Quero contratar um profissional</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-border space-y-2 text-center">
              <button
                onClick={() => navigate('/cadastro/rh')}
                className="block w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Sou empresa / RH e quero publicar vagas →
              </button>
              <button
                onClick={() => navigate('/anuncie')}
                className="block w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Quero anunciar minha marca na plataforma →
              </button>
            </div>
          </>
        )}

        {/* STEP 2 — Geo via CityAutocomplete */}
        {step === 2 && (
          <>
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            <div className="flex justify-center mb-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                <MapPin className="h-7 w-7 text-accent" />
              </div>
            </div>
            <h1 className="text-center font-display text-xl font-bold text-foreground">
              Onde você atua?
            </h1>

            {!editingCity && city ? (
              <>
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  Detectamos que você está em
                </p>
                <p className="mt-1 text-center text-2xl font-bold text-accent">
                  {city}{state ? ` • ${state}` : ''}
                </p>
                <p className="mt-2 text-center text-xs text-muted-foreground">Está correto?</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => setEditingCity(true)}>
                    Outra cidade
                  </Button>
                  <Button variant="accent" onClick={() => setStep(3)}>
                    SIM, está certo
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  Selecione sua cidade na lista oficial:
                </p>
                <div className="mt-4">
                  <CityAutocomplete
                    value={{ city, state }}
                    onChange={({ city: c, state: s }) => {
                      setCity(c);
                      setState(s);
                    }}
                  />
                </div>
                <Button
                  variant="accent"
                  className="mt-4 w-full"
                  disabled={!city.trim()}
                  onClick={() => { setEditingCity(false); setStep(3); }}
                >
                  Confirmar e continuar
                </Button>
              </>
            )}
          </>
        )}

        {/* STEP 3 — Nome + categoria única */}
        {step === 3 && (
          <>
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            <div className="flex justify-center mb-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-amber-500 text-white">
                <Sparkles className="h-7 w-7" />
              </div>
            </div>
            <h1 className="text-center font-display text-xl font-bold text-foreground">
              Quase lá!
            </h1>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Só faltam estas informações:
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Seu nome completo
                </label>
                <Input
                  placeholder="Ex: João Silva"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>

              {profileType === 'provider' && (
                <div>
                  <label className="text-xs font-semibold text-foreground mb-2 block">
                    Sua especialidade principal
                  </label>
                  <div className="mb-3 flex items-start gap-2 rounded-xl border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 p-3 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-100">
                      Escolha sua <strong>especialidade principal</strong> agora. Você poderá adicionar outras categorias e serviços depois, dentro do seu painel.
                    </p>
                  </div>
                  <SmartCategoryPicker
                    categories={categoriesForPicker}
                    selectedIds={selectedCategoryIds}
                    onToggle={handleToggleCategory}
                    maxSelections={1}
                    placeholder="Ex: Eletricista, Pintor, Diarista..."
                  />
                  {selectedCategoryIds.length > 0 && selectedCategory && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 animate-in fade-in slide-in-from-top-1">
                      <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                      <span className="text-xs font-medium text-foreground">
                        Selecionado: <strong>{selectedCategory.name}</strong>
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
                <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                <p className="text-xs text-foreground">
                  Você ganhou <span className="font-bold text-accent">+20 pontos de confiança!</span>
                </p>
              </div>
            </div>

            <Button
              ref={nextBtnRef}
              variant="accent"
              className={`mt-5 w-full transition-shadow ${pulseNext ? 'animate-pulse ring-4 ring-accent/40 shadow-lg shadow-accent/30' : ''}`}
              disabled={saving || !fullName.trim() || (profileType === 'provider' && selectedCategoryIds.length === 0)}
              onClick={handleConfirm}
            >
              {saving ? 'Salvando...' : profileType === 'provider' ? 'Próximo: criar meu serviço →' : 'Concluir cadastro'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default SmartOnboardingWizard;
