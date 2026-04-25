/**
 * SmartOnboardingWizard — Esteira linear obrigatória (5 passos).
 *
 * Regras inegociáveis:
 *  1. Não há botão "X" / "fechar". O wizard ocupa a tela inteira.
 *  2. Cada passo persiste no banco (`profiles.onboarding_step`) ao avançar.
 *     Refresh (F5) volta exatamente para o passo atual.
 *  3. `onboarding_completed = true` SÓ é gravado no Passo 5 (conclusão)
 *     E SOMENTE quando os requisitos estruturais reais estiverem preenchidos.
 *     Para provider: pelo menos 1 serviço cadastrado. Pular não burla o gate.
 *  4. "Pular" sempre vai para o próximo passo. Nunca fecha o wizard nem
 *     marca onboarding_completed indevidamente.
 *  5. Provider precisa criar 1 serviço no Passo 4. O Passo 4 inclui também
 *     uma sub-etapa OPCIONAL de criação do primeiro álbum de portfólio,
 *     colocando portfólio na esteira principal (não solto no dashboard).
 *
 * Passos:
 *   1. Identidade (tipo de perfil)
 *   2. Localização + Foto
 *   3. Dados de contato (WhatsApp + bio curta)
 *   4. Primeiro serviço + portfólio inicial (apenas provider)
 *   5. Conclusão
 *
 * Mini-celebrações: cada transição bem-sucedida dispara confete leve
 * via celebrate({intensity:'mini'}) para reforço positivo imediato.
 */
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  Briefcase, UserRound, MapPin, Sparkles, Loader2, ArrowLeft, CheckCircle2,
  PartyPopper, Building2, Megaphone, Camera, Phone, AlertCircle, RefreshCw, Navigation,
  Image as ImageIcon, Plus, Check,
} from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { CELEBRATION_IDS, celebrate } from '@/lib/celebrate';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeoCity } from '@/hooks/useGeoCity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import SmartCategoryPicker from '@/components/SmartCategoryPicker';
import CityAutocomplete from '@/components/CityAutocomplete';
import AvatarUpload from '@/components/AvatarUpload';
import PhoneMaskedInput from '@/components/PhoneMaskedInput';
import ServiceWizard from '@/components/dashboard/ServiceWizard';
import { useCategoriesWithCount } from '@/hooks/useProviders';
import { getSocialAvatarUrl, getInitials } from '@/lib/avatarUtils';
import { formatCityState, safeUF } from '@/lib/locationFormat';
import { isValidCpfCnpj } from '@/lib/cpfCnpj';
import { validateWhatsapp, sanitizePhone, formatPhoneDisplay } from '@/lib/whatsapp';
import CpfCnpjInput, { maskCpfCnpj } from './CpfCnpjInput';



type ProfileType = 'provider' | 'client' | 'rh' | 'sponsor';
type ProviderSubtype = 'autonomous' | 'company';
type WizardStep = 1 | 2 | 3 | 4 | 5;
type WizardDrafts = Partial<Record<WizardStep, Record<string, any>>>;
type AutoSaveAttempt = {
  id: string;
  status: 'success' | 'error';
  attemptedAt: string;
  step: WizardStep;
  fields: string[];
  message: string;
};

type SecureTaxProfile = {
  tax_id: string | null;
  tax_id_kind: string | null;
  tax_id_last4: string | null;
};

const TOTAL_STEPS = 5;

const clampWizardStep = (value: unknown): WizardStep => {
  const parsed = Number(value ?? 1);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(Math.trunc(parsed), 1), TOTAL_STEPS) as WizardStep;
};

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const draftStorageKey = (userId?: string) => `wizard-drafts:${userId ?? 'anonymous'}`;
const hasValidWhatsapp = (value: string) => validateWhatsapp(value).valid;

export type WizardMode = 'basic';

interface SmartOnboardingWizardProps {
  mode?: WizardMode;
}

const SmartOnboardingWizard = (_: SmartOnboardingWizardProps = {}) => <BasicOnboardingWizard />;

