/**
 * RemoteDraftRecoveryModal — diálogo apresentado quando encontramos um
 * rascunho do Onboarding V2 salvo no banco vindo de outro dispositivo.
 *
 * Mostra:
 *  - Quando foi salvo (data/hora local).
 *  - Em qual fase o usuário parou (label amigável).
 *  - Resumo do que foi preservado (nome, WhatsApp parcial, cidade, serviço).
 * Permite:
 *  - Continuar de onde parou (restaura o estado).
 *  - Descartar e reiniciar (limpa o rascunho remoto e segue do zero).
 */

import { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, ArrowRight, ShieldAlert, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { OnboardingState } from './types';

const PHASE_LABEL: Record<OnboardingState['phase'], string> = {
  phase1_action: 'Início',
  phase1_kind: 'Tipo de conta',
  phase1_location: 'Localização',
  phase1_contact: 'Contato',
  phase2_service: 'Categoria do serviço',
  phase2_details: 'Detalhes do serviço',
  phase2_photos: 'Fotos do serviço',
  phase3_celebration: 'Celebração',
  phase4_document: 'Documento',
  phase4_avatar: 'Foto de perfil',
  phase4_extras_a: 'Bairro e bio',
  phase4_extras_b: 'Redes sociais',
  phase4_review: 'Revisão final',
  done: 'Concluído',
};

interface RemoteDraftPayload {
  profile: OnboardingState['profile'];
  service: OnboardingState['service'];
}

interface Props {
  open: boolean;
  payload: RemoteDraftPayload | null;
  phase: OnboardingState['phase'] | null;
  updatedAt: string | null;
  onContinue: () => void;
  /** Limpa o rascunho remoto. Retorna promise para podermos travar UI enquanto roda. */
  onDiscard: () => Promise<void> | void;
}

function maskWhatsapp(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length < 4) return '';
  return `(${d.slice(0, 2)}) ••••-${d.slice(-4)}`;
}

export const RemoteDraftRecoveryModal = ({
  open, payload, phase, updatedAt, onContinue, onDiscard,
}: Props) => {
  const [discarding, setDiscarding] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const formattedDate = useMemo(() => {
    if (!updatedAt) return null;
    try {
      return new Date(updatedAt).toLocaleString('pt-BR', {
        dateStyle: 'short', timeStyle: 'short',
      });
    } catch {
      return null;
    }
  }, [updatedAt]);

  const summary = useMemo(() => {
    if (!payload) return [];
    const items: { label: string; value: string }[] = [];
    if (payload.profile.full_name) items.push({ label: 'Nome', value: payload.profile.full_name });
    if (payload.profile.whatsapp) items.push({ label: 'WhatsApp', value: maskWhatsapp(payload.profile.whatsapp) });
    const loc = [payload.profile.city, payload.profile.state].filter(Boolean).join(' • ');
    if (loc) items.push({ label: 'Localização', value: loc });
    if (payload.service.service_name) items.push({ label: '1º serviço', value: payload.service.service_name });
    if (payload.service.cities_served?.length) {
      items.push({ label: 'Atende em', value: `${payload.service.cities_served.length} cidade(s)` });
    }
    return items;
  }, [payload]);

  const handleDiscard = async () => {
    setDiscarding(true);
    try {
      await onDiscard();
    } finally {
      setDiscarding(false);
      setConfirmDiscard(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onContinue(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-accent" />
            Rascunho encontrado em outro dispositivo
          </DialogTitle>
          <DialogDescription>
            Salvamos automaticamente seu progresso da última vez que você acessou.
            Quer continuar de onde parou ou começar do zero?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {phase && (
              <Badge variant="secondary" className="bg-accent/10 text-accent-foreground">
                Etapa: {PHASE_LABEL[phase] || phase}
              </Badge>
            )}
            {formattedDate && (
              <span className="text-muted-foreground">Salvo em {formattedDate}</span>
            )}
          </div>

          {summary.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                O que foi preservado
              </p>
              <ul className="space-y-1 text-sm">
                {summary.map((s) => (
                  <li key={s.label} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-medium text-foreground text-right truncate max-w-[60%]">
                      {s.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {confirmDiscard && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 flex gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Tem certeza? Os dados acima serão apagados e você começará do zero.
                Essa ação não pode ser desfeita.
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {confirmDiscard ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmDiscard(false)}
                disabled={discarding}
                className="hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDiscard}
                disabled={discarding}
                className="active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-destructive"
              >
                {discarding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Sim, apagar e reiniciar
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDiscard(true)}
                className="hover:bg-destructive/5 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Descartar e reiniciar
              </Button>
              <Button
                type="button"
                onClick={onContinue}
                className="hover:opacity-95 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary"
              >
                Continuar de onde parei
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemoteDraftRecoveryModal;
