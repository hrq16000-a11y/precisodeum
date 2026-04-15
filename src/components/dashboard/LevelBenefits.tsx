import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface GamLevel {
  id: string;
  name: string;
  icon: string;
  color: string;
  min_points: number;
  max_points: number | null;
  benefits: string[];
}

const LevelBenefits = () => {
  const { profile } = useAuth();
  const [levels, setLevels] = useState<GamLevel[]>([]);
  const points = profile?.engagement_points || 0;

  useEffect(() => {
    supabase.from('gamification_levels')
      .select('id, name, icon, color, min_points, max_points, benefits')
      .eq('active', true)
      .order('min_points', { ascending: true })
      .then(({ data }) => setLevels((data || []) as GamLevel[]));
  }, []);

  if (levels.length === 0) return null;

  const currentLevel = [...levels].reverse().find(l => points >= l.min_points) || levels[0];
  const currentIdx = levels.findIndex(l => l.id === currentLevel.id);
  const nextLevel = currentIdx < levels.length - 1 ? levels[currentIdx + 1] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Gift className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-bold text-foreground">Benefícios do seu Nível</h3>
      </div>

      {/* Current level benefits */}
      <div className="rounded-xl p-3 border" style={{ borderColor: `${currentLevel.color}30`, backgroundColor: `${currentLevel.color}08` }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{currentLevel.icon}</span>
          <span className="text-xs font-bold" style={{ color: currentLevel.color }}>{currentLevel.name}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">Atual</span>
        </div>
        <div className="space-y-1.5">
          {(currentLevel.benefits || []).map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="flex items-center gap-2 text-[11px] text-foreground"
            >
              <CheckCircle2 className="h-3 w-3 text-accent shrink-0" />
              {b}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Next level preview */}
      {nextLevel && (
        <div className="mt-3 rounded-xl p-3 border border-dashed border-muted-foreground/20 bg-muted/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-muted/50" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg opacity-60">{nextLevel.icon}</span>
              <span className="text-xs font-bold text-muted-foreground">{nextLevel.name}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold flex items-center gap-0.5">
                <Lock className="h-2.5 w-2.5" /> Desbloquear
              </span>
            </div>
            <div className="space-y-1.5">
              {(nextLevel.benefits || []).map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Lock className="h-3 w-3 shrink-0 opacity-40" />
                  {b}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] font-semibold text-accent flex items-center gap-1">
              +{nextLevel.min_points - points} pontos para desbloquear <ArrowRight className="h-3 w-3" />
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default LevelBenefits;
