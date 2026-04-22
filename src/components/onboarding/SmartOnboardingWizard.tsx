/**
 * SmartOnboardingWizard — Esteira linear obrigatória (5 passos).
 *
 * Regras inegociáveis:
 *  1. Não há botão "X" / "fechar". O wizard ocupa a tela inteira.
 *  2. Cada passo persiste no banco (`profiles.onboarding_step`) ao avançar.
 *     Refresh (F5) volta exatamente para o passo atual.
 *  3. `onboarding_completed = true` SÓ é gravado no Passo 5 (conclusão).
 *  4. "Pular" sempre vai para o próximo passo. Nunca fecha o wizard.
 *  5. Provider precisa criar 1 serviço no Passo 4 antes de liberar o Passo 5.
 *
 * Passos:
 *   1. Identidade (tipo de perfil)
 *   2. Localização + Foto
 *   3. Dados de contato (WhatsApp + bio curta)
 *   4. Primeiro serviço (apenas provider — outros tipos pulam direto p/ 5)
 *   5. Conclusão + ganho de pontos
 */
import { forwardRef, useEffect, useRef, useState } from 'react';
import {
  Briefcase, UserRound, MapPin, Sparkles, Loader2, ArrowLeft, CheckCircle2,
  PartyPopper, Building2, Megaphone, Camera, Phone, AlertCircle, RefreshCw,
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
const hasValidWhatsapp = (value: string) => value.replace(/\D/g, '').length >= 10;

export type WizardMode = 'basic';

interface SmartOnboardingWizardProps {
  mode?: WizardMode;
}

const SmartOnboardingWizard = (_: SmartOnboardingWizardProps = {}) => <BasicOnboardingWizard />;

const BasicOnboardingWizard = () => {
  const { user, profile, refetchProfile } = useAuth();
  const { city: geoCity, state: geoState } = useGeoCity();
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

  // Contato + bio (Passo 3)
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || profile?.phone || '');
  const [bio, setBio] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // Provider data
  const [savedProvider, setSavedProvider] = useState<any | null>(null);
  const [servicesCreated, setServicesCreated] = useState(0);

  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [autoSaveDelay, setAutoSaveDelay] = useState<1000 | 2000 | 3000>(1000);
  const [lastAutoSavePatch, setLastAutoSavePatch] = useState<Record<string, any> | null>(null);
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
    if (profile.whatsapp || profile.phone) setWhatsapp(profile.whatsapp || profile.phone || '');
  }, [profile]);

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
          }
        }
      });
  }, [user?.id, profileType, savedProvider]);

  // ─── Sync geo somente se ainda vazio ───
  useEffect(() => {
    if (!editingCity && geoCity && !city) setCity(geoCity);
    if (geoState && !state) setState(geoState);
  }, [geoCity, geoState, editingCity, city, state]);

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
        const attempt: AutoSaveAttempt = { id: `${attemptedAt}-error`, status: 'error', attemptedAt, step, fields, message };
        setAutoSaveAttempts(prev => [attempt, ...prev].slice(0, 5));
      }
    }
  };

  const retryAutoSave = () => {
    if (lastAutoSavePatch) void saveAutoSavePatch(lastAutoSavePatch);
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
    setFurthestStep(prev => Math.max(prev, nextStep) as WizardStep);
    setStep(nextStep);
    await persistStep(nextStep, extraPatch);
  };

  const saveStepDraft = (targetStep: WizardStep = step) => {
    setDrafts(prev => ({ ...prev, [targetStep]: currentStepDraft(targetStep) }));
  };

  const reloadSavedFields = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, whatsapp, phone, profile_type, onboarding_step')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      toast.error('Não foi possível recarregar os campos salvos.');
      return;
    }

    const savedProfile = data as any;
    let savedCity = '';
    let savedState = '';
    if (savedProfile.profile_type === 'provider') {
      const { data: providerRows } = await supabase.from('providers').select('city, state').eq('user_id', user.id).limit(1);
      savedCity = providerRows?.[0]?.city || '';
      savedState = providerRows?.[0]?.state || '';
    } else if (savedProfile.profile_type === 'rh') {
      const { data: agencyRows } = await (supabase as any).from('agencies').select('city, state').eq('user_id', user.id).limit(1);
      savedCity = agencyRows?.[0]?.city || '';
      savedState = agencyRows?.[0]?.state || '';
    }

    setFullName(savedProfile.full_name || '');
    setCity(savedCity);
    setState(savedState);
    setAvatarUrl(savedProfile.avatar_url || null);
    setWhatsapp(savedProfile.whatsapp || savedProfile.phone || '');
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
  }, [user?.id, profile, step, furthestStep, city, state, avatarUrl, fullName, whatsapp, bio, agencyName, selectedCategoryIds, profileType, saving, autoSaveDelay]);

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

  // Quando provider termina o wizard de serviços, marcamos +1 e avançamos
  const handleServiceCreated = async (_id: string) => {
    setServicesCreated(c => c + 1);
    toast.success('Serviço cadastrado!');
    await advanceTo(5);
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

  // ─── Passo 2: Localização + Foto ───
  const canAdvanceFromStep2 = !!city.trim();
  const handleStep2Next = async () => {
    if (!canAdvanceFromStep2) {
      toast.error('Informe sua cidade para continuar.');
      return;
    }
    await advanceTo(3, {
      city: city || null,
      state: state || null,
      avatar_url: avatarUrl,
    });
  };

  // ─── Passo 3: Dados de contato + bio + (provider) categoria ───
  const canAdvanceFromStep3 =
    !!fullName.trim() &&
    !!whatsapp.trim() &&
    (profileType !== 'provider' || selectedCategoryIds.length > 0) &&
    (profileType !== 'rh' || !!agencyName.trim());

  const handleStep3Next = async () => {
    if (!canAdvanceFromStep3) {
      toast.error('Preencha os campos obrigatórios para continuar.');
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    try {
      // Salva profile
      await supabase.from('profiles').update({
        full_name: fullName.trim(),
        whatsapp,
        phone: whatsapp,
        profile_type: profileType,
        role: profileType,
        onboarding_step: 4,
      } as any).eq('id', user.id);

      // Garante registro provider/agency conforme tipo
      if (profileType === 'provider') {
        const { data: existing } = await supabase.from('providers').select('*').eq('user_id', user.id).limit(1);
        if (existing && existing[0]) {
          await supabase.from('providers').update({
            city: city || existing[0].city,
            state: state || existing[0].state,
            description: bio || existing[0].description,
            whatsapp: whatsapp || existing[0].whatsapp,
            category_id: selectedCategoryIds[0] || existing[0].category_id,
            account_type: providerSubtype || existing[0].account_type || 'autonomous',
          } as any).eq('id', existing[0].id);
          setSavedProvider({ ...existing[0], city, state, description: bio, whatsapp, category_id: selectedCategoryIds[0], account_type: providerSubtype || 'autonomous' });
        } else {
          const baseSlug = slugify(fullName || user.email?.split('@')[0] || 'profissional');
          const { data: created, error } = await supabase.from('providers').insert({
            user_id: user.id,
            slug: `${baseSlug}-${user.id.slice(0, 6)}`,
            city: city || null,
            state: state || null,
            description: bio || null,
            whatsapp: whatsapp || null,
            category_id: selectedCategoryIds[0] || null,
            account_type: providerSubtype || 'autonomous',
            status: 'pending',
          } as any).select('*').single();
          if (error) throw error;
          setSavedProvider(created);
        }
      } else if (profileType === 'rh') {
        const { data: existing } = await (supabase as any).from('agencies').select('*').eq('user_id', user.id).limit(1);
        if (!existing || existing.length === 0) {
          const baseSlug = slugify(agencyName || fullName || 'agencia');
          await (supabase as any).from('agencies').insert({
            user_id: user.id,
            slug: `${baseSlug}-${user.id.slice(0, 6)}`,
            name: agencyName.trim() || fullName.trim() || 'Minha Agência',
            city: city || null,
            state: state || null,
            status: 'pending',
          });
        }
      }

      await refetchProfile();

      // Provider passa pelo Passo 4 obrigatoriamente. Demais tipos vão direto p/ 5.
      if (profileType === 'provider') {
        setStep(4);
      } else {
        await finishOnboarding();
      }
    } catch (err: any) {
      console.error('[Wizard step 3]', err);
      toast.error('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipStep3 = async () => {
    toast.info('Você pode completar estes dados depois no dashboard.');
    await advanceTo(profileType === 'provider' ? 4 : 5);
  };

  // ─── Passo 4: Primeiro serviço (provider apenas) ───
  const handleSkipStep4 = async () => {
    toast.info('Você pode cadastrar serviços depois no dashboard.');
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

  const summaryItems = [
    { label: 'Tipo de perfil', value: profileType || 'Não definido' },
    { label: 'Cidade', value: city ? `${city}${state ? ` • ${state}` : ''}` : 'Não informada' },
    { label: 'Nome', value: fullName || 'Não informado' },
    { label: 'WhatsApp', value: whatsapp || 'Não informado' },
    { label: 'Serviços', value: profileType === 'provider' ? `${servicesCreated} cadastrado(s)` : 'Não aplicável' },
  ];

  // ─── Passo 5: Conclusão ───
  const finishOnboarding = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await supabase.from('profiles').update({
        onboarding_completed: true,
        onboarding_step: 5,
      } as any).eq('id', user.id);

      try {
        await (supabase as any).rpc('award_engagement_points', {
          _user_id: user.id,
          _action_key: 'onboarding_basic_complete',
          _metadata: { profile_type: profileType },
        });
      } catch { /* silent */ }

      try {
        celebrate({ intensity: 'big', id: CELEBRATION_IDS.onboardingComplete(user.id) });
      } catch { /* noop */ }

      await refetchProfile();

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
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background p-4">
      {saving && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center gap-4 bg-background/90 backdrop-blur-md">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
          <p className="text-base font-bold text-foreground">Salvando…</p>
        </div>
      )}

      <div className="relative my-6 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        {/* Stepper animado */}
        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold">
          <span className="text-muted-foreground">Passo {step} de {TOTAL_STEPS}</span>
          <motion.span
            key={step}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-accent"
          >
            +{step * 10} pts de confiança
          </motion.span>
        </div>
        <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent via-primary to-accent bg-[length:200%_100%]"
            initial={{ width: 0 }}
            animate={{
              width: `${(step / TOTAL_STEPS) * 100}%`,
              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
            }}
            transition={{
              width: { type: 'spring', stiffness: 90, damping: 18 },
              backgroundPosition: { duration: 3, repeat: Infinity, ease: 'linear' },
            }}
          />
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
            <p className="font-bold">Revisando passo antigo</p>
            <p className="mt-1 text-xs text-muted-foreground">Ao salvar, você volta para seu progresso mais recente.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={returnToProgress}>
              Salvar revisão e voltar ao progresso
            </Button>
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
        {!showFinalSummary && step === 1 && !showSubtypeStep && (
          <Step1Identity
            existingProfileType={hasExistingCadastro ? profileType : null}
            onContinueProfileUpdate={handleContinueProfileUpdate}
            onSelectType={handleSelectType}
          />
        )}

        {!showFinalSummary && step === 1 && showSubtypeStep && profileType === 'provider' && (
          <SubtypeChoice
            onBack={() => { setShowSubtypeStep(false); setProfileType(null); }}
            onSelect={handleSelectSubtype}
          />
        )}

        {/* ─── PASSO 2 ─── */}
        {!showFinalSummary && step === 2 && (
          <Step2Location
            city={city}
            state={state}
            avatarUrl={avatarUrl}
            editingCity={editingCity}
            onEditCity={() => setEditingCity(true)}
            onCityChange={(c, s) => { setCity(c); setState(s); }}
            onAvatarChange={(url) => { setAvatarUrl(url); window.setTimeout(handleStepFieldBlur, 0); }}
            onFieldBlur={handleStepFieldBlur}
            userId={user?.id}
            onBack={() => hasExistingCadastro ? navigate('/dashboard', { replace: true }) : advanceTo(1)}
            onNext={handleStep2Next}
            onSkip={() => advanceTo(3)}
            canAdvance={canAdvanceFromStep2}
          />
        )}

        {/* ─── PASSO 3 ─── */}
        {!showFinalSummary && step === 3 && (
          <Step3Contact
            profileType={profileType}
            fullName={fullName}
            setFullName={setFullName}
            agencyName={agencyName}
            setAgencyName={setAgencyName}
            whatsapp={whatsapp}
            setWhatsapp={setWhatsapp}
            bio={bio}
            setBio={setBio}
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

        {/* ─── PASSO 4 — PROVIDER apenas ─── */}
        {!showFinalSummary && step === 4 && profileType === 'provider' && (
          <Step4Service
            providerReady={!!savedProvider}
            servicesCreated={servicesCreated}
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
        {!showFinalSummary && step === 4 && profileType !== 'provider' && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Avançando…</p>
            <Button className="mt-4" onClick={finishOnboarding}>Concluir</Button>
          </div>
        )}

        {/* ─── PASSO 5 ─── */}
        {!showFinalSummary && step === 5 && (
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
  onDelayChange,
  onRetry,
  onReloadSaved,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error';
  delay: 1000 | 2000 | 3000;
  hasPendingChanges: boolean;
  lastAttemptAt: string | null;
  errorMessage: string | null;
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
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>Tentar salvar novamente</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onReloadSaved} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Recarregar salvos
          </Button>
        </div>
      </div>
    )}
  </div>
  );
};

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

const Step1Identity = ({
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
const Step2Location = ({
  city, state, avatarUrl, editingCity, onEditCity, onCityChange, onAvatarChange,
  userId, onBack, onNext, onSkip, canAdvance, onFieldBlur,
}: any) => (
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
      {userId && (
        <div>
          <label className="mb-2 block text-xs font-semibold text-foreground">Foto de perfil (opcional)</label>
          <div className="flex justify-center">
            <AvatarUpload
              userId={userId}
              currentUrl={avatarUrl}
              initials={(avatarUrl ? '' : 'U')}
              onUploaded={onAvatarChange}
            />
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold text-foreground">Cidade</label>
        {!editingCity && city ? (
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2">
            <span className="text-sm font-bold text-foreground">{city}{state ? ` • ${state}` : ''}</span>
            <button onClick={onEditCity} className="text-xs font-medium text-accent hover:underline">Trocar</button>
          </div>
        ) : (
          <div onBlur={onFieldBlur}>
            <CityAutocomplete value={{ city, state }} onChange={({ city: c, state: s }) => onCityChange(c, s)} />
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

// ─── Passo 3 ───
const Step3Contact = ({
  profileType, fullName, setFullName, agencyName, setAgencyName,
  whatsapp, setWhatsapp, bio, setBio,
  categoriesForPicker, selectedCategoryIds, onToggleCategory,
  saving, canAdvance, onBack, onNext, onSkip, onFieldBlur,
}: any) => (
  <>
    <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5" /> Voltar
    </button>

    <div className="mb-3 flex justify-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
        <Phone className="h-7 w-7 text-accent" />
      </div>
    </div>
    <h1 className="text-center font-display text-xl font-bold text-foreground">Dados de contato</h1>
    <p className="mt-1 text-center text-xs text-muted-foreground">Como os clientes vão te encontrar.</p>

    <div className="mt-5 space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold text-foreground">
          {profileType === 'rh' ? 'Seu nome (responsável)' : 'Seu nome completo'}
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
        <label className="mb-1 block text-xs font-semibold text-foreground">WhatsApp</label>
        <div onBlur={onFieldBlur}>
          <PhoneMaskedInput
            name="whatsapp"
            value={whatsapp}
            onChange={(_n: any, val: string) => setWhatsapp(val)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
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
            <label className="mb-2 block text-xs font-semibold text-foreground">Sua especialidade principal</label>
            <SmartCategoryPicker
              categories={categoriesForPicker}
              selectedIds={selectedCategoryIds}
              onToggle={onToggleCategory}
              maxSelections={1}
              placeholder="Ex: Eletricista, Pintor…"
            />
          </div>
        </>
      )}
    </div>

    <div className="mt-5 grid gap-3">
      <Button variant="accent" className="w-full" disabled={!canAdvance || saving} onClick={onNext}>
        {saving ? 'Salvando…' : 'Salvar e continuar'}
      </Button>
      <Button type="button" variant="outline" className="w-full" onClick={onSkip} disabled={saving}>
        Pular por enquanto
      </Button>
    </div>
  </>
);

// ─── Passo 4 ───
const Step4Service = ({
  providerReady, servicesCreated, savedProvider, userId, categories,
  onServiceCreated, onContinue, onBack, onSkip,
}: any) => (
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
    <p className="mt-1 text-center text-xs text-muted-foreground">Você precisa cadastrar pelo menos 1 serviço.</p>

    <div className="mt-5">
      {providerReady ? (
        servicesCreated > 0 ? (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-accent" />
            <p className="text-sm font-bold text-foreground">
              {servicesCreated === 1 ? '1 serviço cadastrado!' : `${servicesCreated} serviços cadastrados!`}
            </p>
            <Button variant="accent" className="mt-4 w-full" onClick={onContinue}>
              Continuar para o último passo
            </Button>
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

    {servicesCreated === 0 && (
      <button type="button" onClick={onSkip} className="mt-4 w-full text-xs font-medium text-muted-foreground hover:text-foreground">
        Não consigo agora
      </button>
    )}
  </>
);

// ─── Passo 5 ───
const Step5Done = ({
  profileType, servicesCreated, saving, onFinish, onBack,
}: any) => {
  const canFinish = profileType !== 'provider' || servicesCreated > 0;
  const finishLabel = profileType === 'provider' && servicesCreated === 0
    ? 'Entrar no Dashboard e concluir depois'
    : 'Entrar no Dashboard';
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
        Você ganhou <span className="font-bold text-accent">+50 pontos</span> de engajamento por concluir seu cadastro.
      </p>

      {!canFinish && (
        <div className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-3 text-center text-xs text-primary">
          Sem serviço cadastrado, seu perfil pode aparecer incompleto. Você pode finalizar agora e completar depois.
        </div>
      )}

      <Button
        variant="accent"
        className="mt-6 w-full"
        disabled={saving}
        onClick={onFinish}
      >
        {saving ? 'Concluindo…' : finishLabel}
      </Button>
    </>
  );
};

export default SmartOnboardingWizard;
