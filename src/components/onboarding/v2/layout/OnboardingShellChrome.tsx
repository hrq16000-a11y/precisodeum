/**
 * OnboardingShellChrome — wrapper presentational do "chrome" externo
 * do OnboardingV2Shell (PR 13 — UI Composition Pass).
 *
 * Encapsula a composição visual repetitiva que envolvia o `renderPhase()`:
 *   - DraftRestoredBanner (faixa superior "rascunho restaurado")
 *   - BetCardShell (card padrão do wizard)
 *   - AutoSaveBadge condicional (alinhado à direita)
 *   - AnimatePresence + motion.div com transição de fase
 *
 * Estritamente visual: ZERO hooks de runtime, ZERO fetch, ZERO refs
 * persistentes, ZERO acesso a storage/cross-tab. Todas as decisões
 * (quando mostrar badge, qual signal, qual snapshot de draft) vêm
 * do shell via props já memoizadas no `useOnboardingViewModel`.
 */
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import BetCardShell from '@/components/onboarding/wizard/BetCardShell';
import { AutoSaveBadge } from '@/components/onboarding/wizard/phases/v2/AutoSaveBadge';
import { DraftRestoredBanner } from '@/components/onboarding/v2/phases/DraftRestoredBanner';

interface OnboardingShellChromeProps {
  /** Snapshot do "rascunho restaurado" já calculado pelo shell. */
  draftRestored: { source: 'local' | 'remote'; at?: string } | null;
  /** Flag derivada (`viewModel.showAutoSaveBadge`). */
  showAutoSaveBadge: boolean;
  /** Sinal de auto-save (normalmente `state.profile`). */
  autoSaveSignal: unknown;
  /** Chave usada para re-disparar a transição entre fases. */
  phaseKey: string;
  /** Ação opcional "Voltar ao começo" do wizard. */
  onRestart?: () => void;
  /** Conteúdo da fase atual já resolvido pelo phaseComponentMap. */
  children: ReactNode;
}

export const OnboardingShellChrome = ({
  draftRestored,
  showAutoSaveBadge,
  autoSaveSignal,
  phaseKey,
  onRestart,
  children,
}: OnboardingShellChromeProps) => {
  return (
    <>
      {/* Aviso "rascunho restaurado" — diferencia local x remoto. */}
      <DraftRestoredBanner draftRestored={draftRestored} phase={phaseKey} onRestart={onRestart} />

      <BetCardShell animated={false}>
        {showAutoSaveBadge && (
          <div className="mb-2 flex items-center justify-end">
            <AutoSaveBadge signal={autoSaveSignal} />
          </div>
        )}
        {/* Faixa "Já preenchido" removida — vazava nomes técnicos (full_name, document)
            ao usuário final. Os locks continuam ativos via `coreLocks`/`pendingCoreFields`
            para a lógica interna, mas sem renderização. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={phaseKey}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </BetCardShell>
    </>
  );
};

export default OnboardingShellChrome;
