/**
 * ExitIntentDialog — Pop-up de captação de desistência.
 *
 * Gatilhos:
 *  - mouseleave da viewport (mouse vai para a barra de endereço / fechar)
 *  - 30s de inatividade dentro do wizard (sem mousemove/keydown/touchstart)
 *
 * Aparece NO MÁXIMO uma vez por sessão (sessionStorage). Fechado pelo usuário
 * fica suprimido para não atrapalhar quem está digitando.
 *
 * Conteúdo: resolvido por `resolveExitIntentCopy(variant, { phase, intent })`
 * em `@/lib/exitIntentVariants` — 2 variações A/B (sticky por sessão) e copy
 * por etapa (triage/main/extras) e por intent (client/professional).
 *
 * Telemetria: registra `exit_intent_shown`, `exit_intent_whatsapp`,
 * `exit_intent_dismiss` em onboarding_events com meta:
 *   { source, variant, phase_group, intent }
 * permitindo medir conversão por criativo × etapa × tipo de usuário.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, X, HelpCircle, Save } from 'lucide-react';
import { trackOnboardingEvent } from './phases/v2/telemetry';
import {
  getSessionVariant,
  phaseGroup,
  resolveExitIntentCopy,
  type ExitIntentIntent,
  type ExitIntentVariant,
} from '@/lib/exitIntentVariants';
import { markSupportContacted, shouldSuppressExitIntent } from '@/lib/conversionFunnel';

const INACTIVITY_MS = 30_000;
const STORAGE_KEY = 'wizard:exit-intent-shown';

export type ExitIntentTracker = (
  event:
    | 'exit_intent_shown'
    | 'exit_intent_whatsapp'
    | 'exit_intent_dismiss'
    | 'exit_intent_save_later',
  meta: Record<string, unknown>,
) => void;

const defaultTracker: ExitIntentTracker = (event, meta) => {
  void trackOnboardingEvent({
    phase: (meta.phase as string) as any,
    event: event as any,
    meta,
  });
};

type ExitIntentDialogProps = {
  /** Fase atual do wizard (para telemetria + roteamento de copy). */
  phase: string;
  /** Tipo de usuário detectado pela triagem. */
  intent?: ExitIntentIntent;
  /** Permite desativar em fases finais (ex: celebração / done). */
  enabled?: boolean;
  /** Forçar variante (testes / overrides admin). */
  variantOverride?: ExitIntentVariant;
  /** Tracker injetável — usado pelos testes para validar telemetria. */
  tracker?: ExitIntentTracker;
  /** Tempo (ms) de inatividade que dispara o pop-up. */
  inactivityMs?: number;
  /**
   * True se o usuário JÁ publicou o primeiro serviço (state.firstServiceId).
   * Habilita o CTA secundário "Salvar e continuar mais tarde" — sem isso, o
   * usuário não tem nada salvo no perfil e não faz sentido oferecer "depois".
   */
  hasFirstService?: boolean;
  /** Rota de destino do "Salvar e continuar mais tarde". Default: /dashboard. */
  saveLaterRedirectTo?: string;
};

