import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ContactHours,
  ContactPeriod,
  DEFAULT_CONTACT_HOURS,
  PERIOD_HINT,
  PERIOD_LABEL,
  dayLabel,
  normalizeContactHours,
} from '@/lib/contactWindow';

const DAYS: number[] = [0, 1, 2, 3, 4, 5, 6];
const PERIODS: ContactPeriod[] = ['morning', 'afternoon', 'evening'];

export interface ContactHoursEditorProps {
  providerId: string;
  className?: string;
}

/** Painel para o prestador definir dias/períodos em que aceita ser contatado. */
export function ContactHoursEditor({ providerId, className }: ContactHoursEditorProps) {
  const [hours, setHours] = useState<ContactHours>(DEFAULT_CONTACT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('providers')
        .select('contact_hours')
        .eq('id', providerId)
        .maybeSingle();
      if (!alive) return;
      setHours(normalizeContactHours((data as any)?.contact_hours));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [providerId]);

  const toggleDay = (d: number) => {
    setHours((prev) => {
      const has = prev.days.includes(d);
      const days = has ? prev.days.filter((x) => x !== d) : [...prev.days, d].sort();
      return { ...prev, days };
    });
    setDirty(true);
  };

  const togglePeriod = (p: ContactPeriod) => {
    setHours((prev) => {
      const has = prev.periods.includes(p);
      const periods = has ? prev.periods.filter((x) => x !== p) : [...prev.periods, p];
      return { ...prev, periods };
    });
    setDirty(true);
  };

  const save = async () => {
    if (hours.days.length === 0 || hours.periods.length === 0) {
      toast.error('Escolha ao menos um dia e um período.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('providers')
      .update({ contact_hours: hours as any })
      .eq('id', providerId);
    setSaving(false);
    if (error) {
      toast.error('Não foi possível salvar. Tente novamente.');
      return;
    }
    setDirty(false);
    toast.success('Janela de contato atualizada.');
  };

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      </div>
    );
  }

  return (
    <section className={className} aria-labelledby="contact-hours-title">
      <header className="mb-2">
        <h3 id="contact-hours-title" className="text-sm font-semibold text-foreground">
          Janela de contato
        </h3>
        <p className="text-xs text-muted-foreground">
          Em quais dias e períodos você aceita receber contato. Aparece para o cliente no formulário
          de pedido.
        </p>
      </header>

      <fieldset className="mt-3">
        <legend className="text-xs font-medium text-muted-foreground">Dias</legend>
        <div className="mt-1.5 grid grid-cols-7 gap-1.5">
          {DAYS.map((d) => {
            const active = hours.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                aria-pressed={active}
                className={`rounded-lg border px-1 py-2 text-[11px] font-medium transition-colors ${
                  active
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-background text-foreground hover:border-accent/40'
                }`}
              >
                {dayLabel(d, true)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className="text-xs font-medium text-muted-foreground">Períodos</legend>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {PERIODS.map((p) => {
            const active = hours.periods.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePeriod(p)}
                aria-pressed={active}
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
      </fieldset>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground shadow-xs transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar janela
        </button>
      </div>
    </section>
  );
}
