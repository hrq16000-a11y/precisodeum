/**
 * RecoveryOnboardingPage — `/cadastro/retomar`.
 *
 * Página de recuperação para usuários que clicaram em "Salvar e continuar
 * mais tarde" no wizard. Carrega o draft remoto do usuário (`onboarding_v2_drafts`),
 * mostra o que falta publicar e oferece atalho direto pra retomar exatamente
 * onde parou.
 *
 * Comportamento:
 *  - Logado + tem draft: mostra checklist + CTA "Continuar de onde parei".
 *  - Logado + sem draft: mostra mensagem genérica + CTA "Voltar ao cadastro".
 *  - Anônimo: redireciona pra /login com `?next=/cadastro/retomar`.
 *
 * Telemetria: `recovery_page_visited` quando carrega + `recovery_page_resumed`
 * quando o usuário aceita o atalho. Carrega intent do sessionStorage (sticky).
 *
 * Também expõe atalho pro WhatsApp do consultor com mensagem contextual
 * (categoria/cidade/etapa) — útil pra quem voltou mas continua travado.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Circle, Compass, MessageCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthIdentity } from '@/hooks/useAuth';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { fetchRemoteDraft } from '@/components/onboarding/wizard/phases/v2/useOnboardingV2RemoteDraft';
import { computeOnboardingProgress, buildWhatsappContextMessage } from '@/lib/onboardingProgress';
import { trackOnboardingEvent, getOnboardingIntent } from '@/components/onboarding/wizard/phases/v2/telemetry';
import { markSupportContacted } from '@/lib/conversionFunnel';
import type { OnboardingState } from '@/components/onboarding/wizard/phases/v2/types';

const SUPPORT_WHATSAPP = '5541997452053';

export default function RecoveryOnboardingPage() {
  const { user, loading: authLoading } = useAuthIdentity();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<{
    state: Pick<OnboardingState, 'profile' | 'service' | 'phase' | 'firstServiceId'>;
    updatedAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const intent = (getOnboardingIntent() ?? 'unknown') as
    | 'client'
    | 'professional'
    | 'rh'
    | 'unknown';

  useSeoHead({
    title: 'Continuar meu cadastro – Preciso de um Profissional',
    description:
      'Retome seu cadastro de onde parou. Veja o que falta publicar e finalize seu perfil em poucos minutos.',
    canonical: `${SITE_BASE_URL}/cadastro/retomar`,
    noindex: true, // página privada/transacional — não merece índice SEO
  });

  // Anônimo → manda pro login mantendo a intenção de voltar pra cá.
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/login?next=${encodeURIComponent('/cadastro/retomar')}`, { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Carrega o draft remoto.
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      const remote = await fetchRemoteDraft(user.id);
      if (!alive) return;
      if (remote) {
        setDraft({
          state: {
            phase: remote.phase as OnboardingState['phase'],
            profile: remote.payload.profile,
            service: remote.payload.service,
            firstServiceId: remote.payload.firstServiceId ?? null,
          } as any,
          updatedAt: remote.updated_at,
        });
      } else {
        setDraft(null);
      }
      setLoading(false);
      void trackOnboardingEvent({
        phase: (remote?.phase || 'recovery_page') as any,
        event: 'recovery_page_visited' as any,
        meta: { has_draft: !!remote },
      });
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const summary = useMemo(
    () => (draft ? computeOnboardingProgress(draft.state) : null),
    [draft],
  );
  const progressPct = summary ? Math.round(summary.ratio * 100) : 0;

  const handleResume = () => {
    void trackOnboardingEvent({
      phase: (draft?.state.phase || 'recovery_page') as any,
      event: 'recovery_page_resumed' as any,
      meta: { progress_pct: progressPct },
    });
    navigate('/cadastro-inicial');
  };

  const handleWhatsapp = () => {
    const msg = buildWhatsappContextMessage({
      categoryLabel: summary?.primaryCategoryId ? 'serviço selecionado' : null,
      city: summary?.city,
      state: summary?.state,
      stuckOnLabel: summary?.nextItem?.label || 'recuperação do cadastro',
      intent,
    });
    markSupportContacted({
      source: 'recovery_page',
      // ExitIntentIntent só aceita client/professional/unknown — colapsa rh→unknown
      // pra evitar quebra de tipo (o sessionStorage ainda guarda 'rh' real).
      intent: intent === 'rh' ? 'unknown' : intent,
      phase: draft?.state.phase,
    });
    const url = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="mx-auto h-64 max-w-md" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-amber-50/20 dark:to-amber-950/10">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <Link
          to="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar pra dashboard
        </Link>

        <header className="mb-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <Compass className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Continuar meu cadastro
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Vamos retomar exatamente de onde você parou. Veja o que ainda falta:
          </p>
        </header>

        {loading ? (
          <Card>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ) : !draft || !summary ? (
          <Card>
            <CardContent className="space-y-4 p-6 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-amber-500" aria-hidden />
              <p className="text-base font-semibold text-foreground">
                Nenhum rascunho encontrado
              </p>
              <p className="text-sm text-muted-foreground">
                Você não tem um cadastro em andamento. Comece um novo agora pra começar a aparecer
                pra clientes.
              </p>
              <Button asChild className="w-full gap-2">
                <Link to="/cadastro-inicial">
                  Começar cadastro <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-4">
              <CardContent className="space-y-4 p-6">
                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Progresso
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {summary.completed} de {summary.total} ({progressPct}%)
                    </span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                </div>

                <ul
                  className="space-y-1.5 text-sm"
                  data-testid="recovery-checklist"
                  aria-label="Etapas do cadastro"
                >
                  {summary.items.map((item) => (
                    <li
                      key={item.id}
                      className={`flex items-center gap-2 ${
                        item.done ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {item.done ? (
                        <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
                      )}
                      <span className={item.done ? 'line-through opacity-70' : ''}>
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {summary.nextItem && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                    <p className="font-semibold text-foreground">Próximo passo</p>
                    <p className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                      <ArrowRight className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                      {summary.nextItem.label}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={handleResume}
              data-testid="recovery-resume"
              className="mb-2 w-full gap-2 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(251,146,60,0.7)] hover:opacity-95"
            >
              <ArrowRight className="h-4 w-4" />
              Continuar de onde parei
            </Button>

            <Button
              onClick={handleWhatsapp}
              variant="outline"
              data-testid="recovery-whatsapp"
              className="w-full gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com consultor no WhatsApp
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
