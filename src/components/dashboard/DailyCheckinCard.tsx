import { Flame, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useDailyCheckin } from '@/hooks/useDailyCheckin';

/**
 * Card de check-in diário no dashboard.
 * Mostra streak atual, progresso até 7 dias (Nível 5), botão para registrar hoje.
 */
const DailyCheckinCard = () => {
  const { streak, doneToday, loading, register } = useDailyCheckin();
  const target = 7;
  const pct = Math.min(100, Math.round((streak / target) * 100));

  if (loading) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              Check-in diário
            </h3>
            <p className="text-xs text-muted-foreground">
              {streak === 0
                ? 'Comece hoje sua sequência!'
                : `${streak} ${streak === 1 ? 'dia' : 'dias'} seguidos`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={doneToday ? 'outline' : 'accent'}
          disabled={doneToday}
          onClick={() => void register()}
        >
          {doneToday ? <><Check className="h-4 w-4 mr-1" /> Hoje</> : 'Fazer check-in'}
        </Button>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-muted-foreground">Progresso até bônus de 7 dias</span>
          <span className="font-bold text-orange-500">{streak}/{target}</span>
        </div>
        <Progress value={pct} className="h-2" />
        {streak >= target && (
          <p className="mt-2 text-[11px] text-accent font-semibold">
            🎉 Você já desbloqueou o bônus de +100 pontos!
          </p>
        )}
      </div>
    </div>
  );
};

export default DailyCheckinCard;
