/**
 * WorkingHoursDisplay — bloco legível para perfis públicos a partir de
 * `working_hours_struct` (jsonb). Lê dias + faixas, agrupa visualmente e
 * exibe badges de cobertura: "Aberto agora", "24h", "Atende fim de semana",
 * "Atende noite", "Atende madrugada", "Sob agendamento".
 *
 * Não depende do banco — todo o cálculo é client-side a partir do struct
 * bruto. Quando o struct é nulo/vazio, exibe "Sob agendamento" (regra
 * combinada com o WorkingHoursPicker).
 */
import { Clock, CalendarCheck, Sunrise, Moon, Sparkles, BadgeCheck } from 'lucide-react';
import {
  formatStruct,
  type WorkingHoursStruct,
  type WeekdayKey,
} from '@/components/onboarding/wizard/phases/v2/workingHours';

interface Props {
  /** JSONB persistido em providers.working_hours_struct. Aceita null. */
  struct: WorkingHoursStruct | null | undefined;
  /** Texto livre legado (providers.working_hours). Usado como fallback. */
  legacyText?: string | null;
  className?: string;
}

const DAY_LABEL: Record<WeekdayKey, string> = {
  mon: 'Segunda', tue: 'Terça', wed: 'Quarta', thu: 'Quinta',
  fri: 'Sexta', sat: 'Sábado', sun: 'Domingo',
};

const WEEKDAY_ORDER: WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface DerivedFlags {
  isOpenNow: boolean;
  is24h: boolean;
  opensWeekend: boolean;
  opensLateNight: boolean;   // após 20:00
  opensOvernight: boolean;   // 00:00–06:00 ou cruza meia-noite
  onDemand: boolean;
}

