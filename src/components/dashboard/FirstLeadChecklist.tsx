import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Phone, MapPin, FileText, Briefcase, CheckCircle2, Sparkles, Rocket, Loader2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Step {
  key: string;
  label: string;
  hint: string;
  icon: typeof Camera;
  done: boolean;
  href: string;
}

interface Props {
  /** Optional override; default is /dashboard/perfil */
  className?: string;
}

const FirstLeadChecklist = ({ className = '' }: Props) => {
  const { profile, provider, refetchProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const boostUntil = (profile as any)?.trial_boost_until
    ? new Date((profile as any).trial_boost_until as string)
    : null;
  const boostActive = !!boostUntil && boostUntil.getTime() > Date.now();

  const steps: Step[] = useMemo(() => {
    const hasPhoto = !!(provider?.photo_url || profile?.avatar_url);
    const hasContact = !!(profile?.whatsapp || profile?.phone || (provider as any)?.whatsapp || (provider as any)?.phone);
    const hasLocation = !!(provider?.city && provider.city !== 'Não informada' && provider?.state);
    const hasDescription = !!(provider?.description && provider.description.length >= 30);
    const hasService = (provider?.services_count ?? 0) >= 1;

    return [
      { key: 'photo', label: 'Foto de perfil', hint: 'Adicione uma foto profissional', icon: Camera, done: hasPhoto, href: '/dashboard/perfil' },
      { key: 'contact', label: 'WhatsApp / Telefone', hint: 'Cadastre seu contato direto', icon: Phone, done: hasContact, href: '/dashboard/perfil' },
      { key: 'location', label: 'Cidade e estado', hint: 'Defina onde você atende', icon: MapPin, done: hasLocation, href: '/dashboard/perfil' },
      { key: 'description', label: 'Descrição (≥30 caracteres)', hint: 'Conte o que você faz de melhor', icon: FileText, done: hasDescription, href: '/dashboard/perfil' },
      { key: 'service', label: 'Pelo menos 1 serviço', hint: 'Cadastre o que você oferece', icon: Briefcase, done: hasService, href: '/dashboard/servicos' },
    ];
  }, [profile, provider]);

  const completed = steps.filter(s => s.done).length;
  const total = steps.length;
  const allDone = completed === total;
  const pct = Math.round((completed / total) * 100);

  const handleActivateBoost = async () => {
    if (!allDone || submitting || boostActive) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('complete_onboarding_checklist' as any);
      if (error) throw error;
      const result = data as { status?: string; boost_until?: string } | null;
      if (result?.status === 'granted') {
        toast.success('Boost ativado! Você está em destaque por 7 dias.', {
          description: 'Seu perfil aparecerá com prioridade nas buscas.',
          duration: 6000,
        });
      } else if (result?.status === 'already_active') {
        toast.info('Boost já está ativo no seu perfil.');
      }

      // Trigger P2P referral completion (if applicable). Silent on no-op.
      try {
        const { data: refResult } = await supabase.rpc('complete_referral' as any, {
          _referred_id: (profile as any)?.id,
        });
        if (refResult === true) {
          toast.success('Indicação concluída! +100 pontos extras para você.', {
            description: 'Seu indicador também ganhou 100 pontos.',
            duration: 5000,
          });
        }
      } catch {
        // Silent: not all users were referred.
      }

      await refetchProfile();
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível ativar o boost agora.');
    } finally {
      setSubmitting(false);
    }
  };

  // Boost ativo → card de status
  if (boostActive) {
    const daysLeft = Math.max(0, Math.ceil((boostUntil!.getTime() - Date.now()) / 86400000));
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 via-card to-primary/10 p-5 ${className}`}
      >
        <div className="flex items-start gap-3">
          <motion.div
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-lg"
          >
            <Rocket className="h-6 w-6" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base font-bold text-foreground">Boost de Visibilidade Ativo</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Seu perfil tem prioridade nas buscas por mais{' '}
              <strong className="text-accent">{daysLeft} dia{daysLeft !== 1 ? 's' : ''}</strong>.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-[11px] font-semibold text-accent">
              <Trophy className="h-3 w-3" /> Selo "Novo Profissional em Destaque"
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border border-border bg-card shadow-card ${className}`}
    >
      {/* Header */}
      <div className="border-b border-border bg-gradient-to-br from-primary/5 to-accent/5 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-primary text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base font-bold text-foreground">Primeiro Lead Garantido</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Complete os 5 passos e ganhe <strong className="text-accent">7 dias de destaque</strong> nas buscas.
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">{completed} de {total} concluídos</span>
            <span className="font-bold text-accent">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      </div>

      {/* Steps */}
      <ul className="divide-y divide-border">
        <AnimatePresence initial={false}>
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.li
                key={step.key}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={step.href}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      step.done
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {step.done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4.5 w-4.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold leading-tight ${
                        step.done ? 'text-foreground line-through opacity-60' : 'text-foreground'
                      }`}
                    >
                      {step.label}
                    </p>
                    {!step.done && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{step.hint}</p>
                    )}
                  </div>
                  {!step.done && (
                    <span className="text-[11px] font-medium text-accent">Concluir →</span>
                  )}
                </Link>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {/* CTA */}
      <div className="border-t border-border bg-muted/30 px-5 py-4">
        {allDone ? (
          <Button
            className="w-full gap-2 bg-gradient-to-r from-accent to-primary text-white hover:opacity-90"
            onClick={handleActivateBoost}
            disabled={submitting}
            size="lg"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Ativando...</>
            ) : (
              <><Rocket className="h-4 w-4" /> Ativar meu boost de 7 dias</>
            )}
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Complete <strong className="text-foreground">{total - completed}</strong> passo{total - completed !== 1 ? 's' : ''} restante{total - completed !== 1 ? 's' : ''} para liberar seu boost.
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default FirstLeadChecklist;
