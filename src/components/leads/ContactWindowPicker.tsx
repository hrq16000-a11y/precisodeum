import { useMemo } from 'react';
import { Clock, Sparkles } from 'lucide-react';
import {
  ContactHours,
  ContactPeriod,
  PERIOD_HINT,
  PERIOD_LABEL,
  PreferredWindow,
  dayLabel,
  matchesContactHours,
  suggestNextSlot,
} from '@/lib/contactWindow';

interface DayChoice {
  key: 'today' | 'tomorrow' | 'day_after' | 'flex';
  label: string;
  iso?: string;
  day: number;
}

const PERIODS: ContactPeriod[] = ['morning', 'afternoon', 'evening'];

function buildDayChoices(now: Date): DayChoice[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const mk = (offset: number, label: string, key: DayChoice['key']): DayChoice => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return { key, label, day: d.getDay(), iso: `${yyyy}-${mm}-${dd}` };
  };
  return [
    mk(0, 'Hoje', 'today'),
    mk(1, 'Amanhã', 'tomorrow'),
    mk(2, 'Depois', 'day_after'),
    { key: 'flex', label: 'Sou flexível', day: -1 },
  ];
}

export interface ContactWindowPickerProps {
  /** Janela atual (controlada). */
  value: PreferredWindow | null;
  onChange: (next: PreferredWindow | null) => void;
  /** Horário do prestador para destacar/match. Opcional. */
  providerHours?: ContactHours;
  /** Mensagem auxiliar. */
  helperText?: string;
  className?: string;
}

/**
 * Combo Dia + Período mobile-first. Sem dependência de DatePicker para reduzir atrito.
 * Ao detectar mismatch com `providerHours`, oferece o próximo slot sugerido.
 */
export function ContactWindowPicker({
  value,
  onChange,
  providerHours,
  helperText,
  className,
}: ContactWindowPickerProps) {
  const now = useMemo(() => new Date(), []);
  const dayChoices = useMemo(() => buildDayChoices(now), [now]);
  const suggestion = useMemo(
    () => (providerHours ? suggestNextSlot(providerHours, now) : null),
    [providerHours, now],
  );
  const matchState = useMemo(
    () => (providerHours ? matchesContactHours(providerHours, value) : 'unspecified'),
    [providerHours, value],
  );

  const selectedDayKey: DayChoice['key'] | null = useMemo(() => {
    if (!value) return null;
    if (value.iso_date) {
      const found = dayChoices.find((d) => d.iso === value.iso_date);
      if (found) return found.key;
    }
    if (value.day === -1) return 'flex';
    return null;
  }, [value, dayChoices]);

  const handleDay = (choice: DayChoice) => {
    const period = value?.period ?? 'afternoon';
    onChange({
      day: choice.day,
      period,
      iso_date: choice.iso ?? null,
      requested_at: new Date().toISOString(),
    });
  };

  const handlePeriod = (period: ContactPeriod) => {
    if (!value) {
      const today = dayChoices[0];
      onChange({
        day: today.day,
        period,
        iso_date: today.iso,
        requested_at: new Date().toISOString(),
      });
      return;
    }
    onChange({ ...value, period, requested_at: new Date().toISOString() });
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    onChange({
      day: suggestion.day,
      period: suggestion.period,
      iso_date: suggestion.isoDate,
      requested_at: new Date().toISOString(),
    });
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Quando prefere ser contatado?</span>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Dia preferido">
        {dayChoices.map((d) => {
          const active = selectedDayKey === d.key;
          return (
            <button
              key={d.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleDay(d)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                active
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-background text-foreground hover:border-accent/40'
              }`}
            >
              <div>{d.label}</div>
              {d.key !== 'flex' && (
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {dayLabel(d.day, true)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Período do dia">
        {PERIODS.map((p) => {
          const active = value?.period === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handlePeriod(p)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                active
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-background text-foreground hover:border-accent/40'
              }`}
            >
              <div>{PERIOD_LABEL[p]}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{PERIOD_HINT[p]}</div>
            </button>
          );
        })}
      </div>

      {matchState === 'mismatch' && suggestion && (
        <div
          data-testid="contact-window-mismatch"
          className="mt-2 flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">Esse horário está fora da janela deste profissional.</p>
            <p className="mt-0.5 text-amber-800/90 dark:text-amber-200/80">
              Sugestão: {dayLabel(suggestion.day)} pela {PERIOD_LABEL[suggestion.period].toLowerCase()}.
            </p>
            <button
              type="button"
              onClick={applySuggestion}
              className="mt-1.5 rounded-md bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-amber-700"
            >
              Usar sugestão
            </button>
          </div>
        </div>
      )}

      {helperText && <p className="mt-1.5 text-[11px] text-muted-foreground">{helperText}</p>}
    </div>
  );
}
