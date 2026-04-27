/**
 * OnboardingV2Shell — orquestrador das 4 fases.
 *
 * Persistência:
 *  - Final da Fase 1 (sub-passo 4: Nome+WhatsApp) → cria/atualiza provider
 *    via normalizeProviderPayload (mesma fonte do SmartOnboardingWizard).
 *  - Final da Fase 2 → cria 1º serviço via RPC create_service_atomic
 *    e PROPAGA category_id + working_hours para o provider (herança).
 *  - Fase 4 → patches incrementais para provider/profile (idempotentes).
 *
 * Telemetria mínima e segura: usa apenas o que já existe (audit_log via celebrate).
 *
 * Mantém compatibilidade total com o gate de onboarding (App.tsx):
 * grava `profiles.onboarding_step = 5` e `onboarding_completed = true`
 * ao concluir a Fase 2 — destravando o usuário para o dashboard.
 */

import { useEffect, useMemo, useReducer, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { appendWizardResetDebugLog } from '@/lib/wizardResetDebug';
import { normalizeProviderPayload } from '@/lib/providerPayload';
import { useWizardDuplicateCheck } from '@/hooks/useWizardDuplicateCheck';
import {
  initialOnboardingState,
  onboardingReducer,
  phaseIndex,
  VISIBLE_PHASES_COUNT,
} from './state';
import {
  Phase1Action,
  Phase1Kind,
  Phase1Location,
  Phase1Contact,
} from './Phase1Basic';
import { Phase2Service, Phase2Details } from './Phase2Service';
import { Phase2Photos } from './Phase2Photos';
import { Phase3Celebration } from './Phase3Celebration';
import { Phase4Document, Phase4Avatar, Phase4ExtrasA, Phase4ExtrasB } from './Phase4Final';
import {
  useOnboardingV2Draft,
  readOnboardingV2Draft,
  clearOnboardingV2Draft,
} from './useOnboardingV2Draft';
import {
  useOnboardingV2RemoteDraft,
  fetchRemoteDraft,
  clearRemoteDraft,
} from './useOnboardingV2RemoteDraft';
import { trackOnboardingEvent } from './telemetry';
import { RemoteDraftRecoveryModal } from './RemoteDraftRecoveryModal';
import {
  buildOnboardingCoreLocks,
  buildOnboardingV2BootstrapState,
  getPendingOnboardingCoreFields,
  resolveOnboardingV2SeedState,
} from './bootstrap';

function slugify(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export const OnboardingV2Shell = () => {
  const { user, profile, provider, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source');
  // Restaura draft local ao montar (se existir e não estiver expirado)
  const [state, dispatch] = useReducer(onboardingReducer, initialOnboardingState, (init) => {
    const draft = readOnboardingV2Draft();
    if (!draft) return init;
    return {
      ...init,
      profile: { ...init.profile, ...(draft.profile || {}) },
      service: { ...init.service, ...(draft.service || {}) },
      phase: draft.phase || init.phase,
    };
  });
  const [saving, setSaving] = useState(false);
  const [draftRestored, setDraftRestored] = useState<null | { source: 'local' | 'remote'; at?: string }>(null);
  const [remoteDraft, setRemoteDraft] = useState<null | {
    payload: { profile: any; service: any };
    phase: any;
    updated_at: string;
  }>(null);
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const coreLocks = useMemo(() => buildOnboardingCoreLocks({ profile, provider }), [profile, provider]);
  const pendingCoreFields = useMemo(() => getPendingOnboardingCoreFields(coreLocks), [coreLocks]);

  // Frente 4 — duplicidade inline (whatsapp + tax_id)
  const dup = useWizardDuplicateCheck();

  // Auto-save em localStorage com debounce (rápido)
  useOnboardingV2Draft(state);
  // Auto-save remoto com debounce (cross-device)
  useOnboardingV2RemoteDraft(state, user?.id);

  // Aviso de "rascunho restaurado" do LOCAL (mesmo dispositivo)
  useEffect(() => {
    const draft = readOnboardingV2Draft();
    if (draft && draft.phase && draft.phase !== 'phase1_action') {
      setDraftRestored({ source: 'local' });
      const t = setTimeout(() => setDraftRestored(null), 5000);
      return () => clearTimeout(t);
    }
  }, []);

  // Detecta rascunho REMOTO (troca de dispositivo) e ABRE MODAL para o usuário decidir.
  // Não auto-hidrata mais — evita "salto" silencioso de etapa.
  useEffect(() => {
    if (!user?.id) return;
    const local = readOnboardingV2Draft();
    if (local && local.phase && local.phase !== 'phase1_action') return;
    let alive = true;
    (async () => {
      const remote = await fetchRemoteDraft(user.id);
      if (!alive || !remote) return;
      // Se já está vazio (phase inicial), só oferece restaurar; caso contrário pergunta.
      setRemoteDraft(remote);
      setShowRemoteModal(true);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const handleRemoteContinue = () => {
    if (remoteDraft) {
      dispatch({
        type: 'HYDRATE',
        state: {
          profile: remoteDraft.payload.profile,
          service: remoteDraft.payload.service,
          phase: remoteDraft.phase as any,
        },
      });
      setDraftRestored({ source: 'remote', at: remoteDraft.updated_at });
      setTimeout(() => setDraftRestored(null), 6000);
    }
    setShowRemoteModal(false);
    setRemoteDraft(null);
  };

  const handleRemoteDiscard = async () => {
    if (user?.id) await clearRemoteDraft(user.id);
    clearOnboardingV2Draft();
    toast.success('Rascunho descartado. Vamos começar do zero.');
    setShowRemoteModal(false);
    setRemoteDraft(null);
  };


  // Hidrata nome do auth se vier do Google
  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata || {}) as any;
    const guessedName = meta.full_name || meta.name || '';
    if (guessedName && !state.profile.full_name) {
      dispatch({ type: 'PATCH_PROFILE', patch: { full_name: guessedName } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Bootstrap do fluxo único: se o V3 já coletou nome/WhatsApp/cidade,
  // o V2 deve entrar direto na criação do primeiro serviço sem repetir perguntas.
  useEffect(() => {
    const bootstrap = buildOnboardingV2BootstrapState({ profile, provider });
    if (!bootstrap) return;

    const draftSnapshot = {
      phase: state.phase,
      providerId: state.providerId,
      firstServiceId: state.firstServiceId,
      profile: state.profile,
      service: state.service,
    };
    const resolved = resolveOnboardingV2SeedState({ draft: draftSnapshot, bootstrap, source });

    const currentPhase = state.phase || 'phase1_action';
    const nextPhase = resolved.phase || currentPhase;
    const isRegression = phaseIndex(nextPhase) < phaseIndex(currentPhase);

    if (isRegression) {
      appendWizardResetDebugLog({
        source: 'onboarding-v2-phase-regression-blocked',
        route: `${location.pathname}${location.search}`,
        phase: currentPhase,
        nextRoute: null,
        reason: 'bootstrap-attempted-older-phase',
        meta: { currentPhase, nextPhase, source, pendingCoreFields },
      });
      return;
    }

    appendWizardResetDebugLog({
      source: 'onboarding-v2-bootstrap',
      route: `${location.pathname}${location.search}`,
      phase: nextPhase,
      nextRoute: null,
      reason: 'hydrate-from-profile-provider',
      meta: { source, pendingCoreFields, providerId: resolved.providerId ?? null },
    });

    dispatch({ type: 'HYDRATE', state: resolved });
  }, [profile, provider, source]);

  // Telemetria: dispara 'enter' a cada troca de fase
  useEffect(() => {
    void trackOnboardingEvent({
      phase: state.phase,
      event: state.phase === 'done' ? 'complete' : 'enter',
      userId: user?.id,
    });
  }, [state.phase, user?.id]);

  /* ───── Persistência: cria/atualiza provider ao fim da Fase 1 ───── */
  const persistPhase1 = async () => {
    if (!user) {
      toast.error('Sessão expirou. Faça login novamente.');
      return false;
    }
    setSaving(true);
    try {
      const p = state.profile;

      // 1) profile (nome, avatar, profile_type, whatsapp)
      const profilePatch: any = {
        full_name: p.full_name,
        whatsapp: p.whatsapp,
        phone: p.whatsapp,
        avatar_url: p.avatar_url,
        profile_type: p.profile_type || 'provider',
        onboarding_step: 4,
        onboarding_completed: false,
      };
      const { error: profErr } = await supabase
        .from('profiles')
        .update(profilePatch)
        .eq('id', user.id);
      if (profErr) throw profErr;

      // 2) provider apenas se for prestador
      if ((p.profile_type || 'provider') === 'provider') {
        const { data: existing } = await supabase
          .from('providers').select('*').eq('user_id', user.id).limit(1);

        if (existing && existing[0]) {
          const updPayload = normalizeProviderPayload({
            city: p.city || existing[0].city || '',
            state: p.state || existing[0].state || '',
            whatsapp: p.whatsapp || existing[0].whatsapp || '',
            phone: p.whatsapp || existing[0].phone || '',
            account_type: p.kind === 'pj' ? 'company' : 'autonomous',
          });
          const { error } = await supabase.from('providers').update(updPayload as any).eq('id', existing[0].id);
          if (error) throw error;
          dispatch({ type: 'SET_PROVIDER_ID', id: existing[0].id });
        } else {
          const baseSlug = slugify(p.full_name || user.email?.split('@')[0] || 'profissional');
          const insPayload = normalizeProviderPayload({
            user_id: user.id,
            slug: `${baseSlug}-${user.id.slice(0, 6)}`,
            city: p.city || '',
            state: p.state || '',
            whatsapp: p.whatsapp || '',
            phone: p.whatsapp || '',
            account_type: p.kind === 'pj' ? 'company' : 'autonomous',
            status: 'pending',
          });
          const { data: created, error } = await supabase.from('providers').insert(insPayload as any).select('id').single();
          if (error) throw error;
          dispatch({ type: 'SET_PROVIDER_ID', id: created!.id });
        }
      }
      return true;
    } catch (e: any) {
      toast.error('Não consegui salvar. ' + (e?.message || 'Tente de novo.'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  /* ───── Persistência: cria 1º serviço (Fase 2) ───── */
  const persistFirstService = async (): Promise<boolean> => {
    if (!user) return false;
    if (!state.providerId) {
      toast.error('Perfil ainda não foi criado.');
      return false;
    }
    setSaving(true);
    try {
      const s = state.service;
      const p = state.profile;
      const cityForAddress = [p.city, p.state].filter(Boolean).join(' - ');
      const serviceArea = s.cities_served.join('; ');

      // ── INVARIANTE OBRIGATÓRIA ─────────────────────────────────────────────
      // O nome do 1º serviço é SEMPRE o nome oficial da categoria escolhida e
      // o primary_category_id do prestador recebe o MESMO category_id.
      // Resolvemos o nome via banco para evitar divergência de cache local.
      const categoryId = s.category_ids[0] || null;
      if (!categoryId) {
        toast.error('Selecione uma categoria antes de publicar o serviço.');
        setSaving(false);
        return false;
      }
      let resolvedCategoryName = (s.service_name || '').trim();
      try {
        const { data: catRow } = await supabase
          .from('categories')
          .select('name')
          .eq('id', categoryId)
          .maybeSingle();
        if (catRow?.name) resolvedCategoryName = catRow.name;
      } catch { /* fallback no nome local */ }
      if (!resolvedCategoryName) {
        toast.error('Categoria inválida. Escolha novamente.');
        setSaving(false);
        return false;
      }
      // Sincroniza estado local com o nome canônico (mantém UI consistente).
      const localName = (s.service_name || '').trim();
      const localPrimary = state.profile.primary_category_id;
      const nameMismatch = localName.toLowerCase() !== resolvedCategoryName.trim().toLowerCase();
      const primaryMismatch = localPrimary !== categoryId;
      if (nameMismatch || primaryMismatch) {
        // LOG DE DIVERGÊNCIA — registra no console + telemetria para correção imediata.
        const divergence = {
          where: 'persistFirstService.invariant_check',
          categoryId,
          resolvedCategoryName,
          localName,
          localPrimaryCategoryId: localPrimary,
          nameMismatch,
          primaryMismatch,
        };
        console.warn('[onboardingV2] divergência categoria/serviço detectada e auto-corrigida:', divergence);
        void trackOnboardingEvent({
          phase: state.phase,
          event: 'error',
          userId: user?.id,
          meta: { reason: 'category_service_divergence', ...divergence },
        });
      }
      if (nameMismatch) {
        dispatch({ type: 'PATCH_SERVICE', patch: { service_name: resolvedCategoryName } });
      }
      if (primaryMismatch) {
        dispatch({ type: 'PATCH_PROFILE', patch: { primary_category_id: categoryId } });
      }

      // 1) RPC oficial — cria serviço atomicamente
      const { data, error } = await (supabase as any).rpc('create_service_atomic', {
        _provider_id: state.providerId,
        _service_name: resolvedCategoryName, // ← invariante reforçada
        _description: s.description || '',
        _whatsapp: p.whatsapp,
        _service_area: serviceArea,
        _address: cityForAddress,
        _working_hours: s.working_hours,
        _website: '',
        _instagram_url: '',
        _facebook_url: '',
        _youtube_url: '',
        _category_id: categoryId,
        _category_ids: [categoryId, ...s.category_ids.slice(1)],
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Falha ao criar serviço');
      }
      dispatch({ type: 'SET_FIRST_SERVICE_ID', id: data.service_id });

      // 2) Herança — categoria principal + horário sobem para o provider
      const updates: any = { category_id: categoryId };
      if (s.working_hours) updates.working_hours = s.working_hours;
      if (s.starting_price_brl != null) updates.starting_price = s.starting_price_brl;
      await supabase.from('providers').update(updates).eq('id', state.providerId);

      // 3) Marca onboarding completo. A categoria principal vive em providers.category_id
      // (já atualizada acima); profiles.primary_category_id é apenas estado de UI no wizard.
      await supabase.from('profiles')
        .update({ onboarding_step: 5, onboarding_completed: true })
        .eq('id', user.id);

      return true;
    } catch (e: any) {
      toast.error('Erro ao publicar serviço: ' + (e?.message || 'tente novamente'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  /* ───── Persistência: patches incrementais Fase 4 ───── */
  const persistPatch = async (patch: Record<string, any>): Promise<boolean> => {
    if (!user || !state.providerId) return true;
    setSaving(true);
    try {
      const safe = normalizeProviderPayload(patch);
      const { error } = await supabase.from('providers').update(safe as any).eq('id', state.providerId);
      if (error) throw error;
      // Salva também tax_id no profile se vier
      if (patch.tax_id) {
        await supabase.from('profiles').update({ tax_id: patch.tax_id }).eq('id', user.id);
      }
      return true;
    } catch (e: any) {
      toast.error('Não consegui salvar este passo agora. ' + (e?.message || ''));
      return false;
    } finally {
      setSaving(false);
    }
  };

  /* ───── Telemetria helpers ───── */
  const track = (event: 'next' | 'back' | 'skip' | 'submit' | 'error', meta: Record<string, unknown> = {}) =>
    void trackOnboardingEvent({ phase: state.phase, event, userId: user?.id, meta });

  /* ───── Render por fase ───── */

  const finishWizard = async () => {
    clearOnboardingV2Draft();
    if (user?.id) void clearRemoteDraft(user.id);

    if (user?.id && !state.firstServiceId) {
      const { error } = await supabase.from('profiles')
        .update({ onboarding_step: 5, onboarding_completed: true })
        .eq('id', user.id);

      if (error) {
        toast.error('Não consegui concluir seu perfil agora. ' + (error.message || 'Tente de novo.'));
        return;
      }

      await refetchProfile?.();
    }

    toast.success('Perfil completo! Bem-vindo.');
    navigate('/onboarding-v2/sucesso');
  };

  const continueWithoutFirstService = async () => {
    if (!user?.id) return;

    appendWizardResetDebugLog({
      source: 'onboarding-v2-skip-first-service',
      route: `${location.pathname}${location.search}`,
      phase: state.phase,
      nextRoute: 'phase4_document',
      reason: 'continue-profile-without-first-service',
      meta: {
        providerId: state.providerId,
        source,
        pendingCoreFields,
      },
    });

    setSaving(true);
    try {
      dispatch({ type: 'GO_TO', phase: 'phase4_document' });
    } catch (e: any) {
      track('error', { reason: 'skip_first_service_failed', message: e?.message || null });
      toast.error('Não consegui continuar sem o serviço agora. ' + (e?.message || 'Tente de novo.'));
    } finally {
      setSaving(false);
    }
  };

  const renderPhase = () => {
    switch (state.phase) {
      case 'phase1_action':
        return (
          <Phase1Action
            onSelect={(t) => {
              dispatch({ type: 'PATCH_PROFILE', patch: { profile_type: t } });
              if (t === 'provider') dispatch({ type: 'NEXT' });
              else {
                // Fluxos não-provider saem para rotas dedicadas, mantendo escopo enxuto
                if (t === 'sponsor') navigate('/quero-ser-patrocinador');
                else navigate('/dashboard');
              }
            }}
          />
        );
      case 'phase1_kind':
        return (
          <Phase1Kind
            onBack={() => { track('back'); dispatch({ type: 'GO_TO', phase: 'phase1_action' }); }}
            onSelect={(kind) => {
              dispatch({ type: 'PATCH_PROFILE', patch: { kind } });
              track('next', { kind });
              dispatch({ type: 'NEXT' });
            }}
          />
        );
      case 'phase1_location':
        return (
          <Phase1Location
            data={state.profile}
            locks={coreLocks}
            onChange={(patch) => dispatch({ type: 'PATCH_PROFILE', patch })}
            onBack={() => { track('back'); dispatch({ type: 'GO_TO', phase: 'phase1_kind' }); }}
            onNext={() => { track('next'); dispatch({ type: 'NEXT' }); }}
            onSkip={() => { track('skip'); dispatch({ type: 'SKIP_TO_NEXT' }); }}
          />
        );
      case 'phase1_contact':
        return (
          <Phase1Contact
            data={state.profile}
            locks={coreLocks}
            onChange={(patch) => dispatch({ type: 'PATCH_PROFILE', patch })}
            onBack={() => { track('back'); dispatch({ type: 'GO_TO', phase: 'phase1_location' }); }}
            saving={saving}
            duplicateWhatsapp={dup.duplicates.whatsapp}
            checkingWhatsapp={dup.checking.whatsapp}
            onWhatsappBlur={async () => {
              if (state.profile.whatsapp.replace(/\D/g, '').length >= 10) {
                const isDup = await dup.checkWhatsapp(state.profile.whatsapp, user?.id);
                if (isDup) toast.error('Este WhatsApp já está cadastrado em outra conta.');
              }
            }}
            onSubmit={async () => {
              if (dup.duplicates.whatsapp) {
                track('error', { reason: 'duplicate_whatsapp' });
                toast.error('Corrija o WhatsApp duplicado antes de continuar.');
                return;
              }
              const isDup = await dup.checkWhatsapp(state.profile.whatsapp, user?.id);
              if (isDup) {
                track('error', { reason: 'duplicate_whatsapp' });
                toast.error('Este WhatsApp já está cadastrado em outra conta.');
                return;
              }
              track('submit');
              const ok = await persistPhase1();
              if (ok) { track('next'); dispatch({ type: 'NEXT' }); }
              else track('error', { reason: 'persist_phase1_failed' });
            }}
          />
        );
      case 'phase2_service':
        return (
          <Phase2Service
            service={state.service}
            profile={state.profile}
            onChangeService={(patch) => dispatch({ type: 'PATCH_SERVICE', patch })}
            onChangeProfile={(patch) => dispatch({ type: 'PATCH_PROFILE', patch })}
            onBack={() => { track('back'); dispatch({ type: 'GO_TO', phase: 'phase1_contact' }); }}
            onNext={() => { track('next'); dispatch({ type: 'NEXT' }); }}
            onSkip={() => {
              track('skip', { exit: 'phase4_document' });
              toast.info('Tudo certo. Vamos continuar seu perfil e você cadastra o serviço depois.');
              void continueWithoutFirstService();
            }}
          />
        );
      case 'phase2_details':
        return (
          <Phase2Details
            service={state.service}
            profile={state.profile}
            onChangeService={(patch) => dispatch({ type: 'PATCH_SERVICE', patch })}
            onChangeProfile={(patch) => dispatch({ type: 'PATCH_PROFILE', patch })}
            onBack={() => { track('back'); dispatch({ type: 'GO_TO', phase: 'phase2_service' }); }}
            saving={saving}
            onSkip={async () => {
              track('skip');
              const ok = await persistFirstService();
              if (ok) dispatch({ type: 'NEXT' });
              else track('error', { reason: 'persist_service_failed' });
            }}
            onSubmit={async () => {
              track('submit');
              const ok = await persistFirstService();
              if (ok) { track('next'); dispatch({ type: 'NEXT' }); }
              else track('error', { reason: 'persist_service_failed' });
            }}
          />
        );
      case 'phase2_photos':
        // Sem serviço criado, pula direto pra celebração
        if (!state.firstServiceId || !user?.id) {
          dispatch({ type: 'NEXT' });
          return null;
        }
        return (
          <Phase2Photos
            serviceId={state.firstServiceId}
            userId={user.id}
            serviceName={state.service.service_name}
            onContinue={() => { track('next'); dispatch({ type: 'NEXT' }); }}
            onSkip={() => { track('skip'); dispatch({ type: 'NEXT' }); }}
          />
        );
      case 'phase3_celebration':
        return (
          <Phase3Celebration
            serviceName={state.service.service_name}
            city={state.profile.city}
            state={state.profile.state}
            userId={user?.id}
            onContinue={() => { track('next'); dispatch({ type: 'NEXT' }); }}
          />
        );
      case 'phase4_document':
        return (
          <Phase4Document
            data={state.profile}
            locked={!!coreLocks.document}
            onChange={(patch) => dispatch({ type: 'PATCH_PROFILE', patch })}
            saving={saving}
            userId={user?.id}
            onSkip={() => { track('skip'); dispatch({ type: 'NEXT' }); }}
            onContinue={async () => {
              track('submit');
              if (!coreLocks.document) {
                await persistPatch({ tax_id: state.profile.document });
              }
              track('next');
              dispatch({ type: 'NEXT' });
            }}
          />
        );
      case 'phase4_avatar':
        // Pula apenas se já tem foto. Caso contrário, é OBRIGATÓRIO mostrar.
        if (state.profile.avatar_url) {
          dispatch({ type: 'NEXT' });
          return null;
        }
        return (
          <Phase4Avatar
            data={state.profile}
            onChange={(patch) => dispatch({ type: 'PATCH_PROFILE', patch })}
            saving={saving}
            userId={user?.id}
            onSkip={() => { track('skip'); dispatch({ type: 'NEXT' }); }}
            onContinue={async () => {
              track('submit');
              if (state.profile.avatar_url) {
                await persistPatch({ photo_url: state.profile.avatar_url });
                await supabase.from('profiles')
                  .update({ avatar_url: state.profile.avatar_url })
                  .eq('id', user!.id);
              }
              track('next');
              dispatch({ type: 'NEXT' });
            }}
          />
        );
      case 'phase4_extras_a':
        // Regra de Ouro: só pula se AMBOS já estão preenchidos.
        // (Antes pulava com apenas um, deixando perfil incompleto.)
        if (state.profile.neighborhood && state.profile.bio && state.profile.bio.length >= 20) {
          dispatch({ type: 'NEXT' });
          return null;
        }
        return (
          <Phase4ExtrasA
            data={state.profile}
            onChange={(patch) => dispatch({ type: 'PATCH_PROFILE', patch })}
            saving={saving}
            onSkip={() => { track('skip'); dispatch({ type: 'NEXT' }); }}
            onContinue={async () => {
              track('submit');
              await persistPatch({
                neighborhood: state.profile.neighborhood,
                description: state.profile.bio,
              });
              track('next');
              dispatch({ type: 'NEXT' });
            }}
          />
        );
      case 'phase4_extras_b':
        // Só pula se AMBAS as redes já existem.
        if (state.profile.instagram_url && state.profile.facebook_url) {
          dispatch({ type: 'GO_TO', phase: 'done' });
          return null;
        }
        return (
          <Phase4ExtrasB
            data={state.profile}
            onChange={(patch) => dispatch({ type: 'PATCH_PROFILE', patch })}
            saving={saving}
            onSkip={() => { track('skip'); dispatch({ type: 'GO_TO', phase: 'done' }); }}
            onFinish={async () => {
              track('submit');
              await persistPatch({
                instagram_url: state.profile.instagram_url,
                facebook_url: state.profile.facebook_url,
              });
              dispatch({ type: 'GO_TO', phase: 'done' });
            }}
          />
        );
      case 'done':
        // Limpa rascunho local e auto-finaliza
        clearOnboardingV2Draft();
        setTimeout(finishWizard, 300);
        return null;
    }
  };

  // Progresso: a celebração já é "100%" sensorial, então tudo a partir dela conta como completo.
  const isCelebrationOrLater =
    state.phase === 'phase3_celebration' ||
    state.phase === 'phase4_document' ||
    state.phase === 'phase4_extras_a' ||
    state.phase === 'phase4_extras_b' ||
    state.phase === 'done';
  const progress = isCelebrationOrLater
    ? 100
    : Math.min(95, ((phaseIndex(state.phase) + 1) / VISIBLE_PHASES_COUNT) * 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Barra de progresso fixa no topo */}
      <div className="sticky top-0 z-50 h-1 w-full bg-muted">
        <motion.div
          className="h-full bg-gradient-to-r from-accent to-primary"
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
      </div>

      {/* Aviso "rascunho restaurado" — diferencia local x remoto */}
      <AnimatePresence>
        {draftRestored && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-auto mt-3 flex max-w-md items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-foreground"
          >
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-accent shrink-0" />
            <div className="space-y-0.5">
              {draftRestored.source === 'remote' ? (
                <>
                  <p className="font-semibold">Rascunho de outro dispositivo restaurado.</p>
                  <p className="text-muted-foreground">
                    Trouxemos seus dados salvos
                    {draftRestored.at && (
                      <> em {new Date(draftRestored.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</>
                    )}.
                  </p>
                </>
              ) : (
                <p>Continuamos de onde você parou neste dispositivo.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-md px-4 py-6 sm:py-10">
        {pendingCoreFields.length < 5 && (
          <div className="mb-4 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Já preenchido:</span>{' '}
            {[
              coreLocks.full_name ? 'nome' : null,
              coreLocks.whatsapp ? 'WhatsApp' : null,
              coreLocks.city ? 'cidade' : null,
              coreLocks.state ? 'UF' : null,
              coreLocks.document ? 'documento' : null,
            ].filter(Boolean).join(' • ')}
            {pendingCoreFields.length > 0 && (
              <>
                <span className="mx-1">—</span>
                pendente: {pendingCoreFields.join(', ')}
              </>
            )}
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={state.phase}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {renderPhase()}
          </motion.div>
        </AnimatePresence>
      </main>

      <RemoteDraftRecoveryModal
        open={showRemoteModal}
        payload={remoteDraft?.payload || null}
        phase={(remoteDraft?.phase as any) || null}
        updatedAt={remoteDraft?.updated_at || null}
        onContinue={handleRemoteContinue}
        onDiscard={handleRemoteDiscard}
      />
    </div>
  );
};

export default OnboardingV2Shell;
