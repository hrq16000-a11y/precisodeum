import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, ChevronLeft, ChevronRight, Flame, Trophy, Target, TrendingUp, Camera, MessageSquare } from 'lucide-react';

const tips = [
  { icon: Camera, title: 'Fotos de qualidade vendem', text: 'Profissionais com fotos no portfólio recebem até 3x mais leads. Adicione fotos dos seus trabalhos!' },
  { icon: MessageSquare, title: 'Responda rápido', text: 'Leads respondidos em até 1 hora têm 7x mais chance de conversão. Ative as notificações!' },
  { icon: TrendingUp, title: 'Descrição completa', text: 'Perfis com descrições detalhadas (+100 palavras) aparecem mais nos resultados de busca.' },
  { icon: Target, title: 'Defina sua área', text: 'Configure sua área de atuação para aparecer nas buscas certas e atrair clientes próximos.' },
  { icon: Trophy, title: 'Peça avaliações', text: 'Após cada trabalho, peça ao cliente para avaliar. Profissionais com +5 avaliações ganham selo de confiança.' },
  { icon: Flame, title: 'Mantenha-se ativo', text: 'Profissionais que atualizam seu perfil semanalmente recebem mais destaque no ranking da plataforma.' },
];

interface DashboardTipOfDayProps {
  servicesCount: number;
  portfolioCount: number;
  leadsCount: number;
  reviewCount: number;
}

const DashboardTipOfDay = ({ servicesCount, portfolioCount, leadsCount, reviewCount }: DashboardTipOfDayProps) => {
  // Pick a relevant tip based on profile gaps, or cycle through
  const smartTipIndex = useMemo(() => {
    if (portfolioCount === 0) return 0; // Photos tip
    if (leadsCount > 0 && reviewCount === 0) return 4; // Ask for reviews
    if (servicesCount < 2) return 2; // Description tip
    // Default: day-based rotation
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return dayOfYear % tips.length;
  }, [portfolioCount, leadsCount, reviewCount, servicesCount]);

  const [currentIndex, setCurrentIndex] = useState(smartTipIndex);
  const [direction, setDirection] = useState(0);

  const tip = tips[currentIndex];
  const Icon = tip.icon;

  const navigate = (dir: number) => {
    setDirection(dir);
    setCurrentIndex((prev) => (prev + dir + tips.length) % tips.length);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="rounded-2xl border border-accent/15 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 p-4 relative overflow-hidden"
    >
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
      
      <div className="flex items-center justify-between mb-3 relative">
        <div className="flex items-center gap-2">
          <motion.div
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <Lightbulb className="h-3.5 w-3.5 text-accent" />
          </motion.div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dica do dia</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[9px] text-muted-foreground/50 tabular-nums">{currentIndex + 1}/{tips.length}</span>
          <button
            onClick={() => navigate(1)}
            className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
          transition={{ duration: 0.25 }}
          className="relative"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">{tip.title}</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tip.text}</p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

export default DashboardTipOfDay;
