/**
 * WizardShell — fachada ÚNICA do onboarding unificado (Consolidação Fase 2).
 *
 * Encapsula triagem (ex-Bet Mode V3) + criação de serviço & perfil (ex-V2)
 * sob um único componente, sem trocar de URL. Este é o ÚNICO componente
 * exportado publicamente do wizard.
 *
 * Adições da Fase 2:
 *  - Botão "Voltar" sticky e visível em TODO passo (exceto o primeiro e a
 *    celebração final), via `WizardNav`.
 *  - Bordão de Avançar com animação visível (pulse + glow accent→primary)
 *    entregue como CTA padrão dos steps que aceitam `onNext` direto.
 *  - Telemetria unificada por fase: cada avanço de `unifiedPhase` registra
 *    um evento em `onboarding_events` (variante `unified`).
 *  - Reducer público linear (`wizardReducer`) é a fonte de verdade do
 *    progresso global. Os orquestradores internos (`TriageOrchestrator` e
 *    `MainOrchestrator`) reportam sua fase via `onPhaseChange` para manter
 *    a barra global e a telemetria sincronizadas.
 *
 * Os orquestradores internos NÃO são exportados — são detalhe de
 * implementação. Toda persistência (provider, create_service_atomic,
 * patches incrementais, drafts local + remote) permanece encapsulada lá.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, Briefcase, FolderOpen, Sparkles } from 'lucide-react';
import TriageOrchestrator from '@/components/onboarding/wizard/phases/bet/BetModeShell';
import { OnboardingV2Shell as MainOrchestrator } from '@/components/onboarding/wizard/phases/v2/OnboardingV2Shell';
import { buildOnboardingV2BootstrapState } from '@/components/onboarding/wizard/phases/v2/bootstrap';
import { fetchExistingFirstService, findExistingProvider } from '@/components/onboarding/wizard/phases/v2/findExistingRecords';
import Step20_MoreServices from '@/components/onboarding/wizard/phases/Step20_MoreServices';
import Step21_PortfolioAlbums from '@/components/onboarding/wizard/phases/Step21_PortfolioAlbums';
import InstallAppCard from '@/components/onboarding/wizard/InstallAppCard';
import { Button } from '@/components/ui/button';
import PointsHud from '@/components/onboarding/wizard/phases/bet/PointsHud';
import BetCardShell from '@/components/onboarding/wizard/BetCardShell';
import { useEngagementPointsValue } from '@/hooks/useEngagementPoints';
import { useAuth } from '@/hooks/useAuth';
import { appendWizardResetDebugLog } from '@/lib/wizardResetDebug';
import { getOnboardingReviewSection, markOnboardingCompletionGrace, type OnboardingReviewSection } from '@/lib/onboardingAccess';
import { supabase } from '@/integrations/supabase/client';
import { clearOnboardingV2Draft } from '@/components/onboarding/wizard/phases/v2/useOnboardingV2Draft';
import { clearSessionTouched } from '@/components/onboarding/wizard/phases/v2/sessionTouched';
import { clearRemoteDraft } from '@/components/onboarding/wizard/phases/v2/useOnboardingV2RemoteDraft';
import { clearBetDraft } from '@/components/onboarding/wizard/phases/bet/useBetDraft';
import { clearRemoteBetDraft } from '@/components/onboarding/wizard/phases/bet/useBetRemoteDraft';
import { WizardProgressBar } from './WizardProgressBar';
import ExitIntentDialog from './ExitIntentDialog';
import EditModeSkipButton from './EditModeSkipButton';
import { WizardModeContext, resolveWizardMode, type WizardMode } from './wizardMode';
import { trackOnboardingEvent, setOnboardingIntent } from './phases/v2/telemetry';
import {
  initialWizardState,
  mapMainPhaseToUnified,
  mapUnifiedToMainPhase,
  mapTriagePhaseToUnified,
  PROVIDER_WIZARD_PHASE_ORDER,
  unifiedPhaseIndex,
  UNIFIED_PHASE_LABELS,
  UNIFIED_VISIBLE_PHASES,
  wizardReducer,
  type UnifiedPhase,
} from './wizardReducer';
import type { BetState } from './phases/bet/types';

type Stage = 'triage' | 'service-and-profile' | 'extras-services' | 'extras-portfolio' | 'done';

interface WizardShellProps {
  /**
   * Modo de operação do wizard.
   *  - `new_signup` (default): fluxo completo para novos usuários.
   *  - `edit_profile`: usuário voltando para revisar/editar; ativa o atalho
   *    "Pular esta etapa" quando a fase já está 100% preenchida.
   *  - `add_service`: perfil já existe; foco é adicionar um novo serviço.
   */
  mode?: WizardMode;
  reviewSection?: OnboardingReviewSection | null;
  /** @deprecated Use `mode='edit_profile'`. Mantido por compatibilidade. */
  reviewMode?: boolean;
}

