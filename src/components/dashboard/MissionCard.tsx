import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMaturityTier } from '@/hooks/useMaturityTier';
import { getMissionsForTier, type Mission, type MissionAnswer } from '@/lib/missions';

/**
 * Cards de Missão Profissional — exibem a próxima pergunta gated pelo tier
 * de maturidade. Resposta é gravada em providers.mission_answers (jsonb)
 * e os triggers de sync já cuidam de propagar para profiles quando aplicável.
 */
const MissionCard = () => {
  const { user, provider, refetchProfile } = useAuth();
  const { tier } = useMaturityTier();
  const [submitting, setSubmitting] = useState(false);

  const answers = useMemo(
    () => (provider?.mission_answers as Record<string, MissionAnswer>) ?? {},
    [provider?.mission_answers]
  );

  // Próxima missão pendente para o tier atual
  const currentMission: Mission | null = useMemo(() => {
    if (!tier) return null;
    const candidates = getMissionsForTier(tier);
    return candidates.find((m) => answers[m.key] === undefined || answers[m.key] === null) ?? null;
  }, [tier, answers]);

  if (!user || !provider || !currentMission) return null;

  const submit = async (value: MissionAnswer) => {
    if (!provider?.id) return;
    setSubmitting(true);
    try {
      const next = { ...answers, [currentMission.key]: value };
      const { error } = await supabase
        .from('providers')
        .update({ mission_answers: next as any })
        .eq('id', provider.id);
      if (error) throw error;
      toast.success('Missão concluída!', {
        description: '+5 pontos de engajamento. Próxima missão liberada.',
      });
      await refetchProfile();
    } catch (e) {
      console.error('[MissionCard] submit error', e);
      toast.error('Não foi possível salvar sua resposta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentMission.key}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 to-purple-500/5 p-4 sm:p-5 relative overflow-hidden"
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-20 bg-accent" />

        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
            <Target className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
              Missão Profissional
            </p>
            <h3 className="text-sm font-bold text-foreground leading-tight">
              {currentMission.question}
            </h3>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4">{currentMission.benefit}</p>

        {currentMission.type === 'yes_no' && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="default"
              disabled={submitting}
              onClick={() => submit(true)}
              className="gap-1.5"
            >
              <Check className="h-3.5 w-3.5" /> Sim
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => submit(false)}
            >
              Não
            </Button>
          </div>
        )}

        {currentMission.type === 'choice' && currentMission.options && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {currentMission.options.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant="outline"
                disabled={submitting}
                onClick={() => submit(opt.value)}
                className="justify-start text-left text-xs h-auto py-2 whitespace-normal"
              >
                {opt.label}
              </Button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default MissionCard;
