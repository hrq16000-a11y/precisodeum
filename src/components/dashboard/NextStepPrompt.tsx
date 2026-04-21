import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, Image as ImageIcon, Eye, Sparkles, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { logAuditAction } from '@/hooks/useAuditLog';

interface NextStepPromptProps {
  open: boolean;
  onClose: () => void;
  /** Context that just completed, used to bias suggested next step. */
  context: 'service' | 'album' | 'photo' | 'profile';
  providerSlug?: string | null;
}

const SESSION_KEY = 'nextstep_prompt_shown_v1';
const COOLDOWN_MS = 60_000; // 1 minute window — survives F5 but allows new actions

/** Returns true if the same context was shown recently (avoids re-opening on F5). */
function wasRecentlyShown(context: string) {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { context: string; ts: number };
    return parsed.context === context && Date.now() - parsed.ts < COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markShown(context: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ context, ts: Date.now() }));
  } catch {
    // ignore
  }
}

/**
 * NextStepPrompt — the "pegar pela mão" dialog shown after a successful save.
 * Always offers 3 forward paths instead of dead-ending the user.
 */
const NextStepPrompt = ({ open, onClose, context, providerSlug }: NextStepPromptProps) => {
  const navigate = useNavigate();
  const skippedRef = useRef(false);
  const openedAtRef = useRef<number | null>(null);

  // If recently shown for the same context, auto-close and skip render
  useEffect(() => {
    if (open && wasRecentlyShown(context) && !skippedRef.current) {
      skippedRef.current = true;
      onClose();
      return;
    }
    if (open) {
      markShown(context);
      openedAtRef.current = Date.now();
    } else {
      openedAtRef.current = null;
    }
  }, [open, context, onClose]);

  /** ms since the dialog opened — used to track "decision time" in audit_log */
  const decisionMs = () => (openedAtRef.current ? Date.now() - openedAtRef.current : null);

  if (open && wasRecentlyShown(context) && skippedRef.current) return null;

  const headline = {
    service: 'Parabéns! Seu serviço está no ar.',
    album: 'Álbum criado com sucesso!',
    photo: 'Foto adicionada ao portfólio!',
    profile: 'Perfil atualizado!',
  }[context];

  const sub = {
    service: 'Quer continuar evoluindo? Escolha o próximo passo:',
    album: 'Continue construindo seu portfólio:',
    photo: 'O que você gostaria de fazer agora?',
    profile: 'O que você gostaria de fazer agora?',
  }[context];

  const options = [
    context === 'service'
      ? { icon: Briefcase, title: 'Adicionar mais um serviço', desc: 'Cada serviço amplia seu alcance.', to: '/dashboard/servicos' }
      : { icon: Briefcase, title: 'Cadastrar um serviço', desc: 'Serviços ativos aparecem em buscas.', to: '/dashboard/servicos' },
    { icon: ImageIcon, title: 'Adicionar fotos ao portfólio', desc: 'Imagens convertem 5x mais.', to: '/dashboard/portfolio' },
    {
      icon: Eye,
      title: 'Ver minha página pública',
      desc: 'Veja como o cliente está te enxergando.',
      to: providerSlug ? `/profissional/${providerSlug}` : '/dashboard/minha-pagina',
    },
  ];

  const handleChoice = (opt: { title: string; to: string }) => {
    void logAuditAction({
      action: 'next_step_chosen',
      resource_type: 'next_step_prompt',
      details: { context, choice: opt.title, target: opt.to, decision_ms: decisionMs() },
    });
    onClose();
    navigate(opt.to);
  };

  const handleDismiss = () => {
    void logAuditAction({
      action: 'next_step_dismissed',
      resource_type: 'next_step_prompt',
      details: { context, decision_ms: decisionMs() },
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{headline}</DialogTitle>
          <DialogDescription className="text-center">{sub}</DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          {options.map((opt, i) => {
            const Icon = opt.icon;
            return (
              <motion.button
                key={opt.title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => handleChoice(opt)}
                className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{opt.title}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </motion.button>
            );
          })}
        </div>

        <Button variant="ghost" size="sm" onClick={handleDismiss} className="mt-2 gap-1.5">
          <X className="h-3.5 w-3.5" /> Continuar no painel
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default NextStepPrompt;
