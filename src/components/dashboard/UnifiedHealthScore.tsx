import { Link } from 'react-router-dom';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Props {
  /** 0–100 */
  score: number;
  /** Number of remaining checklist items */
  remaining?: number;
}

/**
 * Score único e elegante de "Saúde do Perfil" — substitui os antigos cards
 * duplicados de Completude + Saúde do Perfil. Premium, denso, single-line.
 */
const UnifiedHealthScore = ({ score, remaining }: Props) => {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const isPerfect = pct >= 100;

  return (
    <section
      className="rounded-2xl border border-border bg-card p-6 shadow-sm"
      aria-label="Score de Saúde do Perfil"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            {isPerfect ? (
              <ShieldCheck size={20} strokeWidth={1.5} />
            ) : (
              <Sparkles size={20} strokeWidth={1.5} />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Score de Saúde do Perfil
            </h2>
            <p className="text-xs text-muted-foreground">
              {isPerfect
                ? 'Tudo pronto. Você está no máximo destaque.'
                : `${remaining ?? ''} ${remaining === 1 ? 'pendência' : 'pendências'} para o perfil ideal`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-tight text-foreground">{pct}%</p>
          {!isPerfect && (
            <Link
              to="/dashboard/perfil"
              className="text-[11px] font-medium text-accent hover:underline"
            >
              Como melhorar?
            </Link>
          )}
        </div>
      </div>
      <div className="mt-4 h-2" style={{ minHeight: 8 }}>
        <Progress value={pct} className="h-2" />
      </div>
    </section>
  );
};

export default UnifiedHealthScore;
