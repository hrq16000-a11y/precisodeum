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
 * CTA principal: WhatsApp do suporte (5541997452053) com mensagem pré-pronta.
 * CTA secundário: voltar ao wizard.
 *
 * Telemetria: registra `exit_intent_shown`, `exit_intent_whatsapp`,
 * `exit_intent_dismiss` em onboarding_events via trackOnboardingEvent.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';
import { trackOnboardingEvent } from './phases/v2/telemetry';

const SUPPORT_WHATSAPP = '5541997452053';
const SUPPORT_MESSAGE =
  'Olá! Estou tentando me cadastrar em www.precisodeumprofissional.com.br e gostaria de ajuda para finalizar meu perfil.';
const INACTIVITY_MS = 30_000;
const STORAGE_KEY = 'wizard:exit-intent-shown';

type ExitIntentDialogProps = {
  /** Fase atual do wizard (para telemetria). */
  phase: string;
  /** Permite desativar em fases finais (ex: celebração / done). */
  enabled?: boolean;
};

export default function ExitIntentDialog({ phase, enabled = true }: ExitIntentDialogProps) {
  const [open, setOpen] = useState(false);
  const triggeredRef = useRef(false);
  const inactivityTimer = useRef<number | null>(null);

  const trigger = useCallback(
    (source: 'mouseleave' | 'inactivity') => {
      if (triggeredRef.current) return;
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
      void trackOnboardingEvent({
        phase: phase as any,
        event: 'exit_intent_shown' as any,
        meta: { source },
      });
    },
    [phase],
  );

  const resetInactivity = useCallback(() => {
    if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
    inactivityTimer.current = window.setTimeout(() => trigger('inactivity'), INACTIVITY_MS);
  }, [trigger]);

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
    void trackOnboardingEvent({
      phase: phase as any,
      event: 'exit_intent_whatsapp' as any,
      meta: {},
    });
    const url = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpen(false);
  }, [phase]);

  const handleDismiss = useCallback(() => {
    void trackOnboardingEvent({
      phase: phase as any,
      event: 'exit_intent_dismiss' as any,
      meta: {},
    });
    setOpen(false);
  }, [phase]);

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleDismiss())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">
            Está com alguma dificuldade?
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-muted-foreground">
            Não queremos que você perca a chance de aparecer em{' '}
            <span className="font-semibold text-foreground">www.precisodeumprofissional.com.br</span>.
            <br />
            <br />
            Se preferir, fale com nosso suporte agora pelo WhatsApp e finalizamos o cadastro
            <span className="font-semibold text-foreground"> juntos com você</span>.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            onClick={handleWhatsApp}
            className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)] hover:opacity-95"
          >
            <MessageCircle className="h-4 w-4" />
            Falar com o suporte no WhatsApp
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleDismiss}
            className="w-full gap-2 text-muted-foreground"
          >
            <X className="h-4 w-4" />
            Continuar sozinho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