function resolveReviewStartPhase(section: OnboardingReviewSection | null): UnifiedPhase {
  switch (section) {
    case 'servicos':
      return 'main_service';
    case 'dados':
      return 'main_document';
    case 'portfolio':
      return 'main_portfolio_albums';
    case 'url':
      return 'main_extras_b';
    case 'cadastro':
    default:
      return 'main_action';
  }
}

export default function WizardShell({ mode, reviewMode = false, reviewSection = null }: WizardShellProps) {
  // Resolve o modo efetivo (mode > reviewMode boolean > default new_signup).
  const resolvedMode = resolveWizardMode({ mode, reviewMode });
  const isReview = resolvedMode === 'edit_profile';
  const { user, profile, provider } = useAuth();
  const navigate = useNavigate();
  const realPoints = useEngagementPointsValue(user?.id);
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const resumeBootstrapRef = useRef(false);
  // Stage continua como "qual orquestrador renderizar" — é derivado da fase.
  const stage: Stage =
    state.phase.startsWith('triage_')
      ? 'triage'
      : state.phase === 'main_more_services'
      ? 'extras-services'
      : state.phase === 'main_portfolio_albums'
      ? 'extras-portfolio'
      : state.phase === 'done'
      ? 'done'
      : 'service-and-profile';
  const lastTrackedPhase = useRef<UnifiedPhase | null>(null);

  // Telemetria: registra cada avanço de fase unificada UMA vez.
  useEffect(() => {
    if (lastTrackedPhase.current === state.phase) return;
    lastTrackedPhase.current = state.phase;
    void trackOnboardingEvent({
      phase: state.phase as any,
      event: state.phase === 'done' ? 'complete' : 'enter',
      meta: { variant: 'unified', stage },
    });
  }, [state.phase, stage]);

  const handleTriageDone = useCallback((triageState: BetState) => {
    appendWizardResetDebugLog({
      source: 'wizard-shell-handoff',
      route: '/cadastro-inicial',
      nextRoute: '/cadastro-inicial',
      phase: 'phase2_service',
      reason: 'internal-handoff-triage-to-service',
      meta: { stage: 'service-and-profile', unified: true },
    });
    dispatch({
      type: 'HYDRATE',
      state: {
        phase: 'main_service',
        triage: triageState,
        profile: {
          ...state.profile,
          profile_type: 'provider',
          kind: triageState.pro_kind || 'pf',
          full_name: triageState.full_name,
          whatsapp: triageState.whatsapp,
          document: triageState.document,
          city: triageState.city,
          state: triageState.state,
          neighborhood: triageState.neighborhood,
          // Endereço comercial PJ (opcional) — propagado da triagem para
          // que apareça na Review e seja persistido em providers.*.
          ...(triageState.pro_kind === 'pj' && {
            street: triageState.street || state.profile.street,
            street_number: triageState.street_number || state.profile.street_number,
            complement: triageState.complement || state.profile.complement,
            postal_code: triageState.postal_code || state.profile.postal_code,
            show_full_address:
              typeof triageState.show_full_address === 'boolean'
                ? triageState.show_full_address
                : state.profile.show_full_address,
          }),
        },
        service: {
          ...state.service,
          cities_served: triageState.city ? [triageState.city] : [],
        },
      },
    });
  }, [state.profile, state.service]);

  // Bootstrap ÚNICO: roda no máximo uma vez por mount (guardado por
  // `resumeBootstrapRef`). Lê o estado atual via ref para evitar
  // re-execução cada vez que o reducer dispara dispatch — antes este efeito
  // tinha 7 dependências reativas e era a maior fonte de "ping-pong" no
  // wizard. Agora as deps são apenas as ENTRADAS externas estáveis (user,
  // profile, provider, modo de review) — exatamente o que descobrimos no
  // wizard de cada ciclo.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (resumeBootstrapRef.current) return;
    if (state.phase !== 'triage_identity') return;

    const bootstrap = buildOnboardingV2BootstrapState({ profile, provider });
    const isProviderJourney = profile?.profile_type === 'provider' || !!provider || !!bootstrap;
    if (!isProviderJourney) return;

    let cancelled = false;
    void (async () => {
      const providerId =
        bootstrap?.providerId ??
        provider?.id ??
        await findExistingProvider(user?.id ?? null, profile?.user_ref ?? null);

      const existingService = await fetchExistingFirstService(
        providerId ?? null,
        profile?.user_ref ?? null,
        bootstrap?.profile?.primary_category_id ?? null,
      );

      if (cancelled) return;

      // Snapshot do state no MOMENTO do bootstrap (não reativo). Garantimos
      // assim que a única chance de hidratação aconteça aqui — qualquer
      // patch posterior do usuário NÃO disparará re-bootstrap.
      const currentState = stateRef.current;
      const profileSeed = bootstrap?.profile ?? currentState.profile;
      const serviceSeed = bootstrap?.service ?? currentState.service;

      resumeBootstrapRef.current = true;
      dispatch({
        type: 'HYDRATE',
          state: {
              phase: isReview
                ? resolveReviewStartPhase(reviewSection ?? getOnboardingReviewSection(window.location.search))
              : existingService
                ? profile?.onboarding_completed === true
                  ? 'main_more_services'
                  : 'main_document'
                : mapMainPhaseToUnified(bootstrap?.phase ?? 'phase2_service'),
          triage: {
            intent: 'professional',
            phase: 'done',
            full_name: profileSeed.full_name,
            whatsapp: profileSeed.whatsapp,
            city: profileSeed.city,
            state: profileSeed.state,
            neighborhood: profileSeed.neighborhood,
            latitude: null,
            longitude: null,
            ibge_code: null,
            location_source: null,
            pro_kind: profileSeed.kind,
            document: profileSeed.document,
            company_name: '',
            street: '',
            street_number: '',
            complement: '',
            postal_code: '',
            show_full_address: false,
            street_suggested: '',
            street_suggested_cep: '',
            street_confirmed: false,
            bairro_sugerido_cep: '',
            cep_history: [],
            avatar_url: profileSeed.avatar_url ?? null,
            avatar_source: profileSeed.avatar_source ?? null,
            avatar_seed: profileSeed.avatar_seed ?? 0,
            points: Number(profile?.engagement_points ?? currentState.triage.points ?? 0),
            rewards: {
              name: true,
              whatsapp: true,
              intent: true,
              city: true,
              pro_kind: true,
              document: Boolean(profileSeed.document),
            },
          },
          profile: profileSeed,
          service: (() => {
            // Reidratação FIEL do 1º serviço: puxa TODOS os campos existentes
            // (nome, descrição, categoria, áreas atendidas, preço, horários,
            // estrutura de horários e endereço) para que o modo revisão mostre
            // exatamente o que já está publicado e não force re-upload de fotos
            // nem reescrita de dados. Bairro vai pelo profileSeed.
            const parseAreas = (value: string | null | undefined): string[] =>
              String(value || '')
                .split(/[;|•\n]+/)
                .map((item) => item.trim())
                .filter(Boolean);
            const parsePrice = (value: string | null | undefined): number | null => {
              if (!value) return null;
              const n = parseFloat(String(value).replace(/[^\d,.]/g, '').replace(',', '.'));
              return Number.isFinite(n) ? n : null;
            };
            const existingAreas = existingService
              ? parseAreas(existingService.service_area) || parseAreas(existingService.address)
              : [];
            return {
              ...serviceSeed,
              service_name: serviceSeed.service_name || existingService?.service_name || '',
              description: serviceSeed.description || existingService?.description || '',
              category_ids: serviceSeed.category_ids?.length
                ? serviceSeed.category_ids
                : existingService?.category_id
                ? [existingService.category_id]
                : [],
              cities_served: serviceSeed.cities_served?.length
                ? serviceSeed.cities_served
                : existingAreas.length
                ? existingAreas
                : profileSeed.city
                ? [profileSeed.city]
                : [],
              starting_price_brl:
                serviceSeed.starting_price_brl != null
                  ? serviceSeed.starting_price_brl
                  : parsePrice(existingService?.price),
              working_hours: serviceSeed.working_hours || existingService?.working_hours || '',
              working_hours_struct: (() => {
                if (serviceSeed.working_hours_struct) return serviceSeed.working_hours_struct;
                const raw = existingService?.working_hours_struct;
                if (!raw?.ranges?.length) return null;
                return {
                  ranges: raw.ranges.map((r) => ({
                    days: Array.isArray(r?.days) ? r.days : [],
                    start: typeof r?.start === 'string' ? r.start : '',
                    end: typeof r?.end === 'string' ? r.end : '',
                  })),
                };
              })(),
            };
          })(),
          providerId: providerId ?? null,
          firstServiceId: existingService?.id ?? null,
        },
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.id, provider?.id, resolvedMode, reviewSection]);

  const handleTriagePhaseChange = useCallback((betPhase: string) => {
    dispatch({ type: 'GO_TO_PHASE', phase: mapTriagePhaseToUnified(betPhase) });
  }, []);

  const handleMainPhaseChange = useCallback((v2Phase: string) => {
    dispatch({ type: 'GO_TO_PHASE', phase: mapMainPhaseToUnified(v2Phase) });
  }, []);

  // Botão de voltar global — usa o histórico do navegador como fallback
  // já que cada step já tem Voltar próprio integrado ao reducer interno.
  const showGlobalBack =
    state.phase !== 'triage_identity' &&
    state.phase !== 'triage_celebration' &&
    state.phase !== 'main_celebration' &&
    state.phase !== 'done';

  const handleGlobalBack = useCallback(() => {
    void trackOnboardingEvent({
      phase: state.phase as any,
      event: 'back',
      meta: { variant: 'unified', source: 'global-nav' },
    });
    // Dispara um evento DOM que os steps podem opcionalmente capturar.
    // Como fallback, o usuário também tem o botão "Voltar" interno do step.
    window.dispatchEvent(new CustomEvent('wizard:request-back', { detail: { phase: state.phase } }));
  }, [state.phase]);

  // Pontos REAIS lidos de profiles.engagement_points (atualizados pelos triggers
  // de banco a cada ação concluída). Fora da triagem usamos o valor do banco;
  // dentro da triagem o BetModeShell já renderiza seu próprio HUD com pontos
  // somados localmente em tempo real.
  const phaseIdx = unifiedPhaseIndex(state.phase);
  const hudPoints = realPoints;
  const hudProgress = Math.min(1, (phaseIdx + 1) / UNIFIED_VISIBLE_PHASES);
  const hudLabel = UNIFIED_PHASE_LABELS[state.phase] ?? '';
  const showGlobalHud = stage !== 'triage' && stage !== 'done';
  const progressOrder = state.triage.intent === 'professional' ? PROVIDER_WIZARD_PHASE_ORDER : undefined;
  const holdTriageWhileReviewBootstraps = isReview && !resumeBootstrapRef.current && state.phase === 'triage_identity';

  // Sincroniza intent real do reducer → sessionStorage para auto-injeção em
  // todos os eventos de telemetria (milestone, skip, next, error, complete).
  useEffect(() => {
    const i = state.triage.intent;
    if (i === 'professional' || i === 'client' || i === 'rh') {
      setOnboardingIntent(i);
    }
  }, [state.triage.intent]);

  const finalizeUnifiedOnboarding = useCallback(async () => {
    markOnboardingCompletionGrace();
    clearOnboardingV2Draft();
    clearSessionTouched();
    clearBetDraft();

    if (user?.id) {
      void clearRemoteDraft(user.id);
      void clearRemoteBetDraft(user.id);

      try {
        const { error } = await supabase
          .from('profiles')
          .update({ profile_type: 'provider', onboarding_step: 5, onboarding_completed: true })
          .eq('id', user.id);
        if (error) console.warn('[WizardShell] unified finalize profile update failed (fail-soft)', error);
      } catch (error) {
        console.warn('[WizardShell] unified finalize profile update threw (fail-soft)', error);
      }
    }
  }, [user?.id]);

  // Finaliza o onboarding e navega para o caminho informado. Garante que o
  // OnboardingGate não rebata o usuário de volta para /cadastro-inicial.
  const finalizeAndNavigateTo = useCallback(async (path: string) => {
    await finalizeUnifiedOnboarding();
    navigate(path);
  }, [finalizeUnifiedOnboarding, navigate]);

  return (
    <WizardModeContext.Provider value={{ mode: resolvedMode, isEditing: isReview }}>
    <div className="min-h-[100svh] text-[15px] leading-snug bg-gradient-to-b from-background via-background to-amber-50/30 dark:to-amber-950/10">
      <EditModeSkipButton state={state} phase={state.phase} />
      <ExitIntentDialog
        phase={state.phase}
        intent={
          state.triage.intent === 'client'
            ? 'client'
            : state.triage.intent === 'professional'
            ? 'professional'
            : 'unknown'
        }
        hasFirstService={Boolean(state.firstServiceId)}
        wizardState={{
          phase: state.phase as any,
          profile: state.profile as any,
          service: state.service as any,
          firstServiceId: state.firstServiceId,
        }}
        enabled={state.phase !== 'triage_celebration' && state.phase !== 'main_celebration' && state.phase !== 'done'}
      />
      <WizardProgressBar phase={state.phase} phaseOrder={progressOrder} />
      {showGlobalHud && (
        <PointsHud points={hudPoints} phaseLabel={hudLabel} progress={hudProgress} />
      )}
      {showGlobalBack && (
        <div className="sticky top-3 z-30 mx-auto flex w-full max-w-5xl px-4 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleGlobalBack}
            className="gap-2 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>
      )}
      {holdTriageWhileReviewBootstraps ? (
        <div className="mx-auto w-full max-w-md px-4 py-10">
          <BetCardShell>
            <div className="space-y-3">
              <div className="h-6 w-40 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
            </div>
          </BetCardShell>
        </div>
      ) : stage === 'triage' ? (
        <TriageOrchestrator
          onInternalHandoff={handleTriageDone}
          onPhaseChange={handleTriagePhaseChange}
        />
      ) : stage === 'extras-services' ? (
        <BetCardShell>
          <Step20_MoreServices
            onContinue={() => dispatch({ type: 'GO_TO_PHASE', phase: 'main_portfolio_albums' })}
            onSkip={() => dispatch({ type: 'GO_TO_PHASE', phase: 'main_portfolio_albums' })}
            onGoToPath={finalizeAndNavigateTo}
          />
        </BetCardShell>
      ) : stage === 'extras-portfolio' ? (
        <BetCardShell>
          <Step21_PortfolioAlbums
            onContinue={() => {
              void finalizeUnifiedOnboarding().finally(() => {
                dispatch({ type: 'GO_TO_PHASE', phase: 'done' });
              });
            }}
            onSkip={() => {
              void finalizeUnifiedOnboarding().finally(() => {
                dispatch({ type: 'GO_TO_PHASE', phase: 'done' });
              });
            }}
            onGoToPath={finalizeAndNavigateTo}
          />
        </BetCardShell>
      ) : stage === 'done' ? (
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
          <BetCardShell className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-400 shadow-[0_0_24px_rgba(251,146,60,0.7)]">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Tudo pronto!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Seu perfil base foi concluído com <span className="font-semibold text-amber-600 dark:text-amber-400">{realPoints} pts</span>.
              Escolha por onde quer continuar:
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button asChild className="w-full gap-2 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(251,146,60,0.7)] hover:opacity-95">
                <Link to="/dashboard">
                  <LayoutDashboard className="h-4 w-4" /> Conhecer o dashboard
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to="/dashboard/servicos">
                  <Briefcase className="h-4 w-4" /> Continuar cadastrando serviços
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to="/dashboard/portfolio">
                  <FolderOpen className="h-4 w-4" /> Abrir portfólio
                </Link>
              </Button>
              <InstallAppCard source="wizard-unified-done" variant="inline" />
            </div>
          </BetCardShell>
        </div>
      ) : (
        <MainOrchestrator
          internalHandoffFromTriage
          deferCompletionToParent
          seedState={{
            phase: mapUnifiedToMainPhase(state.phase),
            profile: state.profile,
            service: state.service,
            providerId: state.providerId,
            firstServiceId: state.firstServiceId,
          }}
          onPhaseChange={handleMainPhaseChange}
        />
      )}
    </div>
    </WizardModeContext.Provider>
  );
}