const BasicOnboardingWizard = () => {
  const { user, profile, refetchProfile } = useAuth();
  const {
    city: geoCity,
    state: geoState,
    precise: geoPrecise,
    source: geoSource,
    geoFailed,
    requestPreciseLocation,
    dismissGeoFailure,
    setCity: setGeoManualCity,
  } = useGeoCity();
  const { data: categoriesData = [] } = useCategoriesWithCount();
  const navigate = useNavigate();

  // ─── Estado persistido por banco (onboarding_step controla a esteira) ───
  const hasExistingCadastro = !!profile?.profile_type;
  const storedStep = clampWizardStep(profile?.onboarding_step);
  const initialStep = hasExistingCadastro ? storedStep : 1;
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [furthestStep, setFurthestStep] = useState<WizardStep>(initialStep);

  // Tipo de perfil
  const [profileType, setProfileType] = useState<ProfileType | null>(profile?.profile_type ?? null);
  const [providerSubtype, setProviderSubtype] = useState<ProviderSubtype | null>(null);
  const [showSubtypeStep, setShowSubtypeStep] = useState(false);

  // Identidade
  const [fullName, setFullName] = useState(
    (profile?.full_name as string) ||
    (user?.user_metadata?.full_name as string) ||
    user?.email?.split('@')[0] || ''
  );
  const [agencyName, setAgencyName] = useState('');

  // Localização + foto (Passo 2)
  const [city, setCity] = useState((profile?.city as string) || geoCity || '');
  const [state, setState] = useState((profile?.state as string) || geoState || '');
  const [editingCity, setEditingCity] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [neighborhood, setNeighborhood] = useState<string>(((profile as any)?.neighborhood as string) || '');

  // Contato + bio (Passo 3)
  const [whatsapp, setWhatsapp] = useState(sanitizePhone(profile?.whatsapp || profile?.phone || ''));
  const [bio, setBio] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [taxId, setTaxId] = useState<string>(((profile as any)?.tax_id as string) || '');
  const [hasAwardedTaxIdPoints, setHasAwardedTaxIdPoints] = useState(false);
  const [taxIdJustSaved, setTaxIdJustSaved] = useState(false);

  // Provider data
  const [savedProvider, setSavedProvider] = useState<any | null>(null);
  const [servicesCreated, setServicesCreated] = useState(0);
  const [portfolioAlbumsCreated, setPortfolioAlbumsCreated] = useState(0);
  const [creatingAlbum, setCreatingAlbum] = useState(false);

  const [saving, setSaving] = useState(false);
  const [requestingGps, setRequestingGps] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [autoSaveDelay, setAutoSaveDelay] = useState<1000 | 2000 | 3000>(1000);
  const [lastAutoSavePatch, setLastAutoSavePatch] = useState<Record<string, any> | null>(null);
  const [lastFailedAutoSavePatch, setLastFailedAutoSavePatch] = useState<Record<string, any> | null>(null);
  const [lastAutoSaveAttemptAt, setLastAutoSaveAttemptAt] = useState<string | null>(null);
  const [lastAutoSaveError, setLastAutoSaveError] = useState<string | null>(null);
  const [autoSaveAttempts, setAutoSaveAttempts] = useState<AutoSaveAttempt[]>([]);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [drafts, setDrafts] = useState<WizardDrafts>({});
  const [reviewReturnStep, setReviewReturnStep] = useState<WizardStep | null>(null);
  const [reviewAllMode, setReviewAllMode] = useState(false);
  const [guidedReviewStep, setGuidedReviewStep] = useState<WizardStep | null>(null);
  const [showFinalSummary, setShowFinalSummary] = useState(false);
  const lastSavedFingerprintRef = useRef<string | null>(null);
  const latestAutoSaveFingerprintRef = useRef<string | null>(null);
  const autoSaveVersionRef = useRef(0);

  // ─── Modo depuração ───
  // Ativo via ?debug=1 na URL OU localStorage.wizard_debug = '1'.
  // Mostra painel com estado de cada campo + última falha do save (table, code, message, details, hint).
  const debugMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === '1') return true;
      return window.localStorage.getItem('wizard_debug') === '1';
    } catch {
      return false;
    }
  }, []);
  type WizardSaveError = {
    step: WizardStep;
    when: string;
    table: string;
    code?: string;
    message: string;
    details?: string;
    hint?: string;
    payloadKeys?: string[];
    payload?: Record<string, any>;
    field?: string;
    stage?: string;
  };
  const [lastSaveError, setLastSaveError] = useState<WizardSaveError | null>(null);
  const [debugCopied, setDebugCopied] = useState(false);

  // ─── Sync inicial: se profile carrega DEPOIS do mount, atualiza step ───
  const syncedRef = useRef(false);
  useEffect(() => {
    if (syncedRef.current || !profile) return;
    syncedRef.current = true;
    const nextStep = profile.profile_type ? clampWizardStep(profile.onboarding_step) : 1;
    setStep(nextStep);
    setFurthestStep(nextStep);
    if (profile.profile_type) setProfileType(profile.profile_type as ProfileType);
    if (profile.full_name) setFullName(profile.full_name);
    if (profile.city) setCity(profile.city);
    if (profile.state) setState(profile.state);
    if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
    if (profile.whatsapp || profile.phone) setWhatsapp(sanitizePhone(profile.whatsapp || profile.phone || ''));
    if ((profile as any).neighborhood) setNeighborhood((profile as any).neighborhood);
  }, [profile]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const loadSecureTaxId = async () => {
      const { data, error } = await supabase.rpc('get_profile_tax_id', { _profile_id: user.id });
      if (error || cancelled) return;
      const row = Array.isArray(data) ? (data[0] as SecureTaxProfile | undefined) : undefined;
      if (row?.tax_id) {
        setTaxId(row.tax_id);
      }
    };

    void loadSecureTaxId();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ─── Google/social avatar sync (one-shot): copia foto do provedor social para profiles.avatar_url
  // se ainda não houver avatar definido. Guard com ref evita loop.
  const socialAvatarSyncedRef = useRef(false);
  useEffect(() => {
    if (socialAvatarSyncedRef.current) return;
    if (!user?.id || !profile) return;
    if (profile.avatar_url) { socialAvatarSyncedRef.current = true; return; }
    const socialUrl = getSocialAvatarUrl(user);
    if (!socialUrl) return;
    socialAvatarSyncedRef.current = true;
    setAvatarUrl(socialUrl);
    (async () => {
      try {
        await supabase.from('profiles').update({ avatar_url: socialUrl }).eq('id', user.id);
      } catch (err) {
        // silent — UI já mostra a foto e próximo autosave tentará novamente
        console.warn('[onboarding] failed to persist social avatar', err);
      }
    })();
  }, [user, profile]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = window.localStorage.getItem(draftStorageKey(user.id));
      if (raw) setDrafts(JSON.parse(raw));
    } catch { /* ignore invalid draft */ }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      window.localStorage.setItem(draftStorageKey(user.id), JSON.stringify(drafts));
    } catch { /* storage may be unavailable */ }
  }, [user?.id, drafts]);

  // ─── Carrega provider salvo (caso volte ao Passo 4 após F5) ───
  useEffect(() => {
    if (!user?.id || profileType !== 'provider' || savedProvider) return;
    void supabase.from('providers').select('*').eq('user_id', user.id).limit(1)
      .then(({ data }) => {
        if (data && data[0]) {
          setSavedProvider(data[0]);
          if (data[0].id) {
            void supabase.from('services').select('id', { count: 'exact', head: true })
              .eq('provider_id', data[0].id)
              .then(({ count }) => setServicesCreated(count ?? 0));
            void supabase.from('portfolio_albums').select('id', { count: 'exact', head: true })
              .eq('provider_id', data[0].id)
              .then(({ count }) => setPortfolioAlbumsCreated(count ?? 0));
          }
        }
      });
  }, [user?.id, profileType, savedProvider]);

  // ─── Sync geo somente se ainda vazio ───
  useEffect(() => {
    if (!editingCity && geoCity && !city) setCity(geoCity);
    if (geoState && !state) setState(geoState);
  }, [geoCity, geoState, editingCity, city, state]);

  const cityStatusMessage = useMemo(() => {
    if (requestingGps) return 'Buscando sua localização precisa por GPS…';
    if (editingCity && city) return `Cidade selecionada: ${formatCityState(city, state, ' • ')}`;
    if (geoPrecise && geoCity) return `Localização precisa ativa via GPS em ${formatCityState(geoCity, geoState, ' • ')}`;
    if (geoCity && geoSource === 'ip') return `Localização aproximada detectada em ${formatCityState(geoCity, geoState, ' • ')}`;
    if (geoFailed) return 'Não conseguimos detectar automaticamente. Escolha sua cidade manualmente.';
    return 'Escolha sua cidade ou ative o GPS para preencher automaticamente.';
  }, [requestingGps, editingCity, city, state, geoPrecise, geoCity, geoState, geoSource, geoFailed]);

  const handleUsePreciseLocation = async () => {
    setRequestingGps(true);
    try {
      const result = await requestPreciseLocation({ force: true });
      if (result.ok) {
        // Sincroniza explicitamente o estado local do wizard com o que o GPS resolveu,
        // mesmo que o usuário já tivesse uma cidade preenchida (manual ou aproximada).
        if (result.city) setCity(result.city);
        if (result.state) setState(result.state);
        toast.success(`Localização precisa ativada${result.city ? `: ${result.city}` : ''}.`);
        dismissGeoFailure();
        setEditingCity(false);
        window.setTimeout(handleStepFieldBlur, 0);
      } else {
        toast.error('Não foi possível obter sua localização por GPS agora. Você pode escolher a cidade manualmente.');
        setEditingCity(true);
      }
    } finally {
      setRequestingGps(false);
    }
  };

  const categoriesForPicker = categoriesData.map((c: any) => ({
    id: c.id, name: c.name, icon: c.icon, slug: c.slug, parent_id: c.parent_id,
  }));

  // ─── Persistência segura ao avançar ───
  const persistStep = async (nextStep: WizardStep, extraPatch: Record<string, any> = {}) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase.from('profiles').update({
        onboarding_step: nextStep,
        onboarding_completed: false,
        ...extraPatch,
      } as any).eq('id', user.id);
      if (error) throw error;
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[Wizard] persistStep falhou', err);
    }
  };

  const saveAutoSavePatch = async (patch: Record<string, any>) => {
    if (!user?.id) return;
    const fingerprint = JSON.stringify(patch);
    const attemptedAt = new Date().toISOString();
    const fields = Object.keys(patch).filter(key => !['onboarding_completed', 'onboarding_step'].includes(key));
    latestAutoSaveFingerprintRef.current = fingerprint;
    setAutoSaveStatus('saving');
    setLastAutoSavePatch(patch);
    setLastAutoSaveAttemptAt(attemptedAt);
    setLastAutoSaveError(null);
    try {
      const { error } = await supabase.from('profiles').update(patch as any).eq('id', user.id);
      if (error) throw error;
      const attempt: AutoSaveAttempt = { id: `${attemptedAt}-ok`, status: 'success', attemptedAt, step, fields, message: 'Salvo automaticamente' };
      setAutoSaveAttempts(prev => [attempt, ...prev].slice(0, 5));
      setLastFailedAutoSavePatch(null);
      lastSavedFingerprintRef.current = fingerprint;
      if (latestAutoSaveFingerprintRef.current === fingerprint) {
        setHasPendingChanges(false);
        setAutoSaveStatus('idle');
      }
    } catch (err: any) {
      if (latestAutoSaveFingerprintRef.current === fingerprint) {
        const message = err?.message || 'Não foi possível sincronizar suas alterações agora.';
        setAutoSaveStatus('error');
        setHasPendingChanges(true);
        setLastAutoSaveError(message);
        setLastFailedAutoSavePatch(patch);
        const attempt: AutoSaveAttempt = { id: `${attemptedAt}-error`, status: 'error', attemptedAt, step, fields, message };
        setAutoSaveAttempts(prev => [attempt, ...prev].slice(0, 5));
      }
    }
  };

  const retryAutoSave = () => {
    const failedPatch = lastFailedAutoSavePatch ?? lastAutoSavePatch;
    if (failedPatch) void saveAutoSavePatch(failedPatch);
  };

  const currentStepDraft = (targetStep: WizardStep = step): Record<string, any> => ({
    step: targetStep,
    profile_type: profileType,
    provider_subtype: providerSubtype,
    full_name: fullName,
    agency_name: agencyName,
    city,
    state,
    avatar_url: avatarUrl,
    whatsapp,
    bio,
    tax_id: taxId,
    selected_category_ids: selectedCategoryIds,
    services_created: servicesCreated,
    saved_at: new Date().toISOString(),
  });

  const currentProfilePatch = (): Record<string, any> => {
    const patch: Record<string, any> = { onboarding_completed: false };
    patch.avatar_url = avatarUrl;
    patch.full_name = fullName.trim() || null;
    patch.whatsapp = whatsapp || null;
    patch.phone = whatsapp || null;
    // Persistência expandida: bio + cidade + estado + categorias agora vão para o banco
    // (antes ficavam só no localStorage, perdiam ao trocar de device).
    if (bio && bio.trim()) patch.bio = bio.trim();
    if (city) patch.city = city;
    if (state) patch.state = state;
    if (selectedCategoryIds && selectedCategoryIds.length > 0) {
      patch.preferred_category_ids = selectedCategoryIds;
    }
    if (!selectedCategoryIds?.length) {
      patch.preferred_category_ids = [];
    }
    if (profileType) {
      patch.profile_type = profileType;
      patch.role = profileType;
    }
    return patch;
  };

  const buildAutoSavePatch = (): Record<string, any> => ({
    ...currentProfilePatch(),
    onboarding_step: Math.max(furthestStep, step),
  });

  const flushAutoSave = async () => {
    if (!user?.id || saving) return;
    const patch = buildAutoSavePatch();
    const fingerprint = JSON.stringify(patch);
    if (fingerprint === lastSavedFingerprintRef.current && autoSaveStatus !== 'error') return;
    saveStepDraft(step);
    await saveAutoSavePatch(patch);
  };

  const advanceTo = async (nextStep: WizardStep, extraPatch: Record<string, any> = {}) => {
    await flushAutoSave();
    const isForward = nextStep > step;
    setFurthestStep(prev => Math.max(prev, nextStep) as WizardStep);
    setStep(nextStep);
    await persistStep(nextStep, extraPatch);
    // Mini-celebração ao avançar (não ao voltar/revisar)
    if (isForward && user?.id) {
      try {
        celebrate({
          intensity: 'mini',
          id: `wizard-step-${nextStep}:${user.id}`,
        });
      } catch { /* noop */ }
    }
  };

  const saveStepDraft = (targetStep: WizardStep = step) => {
    setDrafts(prev => ({ ...prev, [targetStep]: currentStepDraft(targetStep) }));
  };

  const reloadSavedFields = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, whatsapp, phone, profile_type, onboarding_step, bio, city, state, preferred_category_ids')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      toast.error('Não foi possível recarregar os campos salvos.');
      return;
    }

    const savedProfile = data as any;
    let savedCity = savedProfile.city || '';
    let savedState = savedProfile.state || '';
    const secureTaxResponse = await supabase.rpc('get_profile_tax_id', { _profile_id: user.id });
    const secureTaxRow = Array.isArray(secureTaxResponse.data)
      ? (secureTaxResponse.data[0] as SecureTaxProfile | undefined)
      : undefined;

    setFullName(savedProfile.full_name || '');
    setCity(savedCity);
    setState(savedState);
    setAvatarUrl(savedProfile.avatar_url || null);
    setWhatsapp(sanitizePhone(savedProfile.whatsapp || savedProfile.phone || ''));
    setBio(savedProfile.bio || '');
    setSelectedCategoryIds(Array.isArray(savedProfile.preferred_category_ids) ? savedProfile.preferred_category_ids : []);
    setTaxId(secureTaxRow?.tax_id || '');
    if (savedProfile.profile_type) setProfileType(savedProfile.profile_type as ProfileType);
    const savedStep = clampWizardStep(savedProfile.onboarding_step);
    setStep(savedStep);
    setFurthestStep(savedStep);
    setAutoSaveStatus('idle');
    setHasPendingChanges(false);
    setLastAutoSaveError(null);
    lastSavedFingerprintRef.current = JSON.stringify({
      onboarding_completed: false,
      city: savedCity || null,
      state: savedState || null,
      avatar_url: savedProfile.avatar_url || null,
      full_name: savedProfile.full_name || null,
      whatsapp: savedProfile.whatsapp || savedProfile.phone || null,
      phone: savedProfile.whatsapp || savedProfile.phone || null,
      ...(savedProfile.profile_type ? { profile_type: savedProfile.profile_type, role: savedProfile.profile_type } : {}),
      onboarding_step: savedStep,
    });
    toast.success('Campos salvos recarregados.');
  };

  const handleStepFieldBlur = () => {
    void flushAutoSave();
  };

  // ─── Auto-save com debounce: mantém o último passo e dados parciais salvos ───
  useEffect(() => {
    if (!user?.id || !profile || saving) return;

    const patch: Record<string, any> = buildAutoSavePatch();
    const fingerprint = JSON.stringify(patch);
    if (fingerprint === lastSavedFingerprintRef.current && autoSaveStatus !== 'error') return;

    const version = autoSaveVersionRef.current + 1;
    autoSaveVersionRef.current = version;
    setDrafts(prev => ({ ...prev, [step]: currentStepDraft(step) }));
    setHasPendingChanges(true);
    if (autoSaveStatus !== 'error') setAutoSaveStatus('idle');

    const timer = window.setTimeout(() => {
      if (version !== autoSaveVersionRef.current) return;
      void saveAutoSavePatch(patch);
    }, autoSaveDelay);

    return () => window.clearTimeout(timer);
    // furthestStep removido das deps: já é capturado dentro de buildAutoSavePatch
    // e mudanças nele junto com `step` causariam double-save em advanceTo.
  }, [user?.id, profile, step, city, state, avatarUrl, fullName, whatsapp, bio, agencyName, selectedCategoryIds, profileType, saving, autoSaveDelay]);

  useEffect(() => {
    const hasPendingAutoSave = autoSaveStatus === 'saving' || autoSaveStatus === 'error';
    if (!hasPendingAutoSave) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [autoSaveStatus]);

  // Quando provider termina o wizard de serviços, marcamos +1 e mantemos
  // o usuário no Passo 4 para a sub-etapa de portfólio.
  const handleServiceCreated = async (_id: string) => {
    setServicesCreated(c => c + 1);
    toast.success('Serviço cadastrado!', { description: 'Agora vamos adicionar seu primeiro álbum de portfólio.' });
    if (user?.id) {
      try {
        celebrate({ intensity: 'mini', id: `wizard-service-created:${user.id}` });
      } catch { /* noop */ }
    }
    // Permanece no Passo 4: o card de portfólio aparece logo abaixo.
  };

  // Cria o primeiro álbum de portfólio direto no wizard (Passo 4 sub-etapa).
  const handleCreateFirstAlbum = async (title: string) => {
    if (!savedProvider?.id || !user?.id) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error('Dê um nome para o álbum.');
      return;
    }
    setCreatingAlbum(true);
    try {
      const albumSlug = slugify(cleanTitle) || `album-${Date.now()}`;
      const { error } = await (supabase as any).from('portfolio_albums').insert({
        provider_id: savedProvider.id,
        title: cleanTitle,
        slug: albumSlug,
      });
      if (error) throw error;
      setPortfolioAlbumsCreated(c => c + 1);
      toast.success('Álbum criado!', { description: 'Você poderá adicionar fotos no Dashboard a qualquer momento.' });
      try {
        celebrate({ intensity: 'mini', id: `wizard-first-album:${user.id}` });
      } catch { /* noop */ }
    } catch (err: any) {
      console.error('[Wizard album]', err);
      toast.error(err?.message || 'Não foi possível criar o álbum.');
    } finally {
      setCreatingAlbum(false);
    }
  };

  // ─── Passo 1: Identidade ───
  const handleSelectType = async (type: ProfileType) => {
    setProfileType(type);
    if (type === 'provider') {
      setShowSubtypeStep(true);
      return;
    }
    await advanceTo(2, { profile_type: type, role: type });
  };

  const handleSelectSubtype = async (sub: ProviderSubtype) => {
    setProviderSubtype(sub);
    setShowSubtypeStep(false);
    await advanceTo(2, { profile_type: 'provider', role: 'provider' });
  };

  const handleContinueProfileUpdate = async () => {
    const resumeStep = hasExistingCadastro ? storedStep : 2;
    await advanceTo(resumeStep, profileType ? { profile_type: profileType, role: profileType } : {});
  };

  const reviewStep = (targetStep: WizardStep) => {
    if (targetStep > furthestStep) return;
    saveStepDraft(step);
    if (targetStep < furthestStep) setReviewReturnStep(furthestStep);
    setShowFinalSummary(false);
    setStep(targetStep);
  };

  const returnToProgress = async () => {
    saveStepDraft(step);
    const target = reviewReturnStep ?? furthestStep;
    setReviewReturnStep(null);
    setStep(target);
    await persistStep(furthestStep, currentProfilePatch());
  };

  const startReviewAll = () => {
    saveStepDraft(step);
    setReviewAllMode(true);
    setGuidedReviewStep(null);
    setShowFinalSummary(false);
    const firstPending = checklistItems.find(item => item.step <= furthestStep && item.step >= step)?.step ?? 1;
    setStep(firstPending);
  };

  const startGuidedReview = () => {
    saveStepDraft(step);
    setReviewAllMode(false);
    setShowFinalSummary(false);
    setGuidedReviewStep(1);
  };

  const editGuidedReviewStep = (targetStep: WizardStep) => {
    setReviewReturnStep(furthestStep);
    setGuidedReviewStep(null);
    setShowFinalSummary(false);
    setStep(targetStep);
  };

  const keepGuidedReviewStep = () => {
    const next = checklistItems.find(item => item.step > (guidedReviewStep ?? 1) && item.step <= furthestStep)?.step;
    if (next) {
      setGuidedReviewStep(next);
      return;
    }
    setGuidedReviewStep(null);
    setShowFinalSummary(true);
  };

  const goPrevGuidedReviewStep = () => {
    const current = guidedReviewStep ?? 1;
    const prev = [...checklistItems].reverse().find(item => item.step < current)?.step;
    if (prev) {
      setGuidedReviewStep(prev);
    }
  };

  const continueReviewAll = () => {
    saveStepDraft(step);
    const next = checklistItems.find(item => item.step > step && item.step <= furthestStep)?.step;
    if (next) {
      setStep(next);
      return;
    }
    setShowFinalSummary(true);
    setReviewAllMode(false);
  };

  // ─── Validação unificada por passo ───
  // Cada problema retorna { field, message } — o painel/inline destacam o campo exato
  // e o botão "Continuar" só fica liberado quando errors está vazio.
  type WizardFieldError = { field: string; message: string };
  const validateStep = (target: WizardStep): WizardFieldError[] => {
    const errors: WizardFieldError[] = [];
    if (target === 1) {
      if (!profileType) errors.push({ field: 'profileType', message: 'Escolha o tipo de perfil.' });
      if (profileType === 'provider' && !providerSubtype) {
        errors.push({ field: 'providerSubtype', message: 'Indique se o cadastro é como Pessoa Física ou Empresa/PJ.' });
      }
    }
    if (target === 2) {
      if (!city.trim()) errors.push({ field: 'city', message: 'Informe sua cidade.' });
      if (!safeUF(state)) errors.push({ field: 'state', message: 'Selecione o estado (UF).' });
    }
    if (target === 3) {
      if (!fullName.trim()) errors.push({ field: 'fullName', message: 'Informe seu nome completo.' });
      const wa = validateWhatsapp(whatsapp);
      if (!wa.valid) errors.push({ field: 'whatsapp', message: wa.message });
      if (profileType === 'provider' && selectedCategoryIds.length === 0) {
        errors.push({ field: 'category', message: 'Selecione a categoria principal do seu serviço.' });
      }
      if (profileType === 'rh' && !agencyName.trim()) {
        errors.push({ field: 'agencyName', message: 'Informe o nome da agência.' });
      }
      // Tax-id: obrigatório só se preenchido — bloqueia se inválido
      const td = (taxId || '').replace(/\D/g, '');
      if (td.length > 0) {
        const expected = profileType === 'provider' && providerSubtype === 'company' ? 14 : 11;
        if (td.length !== expected || !isValidCpfCnpj(td)) {
          errors.push({ field: 'taxId', message: `${expected === 14 ? 'CNPJ' : 'CPF'} inválido — confira ou deixe em branco.` });
        }
      }
    }
    return errors;
  };
  const stepErrors = useMemo(() => validateStep(step), [step, profileType, providerSubtype, city, state, fullName, whatsapp, selectedCategoryIds, agencyName, taxId]);
  const errorByField = useMemo(() => Object.fromEntries(stepErrors.map(e => [e.field, e.message])), [stepErrors]);

  // ─── Passo 2: Localização + Foto ───
  const canAdvanceFromStep2 = validateStep(2).length === 0;
  const handleStep2Next = async () => {
    const errs = validateStep(2);
    if (errs.length > 0) {
      toast.error(errs[0].message, errs.length > 1 ? { description: `+${errs.length - 1} campo(s) pendente(s)` } : undefined);
      return;
    }
    await advanceTo(3, {
      city: city || null,
      state: state || null,
      avatar_url: avatarUrl,
      neighborhood: neighborhood.trim() || null,
    } as any);
  };

  // ─── Passo 3: Dados de contato + bio + (provider) categoria ───
  const canAdvanceFromStep3 = validateStep(3).length === 0;

  const handleStep3Next = async () => {
    const errs = validateStep(3);
    if (errs.length > 0) {
      toast.error(errs[0].message, errs.length > 1 ? { description: `+${errs.length - 1} campo(s) pendente(s)` } : undefined);
      return;
    }
    if (!user?.id) return;
    const taxIdDigits = (taxId || '').replace(/\D/g, '');
    setSaving(true);
    setLastSaveError(null);
    let currentTable: string = 'profiles';
    let currentStage: string = 'init';
    let currentPayload: Record<string, any> = {};
    let currentField: string | undefined;
    try {
      const hadTaxIdBefore = !!((profile as any)?.tax_id_last4) || !!taxId.trim();

      currentTable = 'profiles';
      currentStage = 'profiles.update';
      const profilesPayload = {
        full_name: fullName.trim(),
        whatsapp,
        phone: whatsapp,
        profile_type: profileType,
        role: profileType,
        bio: bio.trim() || null,
        city: city || null,
        state: state || null,
        neighborhood: neighborhood.trim() || null,
        preferred_category_ids: profileType === 'provider' ? selectedCategoryIds : [],
        onboarding_step: 4,
      };
      currentPayload = profilesPayload;
      const { error: profileError } = await supabase.from('profiles').update(profilesPayload as any).eq('id', user.id);
      if (profileError) throw profileError;

      currentTable = 'rpc:set_profile_tax_id';
      currentStage = 'rpc.set_profile_tax_id';
      currentField = 'taxId';
      currentPayload = { _tax_id: taxIdDigits || null };
      const { error: taxError } = await supabase.rpc('set_profile_tax_id', {
        _tax_id: taxIdDigits || null,
      });
      if (taxError) throw taxError;
      currentField = undefined;
      if (taxIdDigits) {
        setTaxIdJustSaved(true);
        toast.success(`${taxIdDigits.length === 14 ? 'CNPJ' : 'CPF'} salvo com segurança.`);
      }

      if (taxIdDigits && !hadTaxIdBefore && !hasAwardedTaxIdPoints) {
        await (supabase as any).rpc('award_engagement_points', {
          _user_id: user.id,
          _action_key: 'profile_tax_id_added',
          _metadata: {
            source: 'onboarding_wizard',
            tax_id_kind: taxIdDigits.length === 14 ? 'cnpj' : 'cpf',
          },
        }).catch(() => undefined);
        setHasAwardedTaxIdPoints(true);
      }

      // Garante registro provider/agency conforme tipo
      if (profileType === 'provider') {
        currentTable = 'providers';
        currentStage = 'providers.lookup';
        const { data: existing } = await supabase.from('providers').select('*').eq('user_id', user.id).limit(1);
        if (existing && existing[0]) {
          currentStage = 'providers.update';
          const updPayload = {
            city: city || existing[0].city,
            state: state || existing[0].state,
            neighborhood: neighborhood.trim() || existing[0].neighborhood,
            description: bio || existing[0].description,
            whatsapp: whatsapp || existing[0].whatsapp,
            category_id: selectedCategoryIds[0] || existing[0].category_id,
            account_type: providerSubtype || existing[0].account_type || 'autonomous',
          };
          currentPayload = updPayload;
          const { error: updErr } = await supabase.from('providers').update(updPayload as any).eq('id', existing[0].id);
          if (updErr) throw updErr;
          setSavedProvider({ ...existing[0], city, state, neighborhood: neighborhood.trim() || existing[0].neighborhood, description: bio, whatsapp, category_id: selectedCategoryIds[0], account_type: providerSubtype || 'autonomous' });
        } else {
          currentStage = 'providers.insert';
          const baseSlug = slugify(fullName || user.email?.split('@')[0] || 'profissional');
          const insPayload = {
            user_id: user.id,
            slug: `${baseSlug}-${user.id.slice(0, 6)}`,
            city: city || null,
            state: state || null,
            neighborhood: neighborhood.trim() || null,
            description: bio || null,
            whatsapp: whatsapp || null,
            category_id: selectedCategoryIds[0] || null,
            account_type: providerSubtype || 'autonomous',
            status: 'pending',
          };
          currentPayload = insPayload;
          const { data: created, error } = await supabase.from('providers').insert(insPayload as any).select('*').single();
          if (error) throw error;
          setSavedProvider(created);
        }
      } else if (profileType === 'rh') {
        currentTable = 'agencies';
        currentStage = 'agencies.lookup';
        const { data: existing } = await (supabase as any).from('agencies').select('*').eq('user_id', user.id).limit(1);
        if (!existing || existing.length === 0) {
          currentStage = 'agencies.insert';
          const baseSlug = slugify(agencyName || fullName || 'agencia');
          const insPayload = {
            user_id: user.id,
            slug: `${baseSlug}-${user.id.slice(0, 6)}`,
            name: agencyName.trim() || fullName.trim() || 'Minha Agência',
            city: city || null,
            state: state || null,
            status: 'pending',
          };
          currentPayload = insPayload;
          const { error: insErr } = await (supabase as any).from('agencies').insert(insPayload);
          if (insErr) throw insErr;
        }
      }

      await refetchProfile();
      toast.success('Dados salvos com sucesso.');

      // Provider passa pelo Passo 4 obrigatoriamente. Demais tipos vão direto p/ 5.
      if (profileType === 'provider') {
        setStep(4);
      } else {
        await finishOnboarding();
      }
    } catch (err: any) {
      console.error('[Wizard step 3]', { table: currentTable, stage: currentStage, payload: currentPayload, err });
      const message = String(err?.message || err?.error_description || 'Erro desconhecido');
      const details = err?.details ? String(err.details) : undefined;
      const hint = err?.hint ? String(err.hint) : undefined;
      const code = err?.code ? String(err.code) : undefined;
      // Mapeia mensagem do Postgres para campo provável
      const lower = `${message} ${details || ''}`.toLowerCase();
      let inferredField = currentField;
      if (!inferredField) {
        if (lower.includes('whatsapp') || lower.includes('phone')) inferredField = 'whatsapp';
        else if (lower.includes('full_name') || lower.includes('"name"')) inferredField = 'fullName';
        else if (lower.includes('city')) inferredField = 'city';
        else if (lower.includes('state')) inferredField = 'state';
        else if (lower.includes('neighborhood')) inferredField = 'neighborhood';
        else if (lower.includes('category')) inferredField = 'category';
        else if (lower.includes('tax') || lower.includes('cpf') || lower.includes('cnpj')) inferredField = 'taxId';
        else if (lower.includes('slug')) inferredField = 'slug';
      }
      setLastSaveError({
        step: 3,
        when: new Date().toISOString(),
        table: currentTable,
        stage: currentStage,
        code,
        message,
        details,
        hint,
        payloadKeys: Object.keys(currentPayload),
        payload: currentPayload,
        field: inferredField,
      });
      const friendly = inferredField
        ? `Erro no campo ${inferredField}.`
        : `Erro durante ${currentStage}.`;
      toast.error(`Não foi possível salvar (${currentTable}).`, {
        description: `${friendly}${code ? ` [${code}]` : ''} — ${String(message).slice(0, 180)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSkipStep3 = async () => {
    toast.info('Você pode completar estes dados depois no dashboard.');
    await advanceTo(profileType === 'provider' ? 4 : 5);
  };

  // ─── Passo 4: Primeiro serviço (provider apenas) ───
  // PULAR não pode burlar o gate. Avança visualmente para o Passo 5,
  // mas onboarding_completed permanece false até existir 1 serviço real.
  const handleSkipStep4 = async () => {
    // Hard Save: para PROVIDER exigimos 1 serviço criado antes de avançar à Revisão.
    // O create_service_atomic é executado dentro do ServiceWizard e só então
    // servicesCreated > 0, liberando a transição para o Passo 5.
    if (profileType === 'provider' && servicesCreated < 1) {
      toast.error('Cadastre 1 serviço para continuar.', {
        description: 'Seu perfil só fica visível para clientes quando há pelo menos um serviço publicado. Os dados já preenchidos foram mantidos.',
      });
      return;
    }
    await advanceTo(5);
  };

  const stepEstimateMinutes: Record<WizardStep, number> = {
    1: profileType ? 0 : 1,
    2: Math.max(0, 3 - (city ? 1 : 0) - (state ? 1 : 0) - (avatarUrl ? 1 : 0)),
    3: Math.max(0, 4 - (fullName.trim() ? 1 : 0) - (hasValidWhatsapp(whatsapp) ? 1 : 0) - (bio.trim() ? 1 : 0) - (profileType !== 'provider' || selectedCategoryIds.length ? 1 : 0) - (profileType !== 'rh' || agencyName.trim() ? 1 : 0)),
    4: profileType !== 'provider' || servicesCreated > 0 ? 0 : 3,
    5: 1,
  };

  const stepEstimates: Record<WizardStep, string> = Object.fromEntries(
    Object.entries(stepEstimateMinutes).map(([key, minutes]) => [Number(key), minutes <= 0 ? 'Pronto' : `~${minutes} min`])
  ) as Record<WizardStep, string>;

  const reviewItems = buildReviewItems({ profileType, providerSubtype, city, state, avatarUrl, fullName, agencyName, whatsapp, bio, selectedCategoryIds, servicesCreated });

  // Resumo final compacto: NÃO repete perguntas já confirmadas (tipo de perfil, PF/PJ).
  // Mostra apenas os dados úteis para o usuário conferir antes de concluir.
  const summaryItems = [
    { label: 'Localização', value: formatCityState(city, state, ' • ') || 'Não informada' },
    ...(neighborhood.trim() ? [{ label: 'Bairro', value: neighborhood.trim() }] : []),
    { label: 'Nome', value: fullName || 'Não informado' },
    { label: 'WhatsApp', value: validateWhatsapp(whatsapp).valid ? formatPhoneDisplay(whatsapp) : 'Não informado' },
    ...(profileType === 'provider'
      ? [{ label: 'Serviços', value: `${servicesCreated} cadastrado(s)` }]
      : []),
  ];

  // ─── Passo 5: Conclusão ───
  // Regra estrutural: para PROVIDER, onboarding_completed=true SOMENTE se
  // já existe 1 serviço cadastrado. Caso contrário, marca step=5 mas
  // onboarding_completed=false — o OnboardingGate continuará trazendo o
  // usuário de volta ao wizard até que ele cumpra o requisito mínimo.
  const finishOnboarding = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      // ─── REVALIDAÇÃO CONTRA O BACKEND ANTES DE CONCLUIR ───
      // Garante que a tela de revisão reflete a verdade do banco e impede
      // marcação de onboarding_completed sem que os dados estejam realmente salvos.
      const [{ data: backendProfile }, { count: realServiceCount }] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, whatsapp, city, state, profile_type, preferred_category_ids')
          .eq('id', user.id)
          .maybeSingle(),
        profileType === 'provider' && savedProvider?.id
          ? supabase
              .from('services')
              .select('id', { count: 'exact', head: true })
              .eq('provider_id', savedProvider.id)
          : Promise.resolve({ count: 0 } as any),
      ]);

      const backendOk =
        !!backendProfile?.full_name &&
        !!backendProfile?.whatsapp &&
        !!backendProfile?.city &&
        !!backendProfile?.state &&
        !!backendProfile?.profile_type;
      const realCount = Number(realServiceCount ?? 0);
      const meetsStructuralMinimum = backendOk && (profileType !== 'provider' || realCount >= 1);

      if (!backendOk) {
        toast.error('Alguns dados não foram salvos no servidor.', {
          description: 'Volte ao passo correspondente para reenviar antes de concluir.',
        });
        setSaving(false);
        return;
      }

      // Sincroniza contador local com o real do backend (evita resumo enganoso).
      if (profileType === 'provider' && realCount !== servicesCreated) {
        setServicesCreated(realCount);
      }

      await supabase.from('profiles').update({
        onboarding_completed: meetsStructuralMinimum,
        onboarding_step: 5,
      } as any).eq('id', user.id);

      try {
        await (supabase as any).rpc('award_engagement_points', {
          _user_id: user.id,
          _action_key: 'onboarding_basic_complete',
          _metadata: { profile_type: profileType },
        });
      } catch { /* silent */ }

      if (meetsStructuralMinimum) {
        try {
          celebrate({ intensity: 'big', id: CELEBRATION_IDS.onboardingComplete(user.id) });
        } catch { /* noop */ }
      } else {
        toast.warning('Cadastre pelo menos 1 serviço para liberar o dashboard completo.');
      }

      await refetchProfile();

      // Se não cumpriu mínimo, mantém no wizard (gate trará de volta de qualquer forma).
      if (!meetsStructuralMinimum) {
        setSaving(false);
        return;
      }

      const target = profileType === 'rh' ? '/dashboard/vagas'
        : profileType === 'sponsor' ? '/quero-ser-patrocinador'
        : profileType === 'client' ? '/'
        : '/dashboard?welcome=1';
      navigate(target, { replace: true });
    } catch (err) {
      console.error('[Wizard finish]', err);
      toast.error('Erro ao concluir cadastro.');
    } finally {
      setSaving(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER — único container fullscreen, sem botão de fechar
  // ═══════════════════════════════════════════════════════════════════
  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);
  const savedBadge =
    autoSaveStatus === 'saved' ? { text: '✓ Salvo', tone: 'text-accent' as const }
    : autoSaveStatus === 'saving' ? { text: 'Salvando…', tone: 'text-muted-foreground' as const }
    : autoSaveStatus === 'error' ? { text: 'Falha ao salvar', tone: 'text-destructive' as const }
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {saving && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center gap-4 bg-background/90 backdrop-blur-md">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
          <p className="text-base font-bold text-foreground">Salvando…</p>
        </div>
      )}

      {debugMode && (
        <div className="fixed bottom-2 right-2 z-[120] max-h-[60vh] w-[340px] max-w-[95vw] overflow-auto rounded-lg border-2 border-amber-500 bg-zinc-900/95 p-3 text-[10px] font-mono text-amber-100 shadow-2xl">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-amber-500/40 pb-1">
            <span className="font-bold uppercase tracking-wider text-amber-300">Wizard Debug</span>
            <button
              type="button"
              onClick={() => { try { window.localStorage.removeItem('wizard_debug'); } catch {} window.location.search = ''; }}
              className="rounded bg-amber-500/20 px-2 py-0.5 text-[9px] hover:bg-amber-500/40"
            >Fechar</button>
          </div>
          <div className="space-y-1">
            <div><span className="text-amber-300">step:</span> {step} / furthest: {furthestStep}</div>
            <div><span className="text-amber-300">profileType:</span> {String(profileType)} ({providerSubtype || '—'})</div>
            <div className={fullName.trim() ? 'text-emerald-300' : 'text-rose-300'}>fullName: {fullName ? '✓ "' + fullName + '"' : '✗ vazio'}</div>
            <div className={city ? 'text-emerald-300' : 'text-rose-300'}>city: {city ? '✓ ' + city : '✗ vazio'}</div>
            <div className={safeUF(state) ? 'text-emerald-300' : 'text-rose-300'}>state: {state ? (safeUF(state) ? '✓ ' + safeUF(state) : '✗ inválido "' + state + '"') : '✗ vazio (UF)'}</div>
            <div className={neighborhood.trim() ? 'text-emerald-300' : 'text-amber-300'}>neighborhood: {neighborhood.trim() ? '✓ ' + neighborhood : '— (opcional)'}</div>
            <div className={validateWhatsapp(whatsapp).valid ? 'text-emerald-300' : 'text-rose-300'}>
              whatsapp: {whatsapp ? whatsapp : '✗ vazio'} {!validateWhatsapp(whatsapp).valid && `(${validateWhatsapp(whatsapp).reason})`}
            </div>
            <div className={(profileType !== 'provider' || selectedCategoryIds.length > 0) ? 'text-emerald-300' : 'text-rose-300'}>
              category: {selectedCategoryIds.length || 0} selecionada(s)
            </div>
            <div><span className="text-amber-300">taxId len:</span> {(taxId || '').replace(/\D/g, '').length}</div>
            <div><span className="text-amber-300">canAdvance:</span> step2={String(canAdvanceFromStep2)} · step3={String(canAdvanceFromStep3)}</div>
            <div><span className="text-amber-300">saving:</span> {String(saving)}</div>
            {stepErrors.length > 0 && (
              <div className="mt-1 rounded border border-rose-400/60 bg-rose-950/30 p-1.5">
                <div className="font-bold text-rose-300">Erros do passo {step}:</div>
                {stepErrors.map((e, i) => (
                  <div key={i} className="text-rose-100">· {e.field}: {e.message}</div>
                ))}
              </div>
            )}
          </div>
          {lastSaveError && (
            <div className="mt-2 rounded border border-rose-400/60 bg-rose-950/40 p-2 text-rose-100">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-rose-300">Último erro de save</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = JSON.stringify({
                        step: lastSaveError.step,
                        when: lastSaveError.when,
                        table: lastSaveError.table,
                        stage: lastSaveError.stage,
                        field: lastSaveError.field,
                        code: lastSaveError.code,
                        message: lastSaveError.message,
                        details: lastSaveError.details,
                        hint: lastSaveError.hint,
                        payload: lastSaveError.payload,
                      }, null, 2);
                      await navigator.clipboard.writeText(text);
                      setDebugCopied(true);
                      setTimeout(() => setDebugCopied(false), 1800);
                    } catch {
                      toast.error('Não foi possível copiar.');
                    }
                  }}
                  className="rounded bg-rose-500/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-50 hover:bg-rose-500/50"
                >{debugCopied ? '✓ copiado' : 'copiar payload'}</button>
              </div>
              <div className="mt-1">step: {lastSaveError.step} · {new Date(lastSaveError.when).toLocaleTimeString()}</div>
              <div>table: <span className="text-amber-300">{lastSaveError.table}</span></div>
              {lastSaveError.stage && <div>stage: <span className="text-amber-300">{lastSaveError.stage}</span></div>}
              {lastSaveError.field && <div>field: <span className="text-amber-300">{lastSaveError.field}</span></div>}
              {lastSaveError.code && <div>code: {lastSaveError.code}</div>}
              <div>message: {lastSaveError.message}</div>
              {lastSaveError.details && <div>details: {lastSaveError.details}</div>}
              {lastSaveError.hint && <div>hint: {lastSaveError.hint}</div>}
              {lastSaveError.payloadKeys && <div>payload keys: [{lastSaveError.payloadKeys.join(', ')}]</div>}
            </div>
          )}
          <div className="mt-2 text-[9px] text-amber-300/60">
            ?debug=1 OU localStorage.setItem('wizard_debug','1')
          </div>
        </div>
      )}

      {/* Área scrollável do conteúdo, com padding inferior para não ficar atrás do footer fixo */}
      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4 sm:pt-6">
        <div className="relative mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
          {/* Indicador compacto do passo (a barra principal foi para o rodapé fixo) */}
          <div className="mb-4 flex items-center justify-between text-[11px] font-semibold">
            <span className="text-muted-foreground">Passo {step} de {TOTAL_STEPS}</span>
            <motion.span
              key={step}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-accent"
            >
              {progressPercent}% concluído
            </motion.span>
          </div>

        <WizardChecklist
          currentStep={step}
          furthestStep={furthestStep}
          estimates={stepEstimates}
          onReview={reviewStep}
          onReviewAll={startReviewAll}
        />

        {reviewReturnStep && !showFinalSummary && (
          <div className="mb-4 rounded-xl border border-accent/25 bg-accent/10 p-3 text-sm text-foreground">
            <p className="font-bold">Revisando passo anterior</p>
            <p className="mt-1 text-xs text-muted-foreground">Suas alterações ficam salvas. Continue ou volte para o painel quando quiser.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" size="sm" onClick={returnToProgress}>
                Voltar ao progresso
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setReviewReturnStep(null); navigate('/dashboard', { replace: true }); }}>
                Ir para o Dashboard
              </Button>
            </div>
          </div>
        )}

        {reviewAllMode && !showFinalSummary && (
          <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3 text-sm text-foreground">
            <p className="font-bold">Revisar tudo</p>
            <p className="mt-1 text-xs text-muted-foreground">Confira este passo e avance para o próximo item disponível.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={continueReviewAll}>
              Próximo item da revisão
            </Button>
          </div>
        )}

        {showFinalSummary && (
          <ReviewSummaryCard items={summaryItems} onBack={() => setShowFinalSummary(false)} onFinish={finishOnboarding} saving={saving} />
        )}

        {guidedReviewStep && !showFinalSummary && (
          <GuidedReviewCard
            step={guidedReviewStep}
            items={reviewItems[guidedReviewStep] ?? []}
            onEdit={() => editGuidedReviewStep(guidedReviewStep)}
            onKeep={keepGuidedReviewStep}
            onPrev={goPrevGuidedReviewStep}
            canGoPrev={guidedReviewStep > 1}
          />
        )}

        {!showFinalSummary && hasExistingCadastro && step > 1 && (
          <div className="mb-5 rounded-xl border border-accent/25 bg-accent/10 p-4 text-sm text-foreground">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="font-bold">Continuar de onde parei</p>
                <p className="mt-1 text-muted-foreground">
                  Retomamos o passo salvo e salvamos suas alterações automaticamente.
                </p>
              </div>
            </div>
          </div>
        )}

        <AutoSaveControls
          status={autoSaveStatus}
          delay={autoSaveDelay}
          hasPendingChanges={hasPendingChanges}
          lastAttemptAt={lastAutoSaveAttemptAt}
          errorMessage={lastAutoSaveError}
          attempts={autoSaveAttempts}
          onDelayChange={setAutoSaveDelay}
          onRetry={retryAutoSave}
          onReloadSaved={reloadSavedFields}
        />

        {/* ─── PASSO 1 ─── */}
        {!guidedReviewStep && !showFinalSummary && step === 1 && !showSubtypeStep && (
          <Step1Identity
            existingProfileType={hasExistingCadastro ? profileType : null}
            onContinueProfileUpdate={handleContinueProfileUpdate}
            onSelectType={handleSelectType}
          />
        )}

        {!guidedReviewStep && !showFinalSummary && step === 1 && showSubtypeStep && profileType === 'provider' && (
          <SubtypeChoice
            onBack={() => { setShowSubtypeStep(false); setProfileType(null); }}
            onSelect={handleSelectSubtype}
          />
        )}

        {/* ─── PASSO 2 ─── */}
        {!guidedReviewStep && !showFinalSummary && step === 2 && (
          <Step2Location
            city={city}
            state={state}
            avatarUrl={avatarUrl}
            editingCity={editingCity}
            onEditCity={() => setEditingCity(true)}
            onCloseEditing={() => setEditingCity(false)}
            onCityChange={(c, s) => {
              setCity(c);
              setState(s);
              if (c) {
                setGeoManualCity(c, s);
                dismissGeoFailure();
                setEditingCity(false);
                window.setTimeout(handleStepFieldBlur, 0);
              }
            }}
            onAvatarChange={(url) => { setAvatarUrl(url); window.setTimeout(handleStepFieldBlur, 0); }}
            onFieldBlur={handleStepFieldBlur}
            onUsePreciseLocation={handleUsePreciseLocation}
            gpsLoading={requestingGps}
            geoStatusText={cityStatusMessage}
            geoPrecise={geoPrecise}
            geoFailed={geoFailed}
            geoSource={geoSource}
            userId={user?.id}
            onBack={() => hasExistingCadastro ? navigate('/dashboard', { replace: true }) : advanceTo(1)}
            onNext={handleStep2Next}
            onSkip={() => advanceTo(3)}
            canAdvance={canAdvanceFromStep2}
            fullName={fullName}
            socialAvatarUrl={getSocialAvatarUrl(user)}
          />
        )}

        {/* ─── PASSO 3 ─── */}
        {!guidedReviewStep && !showFinalSummary && step === 3 && (
          <Step3Contact
            profileType={profileType}
            providerSubtype={providerSubtype}
            setProviderSubtype={setProviderSubtype}
            fullName={fullName}
            setFullName={setFullName}
            agencyName={agencyName}
            setAgencyName={setAgencyName}
            whatsapp={whatsapp}
            setWhatsapp={setWhatsapp}
            bio={bio}
            setBio={setBio}
            neighborhood={neighborhood}
            setNeighborhood={setNeighborhood}
            errorByField={errorByField}
            taxId={taxId}
            setTaxId={(v: string) => { setTaxId(v); setTaxIdJustSaved(false); }}
            taxSavedFeedback={taxIdJustSaved}
            categoriesForPicker={categoriesForPicker}
            selectedCategoryIds={selectedCategoryIds}
            onToggleCategory={(id) => { setSelectedCategoryIds(prev => prev.includes(id) ? [] : [id]); window.setTimeout(handleStepFieldBlur, 0); }}
            onFieldBlur={handleStepFieldBlur}
            saving={saving}
            canAdvance={canAdvanceFromStep3}
            onBack={() => advanceTo(2)}
            onNext={handleStep3Next}
            onSkip={handleSkipStep3}
          />
        )}

        {/* ─── PASSO 4 — PROVIDER apenas (serviço + portfólio inicial) ─── */}
        {!guidedReviewStep && !showFinalSummary && step === 4 && profileType === 'provider' && (
          <Step4Service
            providerReady={!!savedProvider}
            servicesCreated={servicesCreated}
            portfolioAlbumsCreated={portfolioAlbumsCreated}
            creatingAlbum={creatingAlbum}
            onCreateFirstAlbum={handleCreateFirstAlbum}
            savedProvider={savedProvider}
            userId={user?.id}
            categories={categoriesData}
            onServiceCreated={handleServiceCreated}
            onContinue={() => advanceTo(5)}
            onBack={() => advanceTo(3)}
            onSkip={handleSkipStep4}
          />
        )}

        {/* Caso provider ainda não tenha provider row (raro), volta ao step 3 */}
        {!guidedReviewStep && !showFinalSummary && step === 4 && profileType !== 'provider' && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Avançando…</p>
            <Button className="mt-4" onClick={finishOnboarding}>Concluir</Button>
          </div>
        )}

        {/* ─── PASSO 5 ─── */}
        {!guidedReviewStep && !showFinalSummary && step === 5 && (
          <Step5Done
            profileType={profileType}
            servicesCreated={servicesCreated}
            saving={saving}
            onFinish={startGuidedReview}
            onBack={() => advanceTo(profileType === 'provider' ? 4 : 3)}
          />
        )}
        </div>
      </div>

      {/* ─── STICKY FOOTER: barra de progresso + status de salvamento ─── */}
      <div className="fixed inset-x-0 bottom-0 z-[105] border-t border-border bg-card/95 backdrop-blur-md shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)]">
        <div className="mx-auto w-full max-w-md px-4 py-3 sm:px-6">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold">
            <span className="text-muted-foreground">Passo {step} de {TOTAL_STEPS}</span>
            <div className="flex items-center gap-3">
              {savedBadge && (
                <motion.span
                  key={savedBadge.text}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`text-[11px] font-bold ${savedBadge.tone}`}
                >
                  {savedBadge.text}
                </motion.span>
              )}
              <span className="text-accent">{progressPercent}%</span>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent via-primary to-accent bg-[length:200%_100%]"
              initial={{ width: 0 }}
              animate={{
                width: `${progressPercent}%`,
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{
                width: { type: 'spring', stiffness: 90, damping: 18 },
                backgroundPosition: { duration: 3, repeat: Infinity, ease: 'linear' },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════
// SUBCOMPONENTES (mantidos no mesmo arquivo p/ rapidez de leitura)
// ════════════════════════════════════════════════════════════════════

const checklistItems: Array<{ step: WizardStep; label: string }> = [
  { step: 1, label: 'Perfil' },
  { step: 2, label: 'Local' },
  { step: 3, label: 'Contato' },
  { step: 4, label: 'Serviço' },
  { step: 5, label: 'Finalizar' },
];

const PROFILE_TYPE_LABEL: Record<string, string> = {
  provider: 'Profissional',
  client: 'Cliente',
  agency: 'Agência / RH',
  hr: 'Agência / RH',
};

const PROVIDER_SUBTYPE_LABEL: Record<string, string> = {
  autonomous: 'PF • Autônomo',
  company: 'PJ • Empresa / MEI',
  agency: 'Empresa / Agência',
  provider: 'Profissional',
};

const buildReviewItems = (data: {
  profileType: ProfileType | null;
  providerSubtype: ProviderSubtype | null;
  city: string;
  state: string;
  avatarUrl: string | null;
  fullName: string;
  agencyName: string;
  whatsapp: string;
  bio: string;
  selectedCategoryIds: string[];
  servicesCreated: number;
}): Record<WizardStep, Array<{ label: string; value: string }>> => ({
  1: [
    { label: 'Tipo de perfil', value: data.profileType ? (PROFILE_TYPE_LABEL[data.profileType] || data.profileType) : 'Não definido' },
    { label: 'Formato profissional', value: data.providerSubtype ? (PROVIDER_SUBTYPE_LABEL[data.providerSubtype] || data.providerSubtype) : 'Não aplicável' },
  ],
  2: [
    { label: 'Cidade', value: formatCityState(data.city, data.state, ' • ') || 'Não informada' },
    { label: 'Foto', value: data.avatarUrl ? 'Carregada' : 'Não enviada' },
  ],
  3: [
    { label: 'Nome', value: data.fullName || 'Não informado' },
    { label: 'Agência', value: data.agencyName || 'Não aplicável' },
    { label: 'WhatsApp', value: hasValidWhatsapp(data.whatsapp) ? 'Validado' : 'Pendente' },
    { label: 'Bio', value: data.bio ? 'Preenchida' : 'Não preenchida' },
    { label: 'Especialidade', value: data.selectedCategoryIds.length ? 'Selecionada' : 'Pendente' },
    { label: 'Cadastro profissional', value: data.providerSubtype ? (PROVIDER_SUBTYPE_LABEL[data.providerSubtype] || data.providerSubtype) : 'Não aplicável' },
  ],
  4: [
    { label: 'Serviços', value: data.profileType === 'provider' ? `${data.servicesCreated} cadastrado(s)` : 'Não aplicável' },
  ],
  5: [
    { label: 'Pronto para finalizar', value: 'Revise os dados e confirme' },
  ],
});

const WizardChecklist = ({
  currentStep,
  furthestStep,
  estimates,
  onReview,
  onReviewAll,
}: {
  currentStep: WizardStep;
  furthestStep: WizardStep;
  estimates: Record<WizardStep, string>;
  onReview: (step: WizardStep) => void;
  onReviewAll: () => void;
}) => {
  const completedCount = checklistItems.filter(item => item.step < furthestStep || item.step < currentStep).length;
  const progressPercent = Math.round((completedCount / TOTAL_STEPS) * 100);

  return (
  <div className="mb-5 rounded-xl border border-border bg-muted/30 p-3">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-bold text-foreground">Progresso do perfil</p>
        <p className="text-[10px] font-medium text-muted-foreground">{completedCount} de {TOTAL_STEPS} etapas concluídas • {progressPercent}%</p>
      </div>
      <button type="button" onClick={onReviewAll} className="text-[11px] font-bold text-accent hover:underline">Revisar tudo</button>
    </div>
    <Progress value={progressPercent} className="mb-3 h-1.5" />
    <div className="grid grid-cols-5 gap-2">
      {checklistItems.map((item) => {
        const done = item.step < currentStep || item.step < furthestStep;
        const active = item.step === currentStep;
        const available = item.step <= furthestStep;
        return (
          <button
            key={item.step}
            type="button"
            disabled={!available}
            onClick={() => onReview(item.step)}
            className={`min-h-16 rounded-lg border px-1.5 py-2 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? 'border-accent bg-accent/10 text-foreground'
                : done
                  ? 'border-accent/30 bg-accent/5 text-foreground'
                  : 'border-border bg-background text-muted-foreground'
            }`}
          >
            <span className="mx-auto mb-1 flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px] font-bold">
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.step}
            </span>
            <span className="block text-[10px] font-semibold leading-tight">{item.label}</span>
            <span className="mt-0.5 block text-[9px] leading-tight opacity-80">
              {active ? 'Agora' : done ? 'Completo' : 'Falta'}
            </span>
            <span className="mt-0.5 block text-[9px] leading-tight opacity-70">{estimates[item.step]}</span>
          </button>
        );
      })}
    </div>
  </div>
  );
};

const AutoSaveControls = ({
  status,
  delay,
  hasPendingChanges,
  lastAttemptAt,
  errorMessage,
  attempts,
  onDelayChange,
  onRetry,
  onReloadSaved,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error';
  delay: 1000 | 2000 | 3000;
  hasPendingChanges: boolean;
  lastAttemptAt: string | null;
  errorMessage: string | null;
  attempts: AutoSaveAttempt[];
  onDelayChange: (delay: 1000 | 2000 | 3000) => void;
  onRetry: () => void;
  onReloadSaved: () => void;
}) => {
  if (!hasPendingChanges && status !== 'error') return null;
  const lastAttemptLabel = lastAttemptAt
    ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(lastAttemptAt))
    : 'ainda não enviada';

  return (
  <div className="mb-4 rounded-xl border border-border bg-muted/20 p-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold text-foreground">Auto-save</p>
        <p className={`text-[11px] font-medium ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
          {status === 'saving'
            ? 'Salvando automaticamente…'
            : status === 'error'
                ? 'Erro ao salvar alterações'
                : 'Alterações pendentes serão salvas em instantes'}
        </p>
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
        {[1000, 2000, 3000].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onDelayChange(value as 1000 | 2000 | 3000)}
            className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
              delay === value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {value / 1000}s
          </button>
        ))}
      </div>
    </div>
    {status === 'error' && (
      <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 p-3">
        <div className="flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">Última tentativa: {lastAttemptLabel}</p>
            <p className="mt-1 text-[11px]">{errorMessage || 'Verifique sua conexão e tente novamente.'}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>Tentar novamente o auto-save</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onReloadSaved} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Recarregar salvos
          </Button>
        </div>
      </div>
    )}
    {attempts.length > 0 && (
      <div className="mt-3 rounded-lg border border-border bg-background/70 p-3">
        <p className="text-[11px] font-bold text-foreground">Histórico de salvamento</p>
        <div className="mt-2 space-y-2">
          {attempts.map((attempt) => (
            <div key={attempt.id} className="flex items-start justify-between gap-3 text-[10px]">
              <div>
                <p className={attempt.status === 'error' ? 'font-bold text-destructive' : 'font-bold text-accent'}>
                  {attempt.status === 'error' ? 'Falhou' : 'Salvo'} • passo {attempt.step}
                </p>
                <p className="text-muted-foreground">{attempt.fields.join(', ') || 'progresso'} — {attempt.message}</p>
              </div>
              <span className="shrink-0 text-muted-foreground">
                {new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(attempt.attemptedAt))}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
  );
};

const GuidedReviewCard = ({
  step,
  items,
  onEdit,
  onKeep,
  onPrev,
  canGoPrev,
}: {
  step: WizardStep;
  items: Array<{ label: string; value: string }>;
  onEdit: () => void;
  onKeep: () => void;
  onPrev: () => void;
  canGoPrev: boolean;
}) => (
  <div className="mb-5 rounded-xl border border-accent/25 bg-accent/10 p-4">
    <p className="text-xs font-bold text-accent">Revisão guiada • passo {step}</p>
    <h2 className="mt-1 font-display text-lg font-bold text-foreground">{checklistItems.find(item => item.step === step)?.label}</h2>
    <div className="mt-4 space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/70 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
          <span className="text-right text-xs font-bold text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      <Button type="button" variant="ghost" onClick={onPrev} disabled={!canGoPrev}>Voltar</Button>
      <Button type="button" variant="outline" onClick={onEdit}>Editar</Button>
      <Button type="button" variant="accent" onClick={onKeep}>Confirmar</Button>
    </div>
  </div>
);

const ReviewSummaryCard = ({
  items,
  saving,
  onBack,
  onFinish,
}: {
  items: Array<{ label: string; value: string }>;
  saving: boolean;
  onBack: () => void;
  onFinish: () => void;
}) => (
  <div className="mb-5 rounded-xl border border-accent/25 bg-accent/10 p-4">
    <h2 className="font-display text-lg font-bold text-foreground">Resumo final</h2>
    <p className="mt-1 text-xs text-muted-foreground">Confira seus dados antes de concluir.</p>
    <div className="mt-4 space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/70 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
          <span className="text-right text-xs font-bold text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
    <div className="mt-4 grid gap-2">
      <Button type="button" variant="accent" onClick={onFinish} disabled={saving}>
        {saving ? 'Concluindo…' : 'Concluir wizard'}
      </Button>
      <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
        Voltar para revisar
      </Button>
    </div>
  </div>
);

export const Step1Identity = ({
  existingProfileType,
  onContinueProfileUpdate,
  onSelectType,
}: {
  existingProfileType: ProfileType | null;
  onContinueProfileUpdate: () => void;
  onSelectType: (t: ProfileType) => void;
}) => (
  <>
    <h1 className="text-center font-display text-2xl font-bold text-foreground">Seu talento merece brilhar</h1>
    <p className="mt-2 text-center text-sm text-muted-foreground">Em 5 passos rápidos a gente coloca você no mapa.</p>

    <div className="mt-6 grid gap-3">
      {existingProfileType && (
        <Button type="button" size="lg" className="h-auto justify-start gap-3 py-4 text-left" onClick={onContinueProfileUpdate}>
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="min-w-0">
            <span className="block font-bold">Continuar atualização do meu perfil</span>
            <span className="block text-xs font-normal opacity-80">Ir direto para os dados do cadastro</span>
          </span>
        </Button>
      )}
      <TypeButton onClick={() => onSelectType('provider')} icon={Briefcase} title="Sou Profissional" desc="Quero ser encontrado por novos clientes" tone="accent" />
      <TypeButton onClick={() => onSelectType('client')} icon={UserRound} title="Sou Cliente" desc="Procuro um profissional de confiança" tone="blue" />
      <TypeButton onClick={() => onSelectType('rh')} icon={Building2} title="Agência de RH" desc="Recruto talentos para empresas" tone="purple" />
      <TypeButton onClick={() => onSelectType('sponsor')} icon={Megaphone} title="Sou Patrocinador" desc="Quero anunciar minha marca" tone="secondary" />
    </div>
  </>
);

const SubtypeChoice = ({
  onBack, onSelect,
}: { onBack: () => void; onSelect: (s: ProviderSubtype) => void }) => (
  <>
    <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5" /> Voltar
    </button>
    <h1 className="text-center font-display text-xl font-bold text-foreground">Você atua como…</h1>
    <div className="mt-6 grid gap-3">
      <TypeButton onClick={() => onSelect('autonomous')} icon={UserRound} title="Profissional Autônomo (PF)" desc="Sem CNPJ obrigatório" tone="accent" />
      <TypeButton onClick={() => onSelect('company')} icon={Building2} title="Empresa / MEI (PJ)" desc="Tenho CNPJ" tone="primary" />
    </div>
  </>
);

const TypeButton = forwardRef<HTMLButtonElement, {
  onClick: () => void;
  icon: any;
  title: string;
  desc: string;
  tone: 'accent' | 'blue' | 'purple' | 'secondary' | 'primary';
}>(({ onClick, icon: Icon, title, desc, tone }, ref) => {
  const toneClass = {
    accent: 'border-accent/30 bg-accent/5 hover:border-accent',
    blue: 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500',
    purple: 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500',
    secondary: 'border-secondary/30 bg-secondary/5 hover:border-secondary',
    primary: 'border-primary/30 bg-primary/5 hover:border-primary',
  }[tone];
  const iconBg = {
    accent: 'bg-accent text-accent-foreground',
    blue: 'bg-blue-600 text-white',
    purple: 'bg-purple-600 text-white',
    secondary: 'bg-secondary text-secondary-foreground',
    primary: 'bg-primary text-primary-foreground',
  }[tone];
  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className={`group rounded-2xl border-2 p-5 text-left shadow-sm transition-colors hover:shadow-lg ${toneClass}`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-base font-bold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
    </motion.button>
  );
});
TypeButton.displayName = 'TypeButton';

// ─── Passo 2 ───
export const Step2Location = ({
  city, state, avatarUrl, editingCity, onEditCity, onCloseEditing, onCityChange, onAvatarChange,
  userId, onBack, onNext, onSkip, canAdvance, onFieldBlur, fullName, socialAvatarUrl,
  onUsePreciseLocation, gpsLoading, geoStatusText, geoPrecise, geoFailed, geoSource,
}: any) => {
  const isFromGoogle = !!socialAvatarUrl && avatarUrl === socialAvatarUrl;
  const hasNoAvatar = !avatarUrl;
  const initials = getInitials(fullName);
  const [photoConfirmed, setPhotoConfirmed] = useState(false);
  const [syncStatus, setSyncStatus] = useState<null | { ok: boolean; message: string }>(null);
  const [syncing, setSyncing] = useState(false);

  const handleResyncFromGoogle = async () => {
    if (!userId) return;
    if (!socialAvatarUrl) {
      setSyncStatus({ ok: false, message: 'Sua conta não tem foto Google disponível para sincronizar.' });
      return;
    }
    setSyncing(true);
    try {
      const { error } = await supabase.from('profiles').update({ avatar_url: socialAvatarUrl }).eq('id', userId);
      if (error) throw error;
      onAvatarChange(socialAvatarUrl);
      setSyncStatus({ ok: true, message: 'Foto sincronizada com sucesso da sua conta Google.' });
      setPhotoConfirmed(true);
    } catch (err: any) {
      setSyncStatus({ ok: false, message: err?.message || 'Falha ao sincronizar a foto. Tente novamente.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!userId) return;
    setSyncing(true);
    try {
      const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
      if (error) throw error;
      onAvatarChange(null);
      setSyncStatus({ ok: true, message: 'Foto removida. Suas iniciais serão exibidas.' });
      setPhotoConfirmed(false);
    } catch (err: any) {
      setSyncStatus({ ok: false, message: err?.message || 'Não foi possível remover a foto.' });
    } finally {
      setSyncing(false);
    }
  };

  const photoSourceLabel = isFromGoogle
    ? 'Conta Google'
    : avatarUrl
      ? 'Upload manual'
      : 'Iniciais (sem foto)';

  return (
  <>
    <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5" /> Voltar
    </button>

    <div className="mb-3 flex justify-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
        <MapPin className="h-7 w-7 text-accent" />
      </div>
    </div>
    <h1 className="text-center font-display text-xl font-bold text-foreground">Localização e foto</h1>
    <p className="mt-1 text-center text-xs text-muted-foreground">Vamos personalizar seu perfil.</p>

    <div className="mt-5 space-y-4">
      <div className={`rounded-xl border px-3 py-3 ${geoFailed ? 'border-destructive/30 bg-destructive/5' : geoPrecise ? 'border-primary/30 bg-primary/5' : 'border-accent/30 bg-accent/5'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">
              {geoPrecise ? 'Localização precisa ativa' : city ? 'Cidade pronta para uso' : 'Defina sua localização'}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{geoStatusText}</p>
            {city && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] font-semibold text-foreground">
                <Check className="h-3 w-3 text-accent" /> {formatCityState(city, state, ' • ')}
              </p>
            )}
            {!geoPrecise && geoSource === 'ip' && (
              <p className="mt-2 text-[11px] text-muted-foreground">A localização automática por rede é aproximada. Se puder, confirme pelo GPS ou selecione manualmente.</p>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onUsePreciseLocation} disabled={gpsLoading}>
            {gpsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
            {gpsLoading ? 'Buscando…' : geoPrecise ? 'Atualizar GPS' : 'Usar GPS'}
          </Button>
        </div>
      </div>

      {userId && (
        <div>
          <label className="mb-2 block text-xs font-semibold text-foreground">Foto de perfil (opcional)</label>

          {/* Preview do avatar antes de concluir */}
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/20 p-4">
            <AvatarUpload
              userId={userId}
              currentUrl={avatarUrl}
              initials={initials}
              onUploaded={onAvatarChange}
            />

            <div className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground">Origem da foto:</span>
                <span className="font-medium text-muted-foreground">{photoSourceLabel}</span>
              </div>
            </div>

            {isFromGoogle && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                <Check className="h-3 w-3" /> Foto sincronizada da sua conta Google
              </div>
            )}

            {!isFromGoogle && avatarUrl && (
              <p className="text-[11px] text-muted-foreground">Foto enviada por você (upload manual)</p>
            )}

            {hasNoAvatar && initials !== '?' && (
              <p className="text-[11px] text-muted-foreground text-center">
                Sem foto? Vamos exibir suas iniciais <span className="font-bold text-foreground">{initials}</span> num círculo colorido.
              </p>
            )}

            {/* Ações: confirmar / re-sincronizar / remover */}
            <div className="grid w-full gap-2 sm:grid-cols-2">
              {socialAvatarUrl && !isFromGoogle && (
                <Button type="button" size="sm" variant="outline" disabled={syncing}
                  onClick={handleResyncFromGoogle} className="text-xs">
                  Re-sincronizar foto do Google
                </Button>
              )}
              {avatarUrl && (
                <Button type="button" size="sm" variant="ghost" disabled={syncing}
                  onClick={handleRemovePhoto} className="text-xs">
                  Remover foto
                </Button>
              )}
              <Button type="button" size="sm" variant={photoConfirmed ? 'accent' : 'secondary'}
                onClick={() => setPhotoConfirmed(true)} disabled={syncing}
                className="text-xs sm:col-span-2">
                {photoConfirmed ? <><Check className="mr-1 h-3 w-3" /> Origem confirmada</> : 'Confirmar origem da foto'}
              </Button>
            </div>

            {syncStatus && (
              <div className={`w-full rounded-lg border px-3 py-2 text-[11px] ${
                syncStatus.ok
                  ? 'border-emerald-300/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-destructive/40 bg-destructive/10 text-destructive'
              }`}>
                {syncStatus.message}
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold text-foreground">Cidade</label>
        {!editingCity && city ? (
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2">
            <span className="text-sm font-bold text-foreground">{formatCityState(city, state, ' • ')}</span>
            <button onClick={onEditCity} className="text-xs font-medium text-accent hover:underline">Trocar</button>
          </div>
        ) : (
          <div onBlur={onFieldBlur}>
            <CityAutocomplete
              value={{ city, state }}
              onChange={({ city: c, state: s }) => onCityChange(c, s)}
              statusText={geoStatusText}
              onClose={() => { if (city) onCloseEditing?.(); }}
            />
          </div>
        )}
      </div>
    </div>

    <div className="mt-5 grid gap-3">
      <Button variant="accent" className="w-full" disabled={!canAdvance} onClick={onNext}>
        Salvar e continuar
      </Button>
      <Button type="button" variant="outline" className="w-full" onClick={onSkip}>
        Pular por enquanto
      </Button>
    </div>
  </>
  );
};

// ─── Passo 3 ───
export const Step3Contact = ({
  profileType, providerSubtype, setProviderSubtype,
  fullName, setFullName, agencyName, setAgencyName,
  whatsapp, setWhatsapp, bio, setBio,
  neighborhood, setNeighborhood, errorByField = {},
  taxId, setTaxId, taxSavedFeedback,
  categoriesForPicker, selectedCategoryIds, onToggleCategory,
  saving, canAdvance, onBack, onNext, onSkip, onFieldBlur,
}: any) => {
  const isProvider = profileType === 'provider';
  const selectedCategory = categoriesForPicker.find((category: any) => selectedCategoryIds.includes(category.id));
  // Para provider, o documento aceito depende do subtipo escolhido no Passo 1.
  // PF (autônomo) → CPF apenas (11 dígitos). PJ (empresa/agência) → CNPJ apenas (14 dígitos).
  const docMode: 'cpf' | 'cnpj' | 'auto' = !isProvider
    ? 'auto'
    : providerSubtype === 'company'
      ? 'cnpj'
      : 'cpf';
  const taxLabel = docMode === 'cnpj' ? 'CNPJ' : 'CPF';
  const taxDigits = (taxId || '').replace(/\D/g, '');
  const taxFilled = taxDigits.length > 0;
  const expectedLen = docMode === 'cnpj' ? 14 : 11;
  const taxValid = !taxFilled || (taxDigits.length === expectedLen && isValidCpfCnpj(taxDigits));
  const waCheck = validateWhatsapp(whatsapp || '');
  const waTouched = (whatsapp || '').length > 0;

  // Ao alternar PF↔PJ, garante que o documento existente seja truncado para o novo formato.
  const switchSubtype = (next: 'autonomous' | 'company') => {
    if (providerSubtype === next) return;
    setProviderSubtype?.(next);
    const max = next === 'company' ? 14 : 11;
    if (taxDigits.length > max) {
      setTaxId(taxDigits.slice(0, max));
    } else if (taxDigits.length > 0 && taxDigits.length < max) {
      // mantém parcial, mas sinaliza inválido até preencher
      setTaxId(taxDigits);
    }
    window.setTimeout(onFieldBlur, 0);
  };

  return (
  <>
    <button
      type="button"
      onClick={onBack}
      className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
    >
      <ArrowLeft className="h-4 w-4" /> Voltar ao passo anterior
    </button>

    <div className="mb-3 flex justify-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
        <Phone className="h-7 w-7 text-accent" />
      </div>
    </div>
    <h1 className="text-center font-display text-xl font-bold text-foreground">Dados de contato</h1>
    <p className="mt-1 text-center text-xs text-muted-foreground">Como os clientes vão te encontrar.</p>

    {/* Bloco PF/PJ removido daqui — a escolha já é feita no Passo 1 e exibida
        de forma compacta no rodapé deste passo (badge "Cadastro como PF/PJ"). */}

    <div className="mt-5 space-y-4">
      <div>
        <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-foreground">
          {profileType === 'rh' ? 'Seu nome (responsável)' : 'Seu nome completo'}
          <span className="text-destructive" aria-hidden="true">*</span>
        </label>
        <Input placeholder="Ex: João Silva" value={fullName} onChange={e => setFullName(e.target.value)} onBlur={onFieldBlur} />
      </div>

      {profileType === 'rh' && (
        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">Nome da Agência</label>
          <Input placeholder="Ex: Talentos RH" value={agencyName} onChange={e => setAgencyName(e.target.value)} onBlur={onFieldBlur} />
        </div>
      )}

      <div>
        <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
          WhatsApp <span className="text-destructive" aria-hidden="true">*</span>
          <span className="ml-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-destructive">Obrigatório</span>
        </label>
        <div onBlur={onFieldBlur}>
          <PhoneMaskedInput
            name="whatsapp"
            value={whatsapp}
            onChange={(_n: any, val: string) => setWhatsapp(val)}
            className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground ${
              waTouched && !waCheck.valid ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
            }`}
          />
        </div>
        {waTouched && !waCheck.valid ? (
          <p className="mt-1 flex items-start gap-1 text-[11px] font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{waCheck.message}</span>
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Inclua DDD. Ex: (41) 99745-2053. Os clientes só conseguem te chamar se o WhatsApp estiver preenchido.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
          Bairro
          <span className="ml-1 rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Opcional</span>
        </label>
        <Input
          name="neighborhood"
          placeholder="Ex: Centro, Batel, Água Verde…"
          value={neighborhood || ''}
          onChange={(e) => setNeighborhood(e.target.value)}
          onBlur={onFieldBlur}
          className={errorByField?.neighborhood ? 'border-destructive focus-visible:ring-destructive' : ''}
        />
        {errorByField?.neighborhood ? (
          <p className="mt-1 flex items-start gap-1 text-[11px] font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{errorByField.neighborhood}</span>
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Ajuda clientes próximos a te encontrar mais rápido. Pode preencher depois.
          </p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <label className="block text-xs font-semibold text-foreground">
            {taxLabel}
          </label>
          <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Documento opcional
          </span>
        </div>
        <CpfCnpjInput
          mode={docMode}
          value={taxId || ''}
          onChange={(digitsOnly) => setTaxId(digitsOnly)}
          onBlur={onFieldBlur}
          aria-invalid={!taxValid}
          className={!taxValid ? 'border-destructive focus-visible:ring-destructive' : ''}
        />
        <p className={`mt-1 text-[11px] ${!taxValid ? 'text-destructive' : taxSavedFeedback ? 'text-emerald-600' : 'text-muted-foreground'}`}>
          {!taxValid
            ? `${taxLabel} inválido — confira os dígitos.`
            : taxSavedFeedback
              ? `${taxLabel} salvo com segurança. Só você e a administração visualizam o documento completo.`
              : taxFilled
                ? `${taxLabel} válido. Será salvo de forma criptografada ao continuar.`
                : `Opcional — você pode deixar em branco e preencher depois. ${taxLabel} soma pontos no ranking quando informado.`}
        </p>
      </div>

      {profileType === 'provider' && (
        <>
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">Bio curta (opcional)</label>
            <Textarea
              placeholder="Conte em 2 linhas o que você faz de melhor."
              value={bio}
              onChange={e => setBio(e.target.value)}
              onBlur={onFieldBlur}
              rows={3}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-foreground">Qual é o principal serviço que você vai cadastrar?</label>
            <SmartCategoryPicker
              categories={categoriesForPicker}
              selectedIds={selectedCategoryIds}
              onToggle={onToggleCategory}
              maxSelections={1}
              placeholder="Ex: Eletricista, Pintor…"
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              {selectedCategory
                ? `Selecionado: ${selectedCategory.name}. Esse será o serviço base do seu cadastro.`
                : 'Selecione uma especialidade para continuar sem travar no próximo passo.'}
            </p>
          </div>
        </>
      )}
    </div>

    <div className="mt-5 grid gap-3">
      {isProvider && (
        <div
          aria-live="polite"
          className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[11px] ${
            providerSubtype === 'company'
              ? 'border-primary/40 bg-primary/5'
              : 'border-accent/40 bg-accent/5'
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className={`h-4 w-4 ${providerSubtype === 'company' ? 'text-primary' : 'text-accent'}`} />
            <span className="font-semibold text-foreground">
              {providerSubtype === 'company' ? 'Cadastro como PJ' : 'Cadastro como PF'}
            </span>
          </span>
          <span className="font-mono text-foreground/80">
            Documento: <span className="font-bold">{taxLabel}</span>
            {taxFilled && taxValid ? ' ✓' : ''}
          </span>
        </div>
      )}
      <Button variant="accent" className="w-full" disabled={!canAdvance || saving || !taxValid} onClick={onNext}>
        {saving
          ? 'Salvando…'
          : taxFilled
            ? 'Salvar dados e continuar'
            : `Continuar (${taxLabel} depois)`}
      </Button>
      {!taxFilled && (
        <Button type="button" variant="outline" className="w-full" onClick={onSkip} disabled={saving}>
          Pular passo agora
        </Button>
      )}
      <p className="text-center text-[10px] text-muted-foreground">
        Voltar nunca apaga o que você já preencheu.
      </p>
    </div>
  </>
  );
};

// ─── Passo 4 ───
export const Step4Service = ({
  providerReady, servicesCreated, portfolioAlbumsCreated, creatingAlbum,
  onCreateFirstAlbum, savedProvider, userId, categories,
  onServiceCreated, onContinue, onBack, onSkip,
}: any) => {
  const [albumTitle, setAlbumTitle] = useState('');
  const hasService = servicesCreated > 0;
  const hasAlbum = portfolioAlbumsCreated > 0;

  return (
    <>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </button>

      <div className="mb-3 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Sparkles className="h-7 w-7" />
        </div>
      </div>
      <h1 className="text-center font-display text-xl font-bold text-foreground">Seu primeiro serviço</h1>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        Cadastre 1 serviço (obrigatório) e seu primeiro álbum de portfólio (recomendado).
      </p>

      <div className="mt-5">
        {providerReady ? (
          hasService ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
                <p className="text-sm font-bold text-foreground">
                  {servicesCreated === 1 ? '1 serviço cadastrado!' : `${servicesCreated} serviços cadastrados!`}
                </p>
              </div>

              {/* Sub-etapa de portfólio na esteira do wizard */}
              <div className={`rounded-xl border p-4 ${hasAlbum ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-accent/30 bg-accent/5'}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${hasAlbum ? 'bg-emerald-500/15 text-emerald-600' : 'bg-accent/15 text-accent'}`}>
                    {hasAlbum ? <CheckCircle2 className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      {hasAlbum ? 'Álbum criado!' : 'Crie seu primeiro álbum de portfólio'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {hasAlbum
                        ? 'Adicione fotos no Dashboard quando quiser.'
                        : 'Quem mostra trabalho ganha 3× mais contatos. Leva 20 segundos.'}
                    </p>
                  </div>
                </div>

                {!hasAlbum && (
                  <div className="mt-3 space-y-2">
                    <Input
                      placeholder='Ex: "Reformas residenciais", "Casamentos"...'
                      value={albumTitle}
                      onChange={(e) => setAlbumTitle(e.target.value)}
                      maxLength={60}
                    />
                    <Button
                      type="button"
                      variant="accent"
                      className="w-full gap-2"
                      disabled={!albumTitle.trim() || creatingAlbum}
                      onClick={() => { void onCreateFirstAlbum(albumTitle); setAlbumTitle(''); }}
                    >
                      {creatingAlbum
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando…</>
                        : <><Plus className="h-4 w-4" /> Criar álbum</>}
                    </Button>
                  </div>
                )}
              </div>

              <Button variant="accent" className="w-full" onClick={onContinue}>
                Continuar para o último passo
              </Button>
              {!hasAlbum && (
                <button
                  type="button"
                  onClick={onContinue}
                  className="block w-full text-center text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Pular portfólio por enquanto
                </button>
              )}
            </div>
          ) : (
            <ServiceWizard
              providerId={savedProvider.id}
              userId={userId}
              provider={savedProvider}
              categories={categories}
              onComplete={onServiceCreated}
              onCancel={onSkip}
            />
          )
        ) : (
          <p className="text-center text-sm text-muted-foreground">Carregando seu perfil profissional…</p>
        )}
      </div>

      {!hasService && (
        <p className="mt-4 w-full text-center text-[11px] font-medium text-muted-foreground">
          Cadastrar 1 serviço é obrigatório para concluir seu cadastro. Os dados já preenchidos nos passos anteriores estão salvos.
        </p>
      )}
    </>
  );
};

// ─── Passo 5 ───
export const Step5Done = ({
  profileType, servicesCreated, saving, onFinish, onBack,
}: any) => {
  const isProvider = profileType === 'provider';
  const meetsMinimum = !isProvider || servicesCreated > 0;
  const finishLabel = meetsMinimum
    ? 'FINALIZAR CADASTRO DOS MEUS SERVIÇOS'
    : 'Voltar e cadastrar 1 serviço';
  return (
    <>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </button>

      <div className="mb-3 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-primary text-accent-foreground">
          <PartyPopper className="h-8 w-8" />
        </div>
      </div>
      <h1 className="text-center font-display text-2xl font-bold text-foreground">Tudo pronto!</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Revise suas informações e conclua seu cadastro para começar a cadastrar e organizar seus serviços.
      </p>

      {!meetsMinimum && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-center text-xs text-destructive">
          Você precisa cadastrar pelo menos 1 serviço para liberar o Dashboard.
          Volte ao Passo 4 para cadastrar agora.
        </div>
      )}

      <Button
        variant="accent"
        className="mt-6 h-16 w-full text-base font-extrabold uppercase tracking-wide shadow-lg sm:text-xl"
        disabled={saving || !meetsMinimum}
        onClick={onFinish}
      >
        {saving ? (
          <span className="inline-flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Finalizando…</span>
        ) : finishLabel}
      </Button>
    </>
  );
};

export default SmartOnboardingWizard;
