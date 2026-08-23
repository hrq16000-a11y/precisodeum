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
import { Link } from '@/lib/router-compat';
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
import SaveLaterDialog from './SaveLaterDialog';
import { buildWhatsappContextMessage, computeOnboardingProgress } from '@/lib/onboardingProgress';
import type { OnboardingState } from './phases/v2/types';
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';

const INACTIVITY_MS = 30_000;
const STORAGE_KEY = 'wizard:exit-intent-shown';
const SUPPORT_WHATSAPP = '5541997452053';

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
   * Habilita o CTA secundário "Salvar e continuar mais tarde".
   */
  hasFirstService?: boolean;
  /**
   * Snapshot do estado do wizard — usado pra (a) montar mensagem WhatsApp com
   * categoria/cidade/etapa e (b) alimentar o `SaveLaterDialog` com o resumo de
   * progresso. Quando ausente, o pop-up funciona em modo "minimal" sem contexto.
   */
  wizardState?: Pick<OnboardingState, 'profile' | 'service' | 'phase' | 'firstServiceId'>;
};

export default function ExitIntentDialog({
  phase,
  intent = 'unknown',
  enabled = true,
  variantOverride,
  tracker = defaultTracker,
  inactivityMs = INACTIVITY_MS,
  hasFirstService = false,
  wizardState,
}: ExitIntentDialogProps) {
  const [open, setOpen] = useState(false);
  const [saveLaterOpen, setSaveLaterOpen] = useState(false);
  const triggeredRef = useRef(false);
  const inactivityTimer = useRef<number | null>(null);
  const saveLaterTimer = useRef<number | null>(null);

  // Limpeza do timer do "Salvar e continuar mais tarde" ao desmontar — evita
  // setState em componente já desmontado se o usuário fechar o pop-up nos 50ms.
  useEffect(() => () => {
    if (saveLaterTimer.current) window.clearTimeout(saveLaterTimer.current);
  }, []);

  const variant: ExitIntentVariant = useMemo(
    () => variantOverride ?? getSessionVariant(),
    [variantOverride],
  );
  const group = phaseGroup(phase);
  const copy = useMemo(
    () => resolveExitIntentCopy(variant, { phase, intent }),
    [variant, phase, intent],
  );

  // Resumo de progresso pra contexto WhatsApp + alimentação do SaveLaterDialog.
  const progress = useMemo(
    () => (wizardState ? computeOnboardingProgress(wizardState) : null),
    [wizardState],
  );

  // Override de copy para "profissional travado sem serviço publicado".
  const stuckOnService = group === 'main' && !hasFirstService && intent !== 'client';
  const displayTitle = stuckOnService ? 'Não vá ainda!' : copy.title;
  const displayBody = stuckOnService
    ? 'Notamos que você ainda não publicou seu serviço. Quer ajuda humana para configurar seu perfil?'
    : copy.body;
  const displayPrimaryCta = stuckOnService ? 'Falar com Consultor (WhatsApp)' : copy.ctaPrimary;

  // Mensagem WhatsApp com contexto (categoria/cidade/etapa) — sobrepõe a copy
  // genérica quando temos snapshot do wizard.
  const whatsappUrl = useMemo(() => {
    if (!progress) return copy.whatsappUrl;
    const msg = buildWhatsappContextMessage({
      categoryLabel: progress.primaryCategoryId ? 'serviço selecionado' : null,
      city: progress.city,
      state: progress.state,
      stuckOnLabel: progress.nextItem?.label,
      intent: intent === 'rh' as any ? 'unknown' : intent,
    });
    return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  }, [progress, copy.whatsappUrl, intent]);

  const baseMeta = useMemo(
    () => ({
      phase,
      variant,
      phase_group: group,
      intent,
      has_first_service: hasFirstService,
      stuck_on_service: stuckOnService,
      progress_pct: progress ? Math.round(progress.ratio * 100) : null,
    }),
    [phase, variant, group, intent, hasFirstService, stuckOnService, progress],
  );

  const trigger = useCallback(
    (source: 'mouseleave' | 'inactivity') => {
      if (triggeredRef.current) return;
      if (shouldSuppressExitIntent()) return;
      try {
        if (sessionStorage.getItem(STORAGE_KEY) === '1') return;
      } catch { /* noop */ }
      triggeredRef.current = true;
      try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* noop */ }
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
    const onMouseLeave = (e: MouseEvent) => { if (e.clientY <= 0) trigger('mouseleave'); };
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
    // Persistência: SUPPORT_KEY suprime exit-intent pelo resto da sessão.
    markSupportContacted({ source: 'exit_intent', intent, phase, variant });
    if (typeof window !== 'undefined') {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
    setOpen(false);
  }, [tracker, baseMeta, whatsappUrl, intent, phase, variant]);

  const handleDismiss = useCallback(() => {
    tracker('exit_intent_dismiss', baseMeta);
    setOpen(false);
  }, [tracker, baseMeta]);

  const handleSaveLater = useCallback(() => {
    tracker('exit_intent_save_later', baseMeta);
    setOpen(false);
    // Abre modal com resumo de progresso em vez de navegar direto.
    if (saveLaterTimer.current) window.clearTimeout(saveLaterTimer.current);
    saveLaterTimer.current = scheduleWizardTimeout(
      { phase: phase as any, action: 'exit_intent_open_save_later' },
      () => setSaveLaterOpen(true),
      50,
    );
  }, [tracker, baseMeta]);

  return (
    <>
      {wizardState && (
        <SaveLaterDialog
          open={saveLaterOpen}
          onOpenChange={setSaveLaterOpen}
          state={wizardState}
          source="exit_intent"
          intent={intent}
          variant={variant}
        />
      )}
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleDismiss())}>
      <DialogContent className="max-w-md" data-testid="exit-intent-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">
            {displayTitle}
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-muted-foreground">
            {displayBody}
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
            {displayPrimaryCta}
          </Button>
          {hasFirstService && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveLater}
              data-testid="exit-intent-save-later"
              className="w-full gap-2 font-semibold"
            >
              <Save className="h-4 w-4" />
              Salvar e continuar mais tarde
            </Button>
          )}
          <Link to="/ajuda/cadastro" onClick={() => setOpen(false)} className="w-full">
            <Button type="button" variant="outline" className="w-full gap-2">
              <HelpCircle className="h-4 w-4" />
              Ver perguntas frequentes do cadastro
            </Button>
          </Link>
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
    </>
  );
}
