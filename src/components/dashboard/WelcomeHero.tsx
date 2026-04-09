import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowRight, Sparkles, Crown, Shield, Flame, Sun, Moon, CloudSun, Zap, Target } from 'lucide-react';
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
  avatarUrl?: string;
}

const motivationalPhrases = [
  'Cada lead é uma oportunidade de brilhar! ✨',
  'Profissionais ativos recebem mais destaque 🚀',
  'Seu próximo cliente pode estar procurando agora 🔍',
  'Consistência é a chave do sucesso profissional 💪',
  'Mantenha seu perfil atualizado para mais visibilidade 📈',
  'Bons profissionais são encontrados, não procurados 🎯',
];

const WelcomeHero = ({
  greeting, name, pendingLeads,
  levelName, levelColor,
  accountTypeName, accountTypeColor,
  memberSince, plan, avatarUrl,
}: WelcomeHeroProps) => {
  const navigate = useNavigate();
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  const hour = new Date().getHours();

  // Time-based icon
  const TimeIcon = hour < 12 ? Sun : hour < 18 ? CloudSun : Moon;

  // Days as member
  const memberDays = memberSince
    ? Math.floor((Date.now() - new Date(memberSince).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Day-based motivational phrase
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const phrase = motivationalPhrases[dayOfYear % motivationalPhrases.length];

  // Milestone badges
  const milestones = [];
  if (memberDays >= 365) milestones.push({ label: '1+ ano', icon: '🏆' });
  else if (memberDays >= 180) milestones.push({ label: '6+ meses', icon: '⭐' });
  else if (memberDays >= 30) milestones.push({ label: '1+ mês', icon: '🌟' });

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl overflow-hidden"
    >
      {/* Background gradient mesh */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/8 via-primary/5 to-transparent" />
      <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />

      <div className="relative p-4 sm:p-5">
        {/* Top row: date + badges */}
        <div className="flex items-center justify-between mb-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <TimeIcon className="h-3 w-3 text-accent" />
            <span className="capitalize">{today}</span>
            {memberDays > 0 && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-[10px]">{memberDays} dias na plataforma</span>
              </>
            )}
          </motion.div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {milestones.map(m => (
              <motion.span
                key={m.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 }}
                className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary"
              >
                {m.icon} {m.label}
              </motion.span>
            ))}
            {plan === 'premium' && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20"
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
          {avatarUrl ? (
            <motion.div className="relative shrink-0">
              <motion.img
                src={avatarUrl}
                alt={name}
                className="h-12 w-12 rounded-2xl object-cover shadow-sm border-2 border-accent/20"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
              />
              {/* Online indicator */}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-card" />
              </span>
            </motion.div>
          ) : (
            <motion.div
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-primary/20 shadow-sm"
              animate={{ rotate: [0, 3, -3, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="h-5 w-5 text-accent" />
            </motion.div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground leading-tight">
              {greeting}, {name}!
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {pendingLeads > 0 ? (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="inline-flex items-center gap-1"
                >
                  <Flame className="h-3.5 w-3.5 text-accent" />
                  <span className="font-semibold text-accent">{pendingLeads}</span>{' '}
                  lead{pendingLeads !== 1 ? 's' : ''} aguardando
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

        {/* Motivational phrase bar */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-3 rounded-xl bg-accent/5 border border-accent/10 px-3 py-2 flex items-center gap-2"
        >
          <Target className="h-3.5 w-3.5 text-accent shrink-0" />
          <p className="text-[11px] text-muted-foreground font-medium">{phrase}</p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default WelcomeHero;
