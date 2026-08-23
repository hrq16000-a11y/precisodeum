/**
 * DashboardAssistantPage — "Assistente"
 *
 * Tela de revisão pós-cadastro. Mostra TODAS as fases do wizard
 * (triagem + serviço + perfil) com seu status atual:
 *   - completa  → permite ABRIR para revisar/editar
 *   - pendente  → permite CONTINUAR exatamente onde parou
 *   - bloqueada → fases que dependem de pré-requisitos ainda não cumpridos
 *
 * Não duplica regras: lê profile/provider/services existentes do `useAuth`
 * + uma query simples ao primeiro serviço, e usa o helper público
 * `isPhaseFullyCompleted` (mesmo do <EditModeSkipButton>).
 *
 * Edição usa o contrato existente:
 *   /cadastro-inicial?mode=review&section=<cadastro|servicos|dados|portfolio|url>&next=/dashboard/assistente
 *
 * Sem emojis, ícones Lucide, paleta semântica do tema.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@/lib/router-compat';
import {
  CheckCircle2,
  Circle,
  Lock,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  PlayCircle,
  Pencil,
  Eye,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  UNIFIED_PHASE_ORDER,
  type UnifiedPhase,
  type WizardState,
} from '@/components/onboarding/wizard/wizardReducer';
import {
  REVIEW_STEP_CATALOG,
  type ReviewStepMeta,
} from '@/components/onboarding/wizard/wizardReviewSteps';
import { isPhaseFullyCompleted } from '@/components/onboarding/wizard/wizardMode';
import type { OnboardingReviewSection } from '@/lib/onboardingAccess';

// ──────────────────────────────────────────────────────────────────────────
// Catálogo canônico de fases — vem de `wizardReviewSteps.ts` (fonte única
// compartilhada com o HUD do Wizard). Qualquer alteração na ordem/rótulos
// deve ser feita LÁ, não aqui.
// ──────────────────────────────────────────────────────────────────────────
type AssistantPhaseMeta = ReviewStepMeta;
const PHASE_CATALOG: AssistantPhaseMeta[] = REVIEW_STEP_CATALOG;

// ──────────────────────────────────────────────────────────────────────────
// Status derivation
// ──────────────────────────────────────────────────────────────────────────
type PhaseStatus = 'done' | 'current' | 'pending' | 'locked';

function buildWizardStateFromAuth(args: {
  profile: any | null;
  provider: any | null;
  firstService: any | null;
}): WizardState {
  const { profile, provider, firstService } = args;
  return {
    phase: 'main_action',
    triage: {} as any,
    profile: {
      profile_type: profile?.profile_type ?? null,
      kind: provider?.account_type ?? null,
      city: provider?.city ?? profile?.city ?? null,
      state: provider?.state ?? profile?.state ?? null,
      full_name: profile?.full_name ?? null,
      whatsapp: profile?.whatsapp ?? null,
      document: profile?.tax_id ?? provider?.cnpj ?? provider?.cpf ?? null,
      avatar_url: profile?.avatar_url ?? null,
      neighborhood: provider?.neighborhood ?? null,
      bio: provider?.bio ?? null,
    } as any,
    service: {
      category_ids: firstService?.category_id ? [firstService.category_id] : [],
      service_name: firstService?.name ?? null,
      description: firstService?.description ?? null,
      cities_served: firstService?.cities_served ?? firstService?.service_areas ?? [],
    } as any,
    providerId: provider?.id ?? null,
    firstServiceId: firstService?.id ?? null,
  } as WizardState;
}

function derivePhaseStatuses(
  state: WizardState,
  hasProvider: boolean,
  hasFirstService: boolean,
  onboardingCompleted: boolean,
): Record<UnifiedPhase, PhaseStatus> {
  const out: Record<string, PhaseStatus> = {};
  let firstPendingSeen = false;

  for (const meta of PHASE_CATALOG) {
    const { phase } = meta;

    // Marcos de celebração — concluídos quando o gate equivalente passou.
    if (meta.milestone) {
      if (phase === 'triage_celebration') {
        out[phase] = hasProvider ? 'done' : 'pending';
      } else if (phase === 'main_celebration') {
        out[phase] = hasFirstService ? 'done' : 'pending';
      } else {
        out[phase] = 'pending';
      }
      continue;
    }

    // Fases sem rota de edição mas que possuem dados (ex.: triage_who, main_action)
    // ⇒ inferir status pelos pré-requisitos correlatos.
    let isComplete = false;
    if (phase === 'triage_identity') {
      isComplete = !!(state.profile.full_name && state.profile.whatsapp);
    } else if (phase === 'triage_who') {
      isComplete = !!state.profile.profile_type;
    } else if (phase === 'triage_client_city') {
      isComplete = state.profile.profile_type === 'client'
        ? !!(state.profile.city && state.profile.state)
        : true; // não se aplica a non-client
    } else if (phase === 'triage_pro_kind') {
      isComplete = !!state.profile.kind;
    } else if (phase === 'triage_pro_document') {
      // Opcional — sempre considerado "ok" para não bloquear barra.
      isComplete = true;
    } else if (phase === 'triage_pro_location') {
      isComplete = !!(state.profile.city && state.profile.state);
    } else if (phase === 'main_action') {
      isComplete = hasProvider;
    } else if (phase === 'main_more_services') {
      isComplete = hasFirstService;
    } else if (phase === 'main_portfolio_albums') {
      isComplete = hasFirstService; // entrada disponível assim que houver 1 serviço
    } else {
      isComplete = isPhaseFullyCompleted(state, phase);
    }

    if (isComplete) {
      out[phase] = 'done';
    } else if (!firstPendingSeen) {
      out[phase] = 'current';
      firstPendingSeen = true;
    } else {
      out[phase] = 'pending';
    }
  }

  // Sobrescreve "current" se onboarding completo: mostra tudo que faltou
  // como pending normal (sem marcador "atual"), pois o usuário pode acessar
  // qualquer seção livremente.
  if (onboardingCompleted && firstPendingSeen) {
    for (const meta of PHASE_CATALOG) {
      if (out[meta.phase] === 'current') out[meta.phase] = 'pending';
    }
  }

  return out as Record<UnifiedPhase, PhaseStatus>;
}

// ──────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────
export default function DashboardAssistantPage() {
  const navigate = useNavigate();
  const { profile, provider, loading: authLoading } = useAuth();
  const [firstService, setFirstService] = useState<any | null>(null);
  const [serviceLoading, setServiceLoading] = useState(true);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Assistente do cadastro · Precisodeum';
    return () => { document.title = prev; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!provider?.id) {
        setServiceLoading(false);
        return;
      }
      const { data } = await supabase
        .from('services')
        .select('id, name, description, category_id, service_areas, cities_served')
        .eq('provider_id', provider.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (alive) {
        setFirstService(data ?? null);
        setServiceLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [provider?.id]);

  const wizardState = useMemo(
    () => buildWizardStateFromAuth({ profile, provider, firstService }),
    [profile, provider, firstService],
  );

  const statuses = useMemo(
    () => derivePhaseStatuses(
      wizardState,
      !!provider?.id,
      !!firstService?.id,
      !!profile?.onboarding_completed,
    ),
    [wizardState, provider?.id, firstService?.id, profile?.onboarding_completed],
  );

  const totalCountable = PHASE_CATALOG.filter((p) => !p.milestone).length;
  const doneCount = PHASE_CATALOG.filter((p) => !p.milestone && statuses[p.phase] === 'done').length;
  const pct = Math.round((doneCount / totalCountable) * 100);
  const currentPhase = PHASE_CATALOG.find((p) => statuses[p.phase] === 'current');

  const isLoading = authLoading || serviceLoading;

  function openPhase(meta: AssistantPhaseMeta, status: PhaseStatus) {
    if (status === 'locked' || meta.section === null) return;
    const params = new URLSearchParams({
      mode: 'review',
      section: meta.section,
      next: '/dashboard/assistente',
    });
    navigate(`/cadastro-inicial?${params.toString()}`);
  }

  /**
   * "Ver em detalhes" — abre a mesma seção em modo review, mas com a flag
   * `view=1` para a UI poder iniciar em estado read-only/expandido. O wizard
   * continua resolvendo `mode=review` → `edit_profile`, então o usuário
   * sempre pode passar a editar de dentro da fase.
   */
  function viewPhase(meta: AssistantPhaseMeta, status: PhaseStatus) {
    if (status === 'locked' || meta.section === null) return;
    const params = new URLSearchParams({
      mode: 'review',
      section: meta.section,
      view: '1',
      next: '/dashboard/assistente',
    });
    navigate(`/cadastro-inicial?${params.toString()}`);
  }

  function continueWhereLeftOff() {
    if (!currentPhase) {
      // Tudo concluído — abre wizard em modo review na primeira seção.
      navigate('/cadastro-inicial?mode=review&section=cadastro&next=/dashboard/assistente');
      return;
    }
    const section = currentPhase.section ?? 'cadastro';
    navigate(`/cadastro-inicial?mode=review&section=${section}&next=/dashboard/assistente`);
  }

  return (
    <DashboardLayout>
      {/* SEO: noindex via document.title; rota é privada */}

      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 h-7 gap-1 px-2 text-[12px] text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao painel
          </Button>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            Assistente do cadastro
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Veja todas as etapas do seu cadastro, edite o que já está liberado e continue exatamente
            de onde parou.
          </p>
        </div>
      </div>

      {/* Progress + Continue CTA */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-foreground">
            Progresso geral
          </div>
          <Badge variant="secondary" className="font-mono">
            {doneCount}/{totalCountable} · {pct}%
          </Badge>
        </div>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {currentPhase ? (
              <>
                Próximo passo: <strong className="text-foreground">{currentPhase.title}</strong>
              </>
            ) : (
              <>Tudo certo por aqui — você pode revisar qualquer etapa abaixo.</>
            )}
          </div>
          <Button onClick={continueWhereLeftOff} className="gap-2" disabled={isLoading}>
            <PlayCircle className="h-4 w-4" />
            {currentPhase ? 'Continuar de onde parei' : 'Revisar cadastro'}
          </Button>
        </div>
      </div>

      {/* Phases list */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : (
          PHASE_CATALOG.map((meta) => {
            const status = statuses[meta.phase];
            const editable = !!meta.section && status !== 'locked';
            const StatusIcon =
              status === 'done' ? CheckCircle2
                : status === 'locked' ? Lock
                  : Circle;
            const statusColor =
              status === 'done' ? 'text-emerald-600 dark:text-emerald-400'
                : status === 'current' ? 'text-primary'
                  : status === 'locked' ? 'text-muted-foreground'
                    : 'text-muted-foreground';

            return (
              <div
                key={meta.phase}
                className={[
                  'group flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 transition-colors sm:flex-row sm:items-center',
                  status === 'current' ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border',
                  editable ? 'hover:border-primary/40' : 'opacity-90',
                ].join(' ')}
                aria-label={`${meta.title} — ${status === 'done' ? 'concluída' : status === 'current' ? 'atual' : status === 'locked' ? 'bloqueada' : 'pendente'}`}
              >
                <StatusIcon className={`h-5 w-5 shrink-0 ${statusColor}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{meta.title}</span>
                    {meta.milestone && (
                      <Badge variant="outline" className="text-[10px]">marco</Badge>
                    )}
                    {status === 'current' && (
                      <Badge className="text-[10px]">atual</Badge>
                    )}
                    {status === 'done' && (
                      <Badge variant="secondary" className="text-[10px]">concluída</Badge>
                    )}
                    {!editable && status !== 'done' && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        somente leitura
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:truncate">
                    {meta.description}
                  </p>
                </div>
                {editable ? (
                  <div className="flex shrink-0 items-center gap-2 self-stretch sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => viewPhase(meta, status)}
                      aria-label={`Ver detalhes de ${meta.title}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver em detalhes
                    </Button>
                    <Button
                      variant={status === 'current' ? 'default' : 'secondary'}
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => openPhase(meta, status)}
                      aria-label={`Editar ${meta.title}`}
                    >
                      {status === 'current' ? (
                        <>
                          Continuar
                          <ChevronRight className="h-3.5 w-3.5" />
                        </>
                      ) : (
                        <>
                          <Pencil className="h-3.5 w-3.5" />
                          Editar esta fase
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="shrink-0 text-[11px] text-muted-foreground">
                    {meta.milestone ? 'Marco' : 'Somente leitura'}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        As etapas em <em>somente leitura</em> não podem ser alteradas diretamente aqui — elas refletem
        decisões iniciais (ex.: tipo de conta) ou marcos automáticos. Caso precise mudar, fale com o
        suporte em <a href="/ajuda" className="underline hover:text-foreground">/ajuda</a>.
      </p>
    </DashboardLayout>
  );
}
