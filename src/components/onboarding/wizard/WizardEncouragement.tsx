/**
 * WizardEncouragement — mensagem de incentivo + checklist + próximos passos.
 *
 * Aparece ABAIXO do conteúdo principal de cada fase. Curto, sem emoji
 * (regra do projeto), com micro-animação fade-in. Foca em:
 *  1. progresso (X de N)
 *  2. checklist do que está OK
 *  3. próximo passo concreto
 *
 * NÃO repete a barra de progresso global. NÃO é card "maçante" — usa
 * tipografia pequena e tokens neutros (bet-amber/green/border) já existentes.
 */
import { CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WizardEncouragementItem {
  label: string;
  done: boolean;
}

interface Props {
  /** Headline curta (máx. ~50 chars). */
  title: string;
  /** Descrição curta (máx. ~120 chars). Opcional. */
  description?: string;
  /** Próximo passo, ex.: "Adicione 1 foto para liberar o selo Padrão Ouro." */
  nextStep?: string;
  /** Itens já cumpridos / pendentes. Opcional. */
  items?: WizardEncouragementItem[];
  /** Pequeno modificador visual: 'celebrate' usa verde, 'gentle' usa âmbar (default). */
  tone?: 'gentle' | 'celebrate';
  className?: string;
}

export default function WizardEncouragement({
  title,
  description,
  nextStep,
  items,
  tone = 'gentle',
  className,
}: Props) {
  const Icon = tone === 'celebrate' ? Sparkles : ArrowRight;
  return (
    <aside
      role="status"
      aria-live="polite"
      className={cn(
        'mx-auto mt-3 w-full max-w-md rounded-xl border p-3 text-xs animate-fade-in',
        tone === 'celebrate'
          ? 'border-bet-green/40 bg-bet-green-soft/40 text-foreground'
          : 'border-bet-amber/30 bg-bet-amber-soft/40 text-foreground',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={cn(
            'mt-0.5 h-3.5 w-3.5 flex-shrink-0',
            tone === 'celebrate' ? 'text-bet-green' : 'text-bet-amber',
          )}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-bold leading-tight text-foreground">{title}</p>
          {description && <p className="leading-snug text-muted-foreground">{description}</p>}
          {items && items.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {items.map((it) => (
                <li key={it.label} className="flex items-center gap-1.5">
                  {it.done ? (
                    <CheckCircle2 className="h-3 w-3 text-bet-green" aria-hidden />
                  ) : (
                    <Circle className="h-3 w-3 text-muted-foreground" aria-hidden />
                  )}
                  <span
                    className={cn(
                      'leading-tight',
                      it.done ? 'text-muted-foreground line-through' : 'text-foreground',
                    )}
                  >
                    {it.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {nextStep && (
            <p className="mt-1 text-[11px] font-semibold text-bet-amber-fg">
              <span className="text-muted-foreground">Próximo: </span>
              {nextStep}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
