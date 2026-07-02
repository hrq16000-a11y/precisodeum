/**
 * DraftRestoredBanner — aviso visual "rascunho restaurado" (local vs remoto).
 *
 * Extraído do OnboardingV2Shell (PR 9 — UI Composition Pass). Puramente
 * presentational: recebe o snapshot já calculado pelo shell (`draftRestored`)
 * e renderiza. Nenhuma decisão de hidratação / recovery / cross-tab vive aqui.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

interface DraftRestoredBannerProps {
  draftRestored: { source: 'local' | 'remote'; at?: string } | null;
}

export const DraftRestoredBanner = ({ draftRestored }: DraftRestoredBannerProps) => (
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
);

export default DraftRestoredBanner;
