import { useEffect, useRef, useState } from 'react';
import { Briefcase, UserRound, MapPin, Sparkles, Loader2, ArrowLeft, CheckCircle2, RotateCcw, PartyPopper, AlertCircle, TrendingUp, Building2, Megaphone } from 'lucide-react';
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

type ProfileType = 'provider' | 'client' | 'rh';
type WizardStep = 1 | 2 | 3 | 4;
type ProviderSubtype = 'autonomous' | 'company';

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

/** Valida CNPJ via algoritmo mod11 (dígitos verificadores reais). */
function isValidCnpj(raw: string): boolean {
  const cnpj = (raw || '').replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // todos iguais
  const calc = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  const d1 = calc(cnpj.slice(0, 12), w1);
  const d2 = calc(cnpj.slice(0, 12) + d1, w2);
  return d1 === parseInt(cnpj[12], 10) && d2 === parseInt(cnpj[13], 10);
}

interface PersistedState {
  step: WizardStep;
  profileType: ProfileType | null;
  providerSubtype: ProviderSubtype | null;
  legalName: string;
  cnpj: string;
  agencyName: string;
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

export type WizardMode = 'basic' | 'complete' | 'portfolio' | 'affiliate';

interface SmartOnboardingWizardProps {
  /**
   * Modo de operação do Wizard.
   * - basic (default): cadastro inicial completo (steps 1→4)
   * - complete: usuário voltou para preencher dados que faltam (CPF, links sociais) — TODO UI
   * - portfolio: criação de álbuns de fotos de trabalhos realizados — TODO UI
   * - affiliate: acompanhamento de código/link de indicação — TODO UI
   */
  mode?: WizardMode;
}

/* Placeholder centralizado para os 3 modos extras (UI completa virá em iterações futuras). */
const PlaceholderModeShell = ({ title, body }: { title: string; body: string }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
    <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
      <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  </div>
);

const SmartOnboardingWizard = ({ mode = 'basic' }: SmartOnboardingWizardProps = {}) => {
  // ─── Modos extras: placeholders. Só "basic" monta hooks reais. ───
  if (mode === 'complete') return <PlaceholderModeShell title="Complete seu perfil" body="Em breve você poderá adicionar CPF, links sociais e outros dados aqui." />;
  if (mode === 'portfolio') return <PlaceholderModeShell title="Criar álbum de portfólio" body="Em breve você poderá organizar fotos de trabalhos realizados em álbuns temáticos aqui." />;
  if (mode === 'affiliate') return <PlaceholderModeShell title="Programa de Afiliados" body="Em breve você acompanhará seu código de indicação e ganhos aqui." />;
  return <BasicOnboardingWizard />;
};

const BasicOnboardingWizard = () => {
  const { user, refetchProfile } = useAuth();
  const { city: geoCity, state: geoState } = useGeoCity();
  const { data: categoriesData = [] } = useCategoriesWithCount();
  const navigate = useNavigate();

  const persisted = useRef<Partial<PersistedState>>(loadPersistedState());

  const [step, setStep] = useState<WizardStep>((persisted.current.step as WizardStep) || 1);
  const [profileType, setProfileType] = useState<ProfileType | null>(persisted.current.profileType ?? null);
  const [providerSubtype, setProviderSubtype] = useState<ProviderSubtype | null>(persisted.current.providerSubtype ?? null);
  const [showSubtypeStep, setShowSubtypeStep] = useState(false);
  const [legalName, setLegalName] = useState(persisted.current.legalName ?? '');
  const [cnpj, setCnpj] = useState(persisted.current.cnpj ?? '');
  const [agencyName, setAgencyName] = useState(persisted.current.agencyName ?? '');
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
        step, profileType, providerSubtype, legalName, cnpj, agencyName, city, state, fullName, selectedCategoryIds,
      } satisfies PersistedState));
    } catch {}
  }, [step, profileType, providerSubtype, legalName, cnpj, agencyName, city, state, fullName, selectedCategoryIds]);

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
  const autoAdvancedRef = useRef(false);

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

  // Auto-advance removido: a esteira deve ser controlada ATIVAMENTE pelo usuário.
  // Mantemos apenas o reset de qualquer guard antigo ao trocar de step.
  useEffect(() => {
    if (step !== 3) autoAdvancedRef.current = false;
  }, [step]);

  /**
   * Salvamento incremental — sempre que o usuário avança (clicando em "Salvar e avançar"
   * OU em "Pular esta etapa"), persistimos o que já foi digitado em profiles/providers.
   * Nunca perdemos dados parciais.
   */
  const persistPartialProgress = async () => {
    if (!user?.id) return;
    try {
      const profilePatch: Record<string, any> = { onboarding_completed: false };
      if (profileType) { profilePatch.profile_type = profileType; profilePatch.role = profileType; }
      if (fullName.trim()) profilePatch.full_name = fullName.trim();
      await supabase.from('profiles').update(profilePatch as any).eq('id', user.id);
    } catch (err) {
      // silencioso — não bloqueia avanço se houver glitch de rede
      if (import.meta.env.DEV) console.warn('[Onboarding] persistPartialProgress falhou:', err);
    }
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
      const shouldKeepWizardOpen = profileType === 'provider' || profileType === 'rh';

      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          profile_type: profileType,
          role: profileType,
          onboarding_completed: shouldKeepWizardOpen ? false : true,
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
        const subtypePatch: any = {
          account_type: providerSubtype || 'autonomous',
          legal_name: providerSubtype === 'company' ? (legalName.trim() || null) : null,
          cnpj: providerSubtype === 'company' ? (cnpj.trim() || null) : null,
        };
        if (existing && existing.length > 0) {
          providerRow = existing[0];
          // Patch city/category if missing
          await supabase.from('providers').update({
            city: city || providerRow.city,
            state: state || providerRow.state,
            category_id: selectedCategoryIds[0] || providerRow.category_id,
            ...subtypePatch,
          }).eq('id', providerRow.id);
          providerRow = { ...providerRow, city, state, category_id: selectedCategoryIds[0] || providerRow.category_id, ...subtypePatch };
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
            ...subtypePatch,
          }).select('*').single();
          if (provErr) throw provErr;
          providerRow = created;
        }
      }

      if (profileType === 'rh') {
        const { data: existingAgencyRaw } = await (supabase as any)
          .from('agencies')
          .select('*')
          .eq('user_id', user.id)
          .limit(1);
        const existingAgency = existingAgencyRaw as any[] | null;
        if (!existingAgency || existingAgency.length === 0) {
          const baseSlug = slugify(agencyName || fullName || user.email?.split('@')[0] || 'agencia');
          const uniqueSlug = `${baseSlug}-${user.id.slice(0, 6)}`;
          await (supabase as any).from('agencies').insert({
            user_id: user.id,
            slug: uniqueSlug,
            name: agencyName.trim() || fullName.trim() || 'Minha Agência',
            city: city || null,
            state: state || null,
            status: 'pending',
          });
        } else {
          await (supabase as any).from('agencies').update({
            name: agencyName.trim() || existingAgency[0].name,
            city: city || existingAgency[0].city,
            state: state || existingAgency[0].state,
          }).eq('id', existingAgency[0].id);
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

      // Roteamento por tipo: Cliente → home; RH → painel de vagas; Provider → Step 4.
      if (confirmedProfileType === 'client') {
        toast.success('Tudo pronto! Bem-vindo(a).');
        clearPersisted();
        if (import.meta.env.DEV) console.log('[Redirect Debug] Usuário tipo client indo para rota /');
        navigate('/', { replace: true });
        return;
      }

      if (confirmedProfileType === 'rh') {
        toast.success('Painel RH liberado!');
        clearPersisted();
        if (import.meta.env.DEV) console.log('[Redirect Debug] Usuário tipo rh indo para /dashboard/vagas');
        navigate('/dashboard/vagas', { replace: true });
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

  const handleServiceCreated = (_serviceId: string) => {
    // ServiceWizard agora exige ≥1 foto antes de habilitar "Concluir",
    // portanto qualquer chamada aqui já garante hasImage=true.
    setServicesCreated(c => c + 1);
    if (user?.id) {
      void supabase.from('profiles').update({ onboarding_completed: true } as any).eq('id', user.id);
    }
  };


  const finishToPublicProfile = () => {
    clearPersisted();
    if (user?.id) {
      void supabase.from('profiles').update({ onboarding_completed: true } as any).eq('id', user.id);
    }
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

              {/* Confidence Level Bar */}
              <div className="mt-4 text-left">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
                    <TrendingUp className="h-3 w-3 text-accent" /> Nível de confiança
                  </span>
                  <span className="text-[11px] font-bold text-accent">
                    {servicesCreated >= 3 ? '100% — Portfólio Forte' : servicesCreated === 2 ? '80% — Engajado' : '60% — Iniciante consolidado'}
                  </span>
                </div>
                <Progress
                  value={servicesCreated >= 3 ? 100 : servicesCreated === 2 ? 80 : 60}
                  className="h-2"
                />
                {servicesCreated < 3 && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Cadastre mais {3 - servicesCreated} {3 - servicesCreated === 1 ? 'serviço' : 'serviços'} para chegar ao topo.
                  </p>
                )}
              </div>

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

        {/* SUBTYPE STEP — only after choosing Profissional */}
        {showSubtypeStep && profileType === 'provider' && (
          <>
            <button
              onClick={() => { setShowSubtypeStep(false); setProfileType(null); setProviderSubtype(null); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            <h1 className="text-center font-display text-xl font-bold text-foreground">
              Você atua como…
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Escolha o formato que melhor descreve seu trabalho.
            </p>
            <div className="mt-6 grid gap-3">
              <button
                onClick={() => { setProviderSubtype('autonomous'); setShowSubtypeStep(false); setStep(2); }}
                className="group rounded-2xl border-2 border-accent/30 bg-accent/5 p-5 text-left transition-all hover:border-accent hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <UserRound className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-base font-bold text-foreground">Profissional Autônomo (PF)</h3>
                    <p className="text-xs text-muted-foreground">Trabalho por conta própria, sem CNPJ obrigatório.</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => { setProviderSubtype('company'); setShowSubtypeStep(false); setStep(2); }}
                className="group rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 text-left transition-all hover:border-primary hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Building2 className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-base font-bold text-foreground">Empresa / MEI (PJ)</h3>
                    <p className="text-xs text-muted-foreground">Tenho CNPJ e razão social — vou pedir esses dados a seguir.</p>
                  </div>
                </div>
              </button>
            </div>
          </>
        )}

        {/* STEP 1 — Identidade */}
        {step === 1 && !showSubtypeStep && (
          <>
            <h1 className="text-center font-display text-2xl font-bold text-foreground">
              Bem-vindo!
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Como você vai usar a plataforma?
            </p>

            <div className="mt-6 grid gap-3">
              <button
                onClick={() => { setProfileType('provider'); setShowSubtypeStep(true); }}
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

            <div className="mt-3 grid gap-3">
              <button
                onClick={() => { setProfileType('rh'); setStep(2); }}
                className="group rounded-2xl border-2 border-purple-500/30 bg-purple-500/5 p-5 text-left transition-all hover:border-purple-500 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white">
                    <Building2 className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg font-bold text-foreground">Sou Agência de RH / Recrutamento</h3>
                    <p className="text-xs text-muted-foreground">Recruto e contrato talentos para empresas</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-border text-center">
              <button
                onClick={() => navigate('/sponsor-panel')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Megaphone className="h-3.5 w-3.5" />
                Sou Patrocinador — quero anunciar minha marca →
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
                      // Auto-avanço: se a seleção veio com cidade + UF da lista oficial, pula para o Step 3
                      if (c.trim() && s.trim()) {
                        setTimeout(() => {
                          setEditingCity(false);
                          setStep(3);
                        }, 350);
                      }
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
                  {profileType === 'rh' ? 'Seu nome (responsável)' : 'Seu nome completo'}
                </label>
                <Input
                  placeholder="Ex: João Silva"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>

              {profileType === 'provider' && providerSubtype === 'company' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">
                      Razão Social
                    </label>
                    <Input
                      placeholder="Ex: João Silva Serviços LTDA"
                      value={legalName}
                      onChange={e => setLegalName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">
                      CNPJ
                    </label>
                    <Input
                      placeholder="00.000.000/0000-00"
                      value={cnpj}
                      onChange={e => setCnpj(e.target.value)}
                    />
                  </div>
                </>
              )}

              {profileType === 'rh' && (
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Nome da Agência
                  </label>
                  <Input
                    placeholder="Ex: Talentos RH Curitiba"
                    value={agencyName}
                    onChange={e => setAgencyName(e.target.value)}
                  />
                </div>
              )}

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
              disabled={
                saving ||
                !fullName.trim() ||
                (profileType === 'provider' && selectedCategoryIds.length === 0) ||
                (profileType === 'provider' && providerSubtype === 'company' && (!legalName.trim() || !cnpj.trim())) ||
                (profileType === 'rh' && !agencyName.trim())
              }
              onClick={handleConfirm}
            >
              {saving ? 'Salvando seu perfil...' : profileType === 'provider' ? 'Avançando automaticamente...' : 'Concluir cadastro'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default SmartOnboardingWizard;
