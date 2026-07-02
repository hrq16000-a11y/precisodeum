import { useState } from 'react';
import { CheckCircle2, Flame, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * Ciclo de Fechamento (Relato de Sucesso).
 * Não pedimos valor nem nota — apenas o clique.
 * Atualiza last_active_at e aplica completion_boost de 3 dias (+15% no ranking).
 */
export default function ServiceCompletionCard() {
  const [loading, setLoading] = useState(false);
  const [boostUntil, setBoostUntil] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('register_service_completion');
      if (error) throw error;
      const result = data as { boost_until?: string; boost_days?: number } | null;
      if (result?.boost_until) {
        setBoostUntil(result.boost_until);
      }
      toast.success('Boa! Serviço registrado.', {
        description: 'Você ganhou 3 dias de impulso no ranking. Continue assim!',
        icon: <Flame className="h-4 w-4 text-amber-500" />,
        duration: 5000,
      });
    } catch (err) {
      const msg = (err as Error).message || '';
      if (msg.includes('provider_not_found')) {
        toast.error('Você precisa ter um perfil de prestador completo.');
      } else {
        toast.error('Não foi possível registrar agora. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (boostUntil) {
    const until = new Date(boostUntil);
    return (
      <Card className="p-4 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 dark:border-amber-900/40">
        <div className="flex items-start gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="rounded-full bg-amber-500 p-2 shrink-0"
          >
            <Flame className="h-5 w-5 text-white" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-amber-900 dark:text-amber-100">Em alta no ranking!</h3>
            <p className="text-sm text-amber-800 dark:text-amber-200/90 mt-0.5">
              Seu perfil ganhou +15% de visibilidade até{' '}
              <strong>
                {until.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </strong>
              .
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-emerald-500/10 p-2 shrink-0">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">Concluiu um serviço por aqui?</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Marque para ganhar <strong>+15% de visibilidade por 3 dias</strong>. Sem cobrança, sem nota — só você
            registrando que está ativo.
          </p>
          <Button
            onClick={handleClick}
            disabled={loading}
            size="sm"
            className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registrando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Concluí um serviço
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
