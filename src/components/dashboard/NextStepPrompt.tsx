import { useRef } from 'react';
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
  context: 'service' | 'album' | 'photo' | 'profile' | 'welcome';
  providerSlug?: string | null;
}

/**
 * NextStepPrompt — the "pegar pela mão" dialog shown after a successful save.
 * Always offers 3 forward paths instead of dead-ending the user.
 */
const NextStepPrompt = ({ open, onClose, context, providerSlug }: NextStepPromptProps) => {
  const navigate = useNavigate();
  const openedAtRef = useRef<number | null>(null);
  if (open && openedAtRef.current === null) openedAtRef.current = Date.now();
  if (!open && openedAtRef.current !== null) openedAtRef.current = null;

  /** ms since the dialog opened — used to track "decision time" in audit_log */
  const decisionMs = () => (openedAtRef.current ? Date.now() - openedAtRef.current : null);

  const headline = {
    service: 'Parabéns! Seu serviço está no ar.',
    album: 'Álbum criado com sucesso!',
    photo: 'Foto adicionada ao portfólio!',
    profile: 'Perfil atualizado!',
    welcome: 'Bem-vindo(a)! Sua conta foi criada 🎉',
  }[context];

  const sub = {
    service: 'Você ganhou um novo espaço na vitrine! Quer cadastrar mais um serviço agora ou ver como seu perfil está ficando?',
    album: 'Você ganhou um novo espaço na vitrine! Continue construindo seu portfólio ou veja sua página pública.',
    photo: 'O que você gostaria de fazer agora?',
    profile: 'O que você gostaria de fazer agora?',
    welcome: 'Vamos juntos? Escolha por onde começar sua jornada:',
  }[context];

  const options = context === 'welcome'
    ? [
        { icon: Sparkles, title: 'Completar meu perfil', desc: 'Preencha os dados básicos para destacar sua marca.', to: '/dashboard/perfil' },
        { icon: Briefcase, title: 'Cadastrar 1º serviço', desc: 'Comece a aparecer nas buscas hoje.', to: '/dashboard/servicos' },
        { icon: ImageIcon, title: 'Criar meu portfólio', desc: 'Suba fotos dos seus trabalhos — converte 5x mais.', to: '/dashboard/portfolio' },
        { icon: Eye, title: 'Ir para o painel', desc: 'Explore o dashboard com calma.', to: '/dashboard' },
      ]
    : [
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
