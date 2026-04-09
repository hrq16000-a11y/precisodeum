import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowRight, Sparkles, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WelcomeHeroProps {
  greeting: string;
  name: string;
  pendingLeads: number;
  levelName?: string;
  levelColor?: string;
  accountTypeName?: string;
  accountTypeColor?: string;
  memberSince?: string;
  plan?: string;
}

const WelcomeHero = ({
  greeting, name, pendingLeads,
  levelName, levelColor,
  accountTypeName, accountTypeColor,
  memberSince, plan,
}: WelcomeHeroProps) => {
  const navigate = useNavigate();
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl overflow-hidden"
    >
      {/* Background gradient mesh */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/8 via-primary/5 to-transparent" />
      <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="relative p-4 sm:p-5">
        {/* Top row: date + badges */}
        <div className="flex items-center justify-between mb-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <Calendar className="h-3 w-3" />
            <span className="capitalize">{today}</span>
          </motion.div>

          <div className="flex items-center gap-1.5">
            {plan === 'premium' && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400"
              >
                <Crown className="h-2.5 w-2.5" /> Premium
              </motion.span>
            )}
            {levelName && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 }}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: `${levelColor}15`, color: levelColor }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: levelColor }} />
                {levelName}
              </motion.span>
            )}
            {accountTypeName && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                style={{ borderColor: `${accountTypeColor}30`, color: accountTypeColor }}
              >
                {accountTypeName}
              </motion.span>
            )}
          </div>
        </div>

        {/* Main greeting */}
        <div className="flex items-center gap-3">
          <motion.div
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-primary/20 shadow-sm"
            animate={{ rotate: [0, 3, -3, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles className="h-5 w-5 text-accent" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">
              {greeting}, {name}!
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {pendingLeads > 0 ? (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="inline-flex items-center gap-1"
                >
                  Você tem{' '}
                  <span className="font-semibold text-accent">{pendingLeads}</span>{' '}
                  lead{pendingLeads !== 1 ? 's' : ''} aguardando resposta
                  <button
                    onClick={() => navigate('/dashboard/leads')}
                    className="ml-1 inline-flex items-center gap-0.5 text-accent font-semibold hover:underline"
                  >
                    Ver <ArrowRight className="h-3 w-3" />
                  </button>
                </motion.span>
              ) : (
                'Seu painel profissional'
              )}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default WelcomeHero;
