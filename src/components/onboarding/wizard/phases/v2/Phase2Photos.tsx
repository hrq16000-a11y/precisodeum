/**
 * Phase2Photos — upload de até 5 fotos do 1º serviço (1 capa + 4 conteúdos).
 *
 * Etapa intermediária OPCIONAL entre a publicação do serviço e a celebração.
 * Estilo padronizado com o Bet Mode V3 (BetCardShell + CTA gradiente).
 */

import { motion } from 'framer-motion';
import { ImageIcon, ArrowRight, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ServiceImageUpload from '@/components/ServiceImageUpload';

interface Phase2PhotosProps {
  serviceId: string;
  userId: string;
  serviceName: string;
  onContinue: () => void;
  onSkip: () => void;
}

export const Phase2Photos = ({
  serviceId, userId, serviceName, onContinue, onSkip,
}: Phase2PhotosProps) => (
  <motion.section
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="mx-auto w-full max-w-md space-y-5 px-4 py-6"
    aria-labelledby="phase2-photos-title"
    role="region"
  >
    <header className="space-y-2 text-center">
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 shadow-[0_0_24px_rgba(251,146,60,0.45)]"
        aria-hidden="true"
      >
        <ImageIcon className="h-7 w-7 text-white" />
      </div>
      <h1
        id="phase2-photos-title"
        className="font-display text-2xl font-extrabold leading-tight text-foreground"
      >
        Adicione fotos do serviço
      </h1>
      <p className="text-sm text-muted-foreground">
        Até <span className="font-semibold text-foreground">5 imagens</span> — a primeira é a capa.
        Perfis com fotos recebem 3× mais contatos.
      </p>
    </header>

    {/* Guia contextual acessível: explica o botão "Pular por enquanto" e
        que o cadastro é concluído mesmo sem fotos carregadas. */}
    <aside
      role="note"
      aria-label="Como concluir esta etapa"
      className="rounded-lg border border-amber-300/50 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <p className="font-semibold">Sem fotos no momento? Sem problema.</p>
      <p className="mt-1">
        Use o botão <strong>“Pular por enquanto”</strong> abaixo para concluir o
        cadastro mesmo sem nenhuma foto carregada. Você pode adicionar ou trocar
        as imagens depois pelo Dashboard, em <em>Meus serviços</em>.
      </p>
    </aside>

    <div
      className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card"
      role="group"
      aria-label={`Fotos do serviço ${serviceName || ''}`.trim()}
    >
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Camera className="h-3.5 w-3.5" aria-hidden="true" /> {serviceName || 'Seu serviço'}
      </span>
      <ServiceImageUpload serviceId={serviceId} userId={userId} />
    </div>

    <div className="flex flex-col gap-2 pt-1">
      <Button
        type="button"
        size="lg"
        onClick={onContinue}
        aria-label="Concluir esta etapa e continuar"
        className="group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-base font-bold text-white shadow-[0_0_24px_rgba(251,146,60,0.55)] hover:opacity-95"
      >
        Concluir
        <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onSkip}
        aria-label="Pular esta etapa e finalizar sem adicionar fotos agora"
        className="w-full text-muted-foreground"
      >
        Pular por enquanto
      </Button>
    </div>

    <p className="text-center text-[11px] text-muted-foreground">
      Você pode adicionar/trocar fotos depois pelo Dashboard.
    </p>
  </motion.section>
);

export default Phase2Photos;
