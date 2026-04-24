import { useEffect, useMemo, useState } from 'react';
import { useEngagementLevel } from '@/hooks/useEngagementLevel';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, X, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Detects when the user reaches a new gamification level by comparing
 * the current level name with the last value persisted in localStorage.
 * Shows a fixed motivational banner until dismissed by the user.
 */
const STORAGE_KEY = 'pdu_last_level_seen';

const LevelUpBanner = () => {
  const { user } = useAuth();
  const { currentLevel } = useEngagementLevel();
  const [dismissed, setDismissed] = useState(false);
  const [previousName, setPreviousName] = useState<string | null>(null);

  const key = user?.id ? `${STORAGE_KEY}:${user.id}` : null;

  useEffect(() => {
    if (!key) return;
    const stored = localStorage.getItem(key);
    setPreviousName(stored);
  }, [key]);

  const isLevelUp = useMemo(() => {
    if (!currentLevel?.name || !previousName) return false;
    return previousName !== currentLevel.name;
  }, [currentLevel?.name, previousName]);

  // Persist on first ever sight (no banner) and after dismiss.
  useEffect(() => {
    if (!key || !currentLevel?.name) return;
    if (!previousName) {
      localStorage.setItem(key, currentLevel.name);
    }
  }, [key, currentLevel?.name, previousName]);

  if (!isLevelUp || dismissed) return null;

  const handleClose = () => {
    if (key && currentLevel?.name) localStorage.setItem(key, currentLevel.name);
    setDismissed(true);
  };

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: currentLevel?.color || '#f59e0b', color: '#fff' }}
        >
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            Parabéns! Você alcançou o nível {currentLevel?.name}.
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sua vitrine ganhou mais destaque na busca. Continue evoluindo para desbloquear novos benefícios.
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default LevelUpBanner;
