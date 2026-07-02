import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * PrefilledBadge — sinaliza visualmente que um campo/opção do Wizard
 * já foi preenchido ou selecionado anteriormente (hidratação de
 * draft remoto, modo de edição ou auto-detect via GPS/CEP).
 *
 * Uso:
 *   {isPrefilled && <PrefilledBadge />}
 *   <input className={cn(styles.input, isPrefilled && prefilledRing)} />
 */
export function PrefilledBadge({
  label = 'Já preenchido',
  className,
  size = 'sm',
}: {
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const sizeCls = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        'bg-bet-green-soft text-bet-green-fg border border-bet-green-border',
        sizeCls,
        className,
      )}
      aria-label={label}
    >
      <CheckCircle2 className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

/**
 * Classes utilitárias para destacar um campo já preenchido.
 * Aplique em conjunto com a classe base do input/card.
 */
export const prefilledRing =
  'ring-2 ring-bet-green/40 border-bet-green/60 bg-bet-green-soft/30';

/** Card de seleção em estado "selecionado anteriormente". */
export const prefilledSelectCard =
  'ring-2 ring-bet-green/40 border-bet-green bg-bet-green-soft/40 shadow-[0_0_18px_hsl(var(--bet-green)/0.25)]';