export default function ExitIntentDialog({
  phase,
  intent = 'unknown',
  enabled = true,
  variantOverride,
  tracker = defaultTracker,
  inactivityMs = INACTIVITY_MS,
  hasFirstService = false,
  saveLaterRedirectTo = '/dashboard',
}: ExitIntentDialogProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const triggeredRef = useRef(false);
  const inactivityTimer = useRef<number | null>(null);

  const variant: ExitIntentVariant = useMemo(
    () => variantOverride ?? getSessionVariant(),
    [variantOverride],
  );
  const group = phaseGroup(phase);
  const copy = useMemo(
    () => resolveExitIntentCopy(variant, { phase, intent }),
    [variant, phase, intent],
  );

  // Override de copy para o caso "profissional travado sem serviço publicado"
  // (briefing: 'Não vá ainda!' + texto sobre serviço não publicado).
  // Aplica-se SOMENTE ao grupo 'main' (fase de criação do 1º serviço) e quando
  // o usuário ainda não tem firstServiceId — fora disso mantém A/B normal.
  const stuckOnService = group === 'main' && !hasFirstService && intent !== 'client';
  const displayTitle = stuckOnService ? 'Não vá ainda!' : copy.title;
  const displayBody = stuckOnService
    ? 'Notamos que você ainda não publicou seu serviço. Quer ajuda humana para configurar seu perfil?'
    : copy.body;
  const displayPrimaryCta = stuckOnService ? 'Falar com Consultor (WhatsApp)' : copy.ctaPrimary;

  const baseMeta = useMemo(
    () => ({
      phase,
      variant,
      phase_group: group,
      intent,
      has_first_service: hasFirstService,
      stuck_on_service: stuckOnService,
    }),
    [phase, variant, group, intent, hasFirstService, stuckOnService],
  );

  const trigger = useCallback(
    (source: 'mouseleave' | 'inactivity') => {
      if (triggeredRef.current) return;
      // Suprime se o usuário já clicou no WhatsApp ou já visitou /ajuda/cadastro
      // nesta sessão — evita pop-up redundante.
      if (shouldSuppressExitIntent()) return;
      try {
        if (sessionStorage.getItem(STORAGE_KEY) === '1') return;
      } catch {
        /* sessionStorage indisponível — segue */
      }
      triggeredRef.current = true;
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* noop */
      }
      setOpen(true);
      tracker('exit_intent_shown', { ...baseMeta, source });
    },
    [tracker, baseMeta],
  );

  const resetInactivity = useCallback(() => {
    if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
    inactivityTimer.current = window.setTimeout(() => trigger('inactivity'), inactivityMs);
  }, [trigger, inactivityMs]);

  useEffect(() => {
    if (!enabled) return;

    const onMouseLeave = (e: MouseEvent) => {
      // Apenas quando o cursor sai pelo TOPO (em direção à URL/fechar).
      // Em mobile não há mouseleave, então o gatilho de inatividade cobre.
      if (e.clientY <= 0) trigger('mouseleave');
    };

    const onActivity = () => resetInactivity();

    document.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('touchstart', onActivity, { passive: true });
    window.addEventListener('scroll', onActivity, { passive: true });

    resetInactivity();

    return () => {
      document.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('scroll', onActivity);
      if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
    };
  }, [enabled, resetInactivity, trigger]);

  const handleWhatsApp = useCallback(() => {
    tracker('exit_intent_whatsapp', baseMeta);
    // Telemetria de funil: marca origem 'exit_intent' e suprime futuros pop-ups.
    markSupportContacted({ source: 'exit_intent', intent, phase, variant });
    if (typeof window !== 'undefined') {
      window.open(copy.whatsappUrl, '_blank', 'noopener,noreferrer');
    }
    setOpen(false);
  }, [tracker, baseMeta, copy.whatsappUrl, intent, phase, variant]);

  const handleDismiss = useCallback(() => {
    tracker('exit_intent_dismiss', baseMeta);
    setOpen(false);
  }, [tracker, baseMeta]);

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleDismiss())}>
      <DialogContent className="max-w-md" data-testid="exit-intent-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-muted-foreground">
            {copy.body}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            onClick={handleWhatsApp}
            data-testid="exit-intent-whatsapp"
            className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)] hover:opacity-95"
          >
            <MessageCircle className="h-4 w-4" />
            {copy.ctaPrimary}
          </Button>
          <Button asChild type="button" variant="outline" className="w-full gap-2">
            <Link to="/ajuda/cadastro" onClick={() => setOpen(false)}>
              <HelpCircle className="h-4 w-4" />
              Ver perguntas frequentes do cadastro
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleDismiss}
            data-testid="exit-intent-dismiss"
            className="w-full gap-2 text-muted-foreground"
          >
            <X className="h-4 w-4" />
            {copy.ctaDismiss}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
