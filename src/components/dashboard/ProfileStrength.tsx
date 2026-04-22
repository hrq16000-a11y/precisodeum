import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, ArrowUp, Zap, Sparkles, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import IconRenderer from '@/components/ui/IconRenderer';
import DopamineCounter from '@/components/dashboard/DopamineCounter';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { resolveGamificationMultiplier, scaleGamificationPoints } from '@/lib/gamification';

interface GamificationLevel {
  id: string;
  name: string;
  icon: string;
  color: string;
  min_points: number;
  max_points: number | null;
  badge_class: string;
  benefits: string[];
}

const ProfileStrength = () => {
  const { user, profile } = useAuth();
  const [levels, setLevels] = useState<GamificationLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const multiplier = resolveGamificationMultiplier(useSettingValue('gamification_multiplier'));

  const points = scaleGamificationPoints(profile?.engagement_points || 0, multiplier);

  useEffect(() => {
    supabase.from('gamification_levels')
      .select('id, name, icon, color, min_points, max_points, badge_class, benefits')
      .eq('active', true)
      .order('min_points', { ascending: true })
      .then(({ data }) => {
        setLevels(((data || []) as GamificationLevel[]).map((level) => ({
          ...level,
          min_points: scaleGamificationPoints(level.min_points, multiplier),
          max_points: level.max_points == null ? null : scaleGamificationPoints(level.max_points, multiplier),
        })));
        setLoading(false);
      });
  }, [multiplier]);

  if (loading || levels.length === 0) return null;

  // Find current and next level
  const currentLevel = [...levels].reverse().find(l => points >= l.min_points) || levels[0];
  const currentIdx = levels.findIndex(l => l.id === currentLevel.id);
  const nextLevel = currentIdx < levels.length - 1 ? levels[currentIdx + 1] : null;

  // Progress to next level
  const currentMin = currentLevel.min_points;
  const nextMin = nextLevel ? nextLevel.min_points : currentLevel.max_points ?? currentMin;
  const range = nextMin - currentMin;
  const progressInRange = points - currentMin;
  const progressPercent = range > 0 ? Math.min(100, Math.round((progressInRange / range) * 100)) : 100;
  const pointsToNext = nextLevel ? nextLevel.min_points - points : 0;

  // Dynamic tips based on points
  const tips = [
    { min: 0, text: 'Perfis com 3+ serviços recebem 5x mais leads! Cadastre agora.', action: '/dashboard/servicos' },
    { min: 10, text: 'Adicione fotos ao portfólio para ganhar +10 pontos e atrair mais clientes.', action: '/dashboard/portfolio' },
    { min: 30, text: 'Peça avaliações aos seus clientes! Cada review vale +10 pontos.', action: '/dashboard/avaliacoes' },
    { min: 70, text: 'Você está quase no Ouro! Complete seu perfil para o último impulso.', action: '/dashboard/perfil' },
    { min: 150, text: 'Mantenha seus serviços atualizados para manter o nível Diamante!', action: '/dashboard/servicos' },
  ];
  const tip = [...tips].reverse().find(t => points >= t.min) || tips[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-border bg-card p-4 sm:p-5 relative overflow-hidden"
    >
      {/* Subtle glow */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20" style={{ backgroundColor: currentLevel.color }} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${currentLevel.color}20` }}>
            <IconRenderer name={currentLevel.icon} size={22} style={{ color: currentLevel.color }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              Força do Perfil
              <Trophy className="h-3.5 w-3.5 text-accent" />
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Nível <span className="font-semibold" style={{ color: currentLevel.color }}>{currentLevel.name}</span>
              {' · '}<DopamineCounter value={points} className="font-semibold" celebrateOnComplete />
            </p>
          </div>
        </div>
        {nextLevel && (
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Próximo nível</p>
            <p className="text-xs font-bold flex items-center gap-1" style={{ color: nextLevel.color }}>
              <IconRenderer name={nextLevel.icon} size={14} /> {nextLevel.name}
            </p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold inline-flex items-center gap-1" style={{ color: currentLevel.color }}>
            <IconRenderer name={currentLevel.icon} size={12} /> {currentLevel.name}
          </span>
          {nextLevel && (
            <span className="text-[10px] font-semibold inline-flex items-center gap-1" style={{ color: nextLevel.color }}>
              <IconRenderer name={nextLevel.icon} size={12} /> {nextLevel.name}
            </span>
          )}
        </div>
        <div className="h-3 rounded-full bg-muted/60 overflow-hidden relative">
          <motion.div
            className="h-full rounded-full relative"
            style={{
              background: `linear-gradient(90deg, ${currentLevel.color}, ${nextLevel?.color || currentLevel.color})`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          >
            {/* Shimmer */}
            <div className="absolute inset-0 shimmer opacity-40" />
          </motion.div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">{progressPercent}%</span>
          {nextLevel && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <ArrowUp className="h-2.5 w-2.5" />
              Faltam <span className="font-bold text-foreground"><DopamineCounter value={pointsToNext} suffix="" /></span> pts
            </span>
          )}
        </div>
      </div>

      {/* Dynamic tip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-3 rounded-xl bg-accent/5 border border-accent/10 p-3 flex items-start gap-2.5"
      >
        <Zap className="h-4 w-4 text-accent shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-foreground font-medium">{tip.text}</p>
          <Link to={tip.action} className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-accent hover:underline">
            Ir agora <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </motion.div>

      {/* Points breakdown mini */}
      {!nextLevel && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-3 flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/10 to-accent/10 p-3"
        >
          <Sparkles className="h-4 w-4 text-purple-500" />
          <p className="text-[11px] font-bold text-foreground">
            Nível máximo alcançado! Você é um Mestre da plataforma.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ProfileStrength;