const toMin = (hhmm: string): number => {
  if (hhmm === '24:00') return 1440;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

function deriveFlags(struct: WorkingHoursStruct | null | undefined): DerivedFlags {
  const empty = !struct || !Array.isArray(struct.ranges) || struct.ranges.length === 0;
  if (empty) {
    return {
      isOpenNow: false,
      is24h: false,
      opensWeekend: false,
      opensLateNight: false,
      opensOvernight: false,
      onDemand: true,
    };
  }
  const now = new Date();
  // Date.getDay(): 0=Dom, 1=Seg, …
  const jsToKey: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayKey = jsToKey[now.getDay()];
  const yesterdayKey = jsToKey[(now.getDay() + 6) % 7];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  let isOpenNow = false;
  let is24h = false;
  let opensWeekend = false;
  let opensLateNight = false;
  let opensOvernight = false;

  for (const r of struct.ranges) {
    if (!r.days || r.days.length === 0) continue;
    const startM = toMin(r.start);
    const endM = r.end === '24:00' ? 1440 : toMin(r.end);
    const full24 = r.start === '00:00' && (r.end === '00:00' || r.end === '24:00');

    if (full24) {
      is24h = true;
      opensLateNight = true;
      opensOvernight = true;
    } else {
      if (endM > 20 * 60 || startM > 20 * 60) opensLateNight = true;
      if ((startM < 6 * 60) || endM < startM) opensOvernight = true;
    }

    if (r.days.includes('sat') || r.days.includes('sun')) opensWeekend = true;

    // Aberto agora
    if (full24 && r.days.includes(todayKey)) {
      isOpenNow = true;
    } else if (endM > startM) {
      // Mesmo dia
      if (r.days.includes(todayKey) && nowMin >= startM && nowMin < endM) isOpenNow = true;
    } else if (endM < startM) {
      // Cruza meia-noite — abre hoje (após startM) ou hoje (antes de endM, vindo de ontem)
      if (r.days.includes(todayKey) && nowMin >= startM) isOpenNow = true;
      if (r.days.includes(yesterdayKey) && nowMin < endM) isOpenNow = true;
    }
  }

  return {
    isOpenNow,
    is24h,
    opensWeekend,
    opensLateNight,
    opensOvernight,
    onDemand: false,
  };
}

interface DayRow {
  key: WeekdayKey;
  ranges: Array<{ start: string; end: string }>;
}

function buildPerDay(struct: WorkingHoursStruct): DayRow[] {
  const map: Record<WeekdayKey, Array<{ start: string; end: string }>> = {
    mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
  };
  for (const r of struct.ranges) {
    if (!r.days) continue;
    for (const d of r.days) {
      map[d].push({ start: r.start, end: r.end });
    }
  }
  return WEEKDAY_ORDER.map((k) => ({ key: k, ranges: map[k] }));
}

const fmtHours = (start: string, end: string) => {
  if (start === '00:00' && (end === '00:00' || end === '24:00')) return '24 horas';
  return `${start} às ${end}`;
};

export const WorkingHoursDisplay = ({ struct, legacyText, className }: Props) => {
  const hasStruct = !!struct && Array.isArray(struct.ranges) && struct.ranges.length > 0;
  const flags = deriveFlags(struct);
  const summary = hasStruct ? formatStruct(struct as WorkingHoursStruct) : '';
  const perDay = hasStruct ? buildPerDay(struct as WorkingHoursStruct) : [];

  // Se nem struct nem texto legado, exibe sob agendamento.
  if (!hasStruct && !legacyText) {
    return (
      <div className={`rounded-xl border border-border bg-card p-3 ${className || ''}`}>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent" />
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Horário</p>
        </div>
        <p className="mt-1.5 text-sm text-foreground">Atendimento sob agendamento</p>
        <p className="text-[11px] text-muted-foreground">Combine direto via WhatsApp.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-card p-3 ${className || ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent" />
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Horário de atendimento</p>
        </div>
        {flags.isOpenNow && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <BadgeCheck className="h-3 w-3" /> Aberto agora
          </span>
        )}
      </div>

      {/* Resumo curto */}
      {summary && (
        <p className="mt-1.5 text-sm font-medium text-foreground" style={{ wordBreak: 'break-word' }}>
          {summary}
        </p>
      )}
      {!summary && legacyText && (
        <p className="mt-1.5 text-sm text-foreground">{legacyText}</p>
      )}

      {/* Tabela por dia (visível quando há struct) */}
      {hasStruct && perDay.length > 0 && (
        <ul className="mt-2 grid grid-cols-1 gap-0.5 text-[12px]">
          {perDay.map((row) => (
            <li
              key={row.key}
              className="flex items-baseline justify-between gap-2 border-b border-border/40 py-1 last:border-b-0"
            >
              <span className="font-medium text-muted-foreground">{DAY_LABEL[row.key]}</span>
              {row.ranges.length === 0 ? (
                <span className="text-[11px] text-muted-foreground/70">Fechado</span>
              ) : (
                <span className="text-right text-foreground" style={{ wordBreak: 'break-word' }}>
                  {row.ranges.map((r, i) => (
                    <span key={i}>
                      {i > 0 && <span className="mx-1 text-muted-foreground/60">•</span>}
                      {fmtHours(r.start, r.end)}
                    </span>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Badges de cobertura */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {flags.is24h && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-medium text-amber-700 dark:text-amber-300">
            <Sparkles className="h-3 w-3" /> 24 horas
          </span>
        )}
        {flags.opensWeekend && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10.5px] font-medium text-violet-700 dark:text-violet-300">
            <CalendarCheck className="h-3 w-3" /> Atende fim de semana
          </span>
        )}
        {flags.opensLateNight && !flags.is24h && (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10.5px] font-medium text-indigo-700 dark:text-indigo-300">
            <Moon className="h-3 w-3" /> Atende noite (após 20h)
          </span>
        )}
        {flags.opensOvernight && !flags.is24h && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-[10.5px] font-medium text-slate-700 dark:text-slate-300">
            <Sunrise className="h-3 w-3" /> Atende madrugada
          </span>
        )}
      </div>
    </div>
  );
};

export default WorkingHoursDisplay;
