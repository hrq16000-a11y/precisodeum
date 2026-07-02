import { useEffect, useRef } from 'react';
import { Trophy, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useEngagementLevel } from '@/hooks/useEngagementLevel';
import { toast } from 'sonner';

/**
 * Barra de progresso de nível visível em tempo real durante o onboarding.
 * Quando o usuário sobe de nível, dispara toast comemorativo.
 */
const LevelProgressBar = () => {
  const { points, currentLevel, nextLevel, progressPct, pointsToNext, loading } = useEngagementLevel();
  const lastLevelId = useRef<string | null>(null);

  useEffect(() => {
    if (!currentLevel) return;
    if (lastLevelId.current && lastLevelId.current !== currentLevel.id) {
      toast.success(`🎉 Você subiu para ${currentLevel.name}!`, { duration: 5000 });
    }
    lastLevelId.current = currentLevel.id;
  }, [currentLevel]);

  if (loading || !currentLevel) return null;

  return (
    <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/5 to-transparent p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${currentLevel.color}20`, color: currentLevel.color }}
          >
            <Trophy className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-foreground truncate">
              Nível {currentLevel.name}
            </p>
            <p className="text-[10px] text-muted-foreground">{points} pts</p>
          </div>
        </div>
        {nextLevel && (
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground">Próximo</p>
            <p className="text-[11px] font-semibold text-foreground inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-accent" /> {nextLevel.name}
            </p>
          </div>
        )}
      </div>
      <Progress value={progressPct} className="mt-2 h-1.5" />
      {nextLevel && (
        <p className="mt-1 text-[10px] text-muted-foreground text-center">
          Faltam <span className="font-bold text-accent">{pointsToNext}</span> pts para {nextLevel.name}
        </p>
      )}
    </div>
  );
};

export default LevelProgressBar;
