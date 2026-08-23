/**
 * DraftRestoredBanner — aviso visual "rascunho restaurado" (local vs remoto).
 *
 * Extraído do OnboardingV2Shell (PR 9 — UI Composition Pass). Puramente
 * presentational: recebe o snapshot já calculado pelo shell (`draftRestored`)
 * e renderiza. Nenhuma decisão de hidratação / recovery / cross-tab vive aqui.
 *
 * 2026-08 — passou a exibir EXPLICITAMENTE em qual passo o usuário retomou
 * e um botão "Voltar ao começo" (ação fornecida pelo shell).
 */
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, RotateCcw } from 'lucide-react';

/** Rótulos amigáveis por fase do wizard V2 (sem nomes técnicos). */
const PHASE_LABELS: Record<string, string> = {
  phase2_service: 'Categoria do 1º serviço',
  phase2_details: 'Detalhes do 1º serviço',
  phase2_photos: 'Fotos do serviço',
  phase3_celebration: 'Serviço publicado',
  phase4_document: 'Documentos do perfil',
  phase4_avatar: 'Foto de perfil',
  phase4_extras_a: 'Bairro e bio',
  phase4_extras_b: 'Redes sociais',
  done: 'Conclusão',
};

export const getWizardPhaseLabel = (phase?: string | null): string | null =>
  (phase && PHASE_LABELS[phase]) || null;

interface DraftRestoredBannerProps {
  draftRestored: { source: 'local' | 'remote'; at?: string } | null;
  /** Fase atual do wizard (usada para exibir o passo retomado). */
  phase?: string;
  /** Quando fornecido, exibe o botão "Voltar ao começo". */
  onRestart?: () => void;
}

export const DraftRestoredBanner = ({ draftRestored, phase, onRestart }: DraftRestoredBannerProps) => {
  const stepLabel = getWizardPhaseLabel(phase);

  return (
    <AnimatePresence>
      {draftRestored && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          data-testid="draft-restored-banner"
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

            {stepLabel && (
              <p className="text-muted-foreground" data-testid="draft-restored-step">
                Você retomou no passo: <span className="font-semibold text-foreground">{stepLabel}</span>
              </p>
            )}

            {onRestart && (
              <button
                type="button"
                onClick={onRestart}
                data-testid="draft-restored-restart"
                className="mt-1 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
              >
                <RotateCcw className="h-3 w-3" aria-hidden /> Voltar ao começo
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DraftRestoredBanner;
