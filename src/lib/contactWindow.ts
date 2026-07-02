/**
 * Disponibilidade & janelas de contato em leads.
 *
 * Períodos canônicos (espelham `compute_lead_preferred_match`/`suggest_next_contact_slot` no DB):
 *   - morning:   08h–12h
 *   - afternoon: 12h–18h
 *   - evening:   18h–21h
 *
 * Dias: 0 = domingo … 6 = sábado (compatível com Date#getDay e EXTRACT(DOW)).
 */

export type ContactPeriod = 'morning' | 'afternoon' | 'evening';

export interface ContactHours {
  /** Dias da semana aceitos. Padrão: seg–sáb. */
  days: number[];
  /** Períodos do dia aceitos. */
  periods: ContactPeriod[];
  /** IANA timezone. Padrão: America/Sao_Paulo. */
  timezone: string;
}

export interface PreferredWindow {
  /** Dia da semana (0..6). */
  day: number;
  /** Período preferido. */
  period: ContactPeriod;
  /** ISO date opcional ("2026-05-04"). */
  iso_date?: string | null;
  /** Quando o cliente declarou a preferência. */
  requested_at?: string;
}

export const DEFAULT_CONTACT_HOURS: ContactHours = {
  days: [1, 2, 3, 4, 5, 6],
  periods: ['morning', 'afternoon'],
  timezone: 'America/Sao_Paulo',
};

export const PERIOD_LABEL: Record<ContactPeriod, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
};

export const PERIOD_HINT: Record<ContactPeriod, string> = {
  morning: '08h–12h',
  afternoon: '12h–18h',
  evening: '18h–21h',
};

const PERIOD_ORDER: ContactPeriod[] = ['morning', 'afternoon', 'evening'];

const DAY_LABEL_LONG = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

const DAY_LABEL_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function dayLabel(day: number, short = false): string {
  if (day < 0 || day > 6 || !Number.isFinite(day)) return '';
  return (short ? DAY_LABEL_SHORT : DAY_LABEL_LONG)[day] ?? '';
}

/** Normaliza qualquer valor recebido do banco em uma estrutura segura. */
export function normalizeContactHours(raw: unknown): ContactHours {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONTACT_HOURS };
  const obj = raw as Record<string, unknown>;
  const days = Array.isArray(obj.days)
    ? Array.from(
        new Set(
          (obj.days as unknown[])
            .map((d) => Number(d))
            .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        ),
      ).sort((a, b) => a - b)
    : [...DEFAULT_CONTACT_HOURS.days];
  const periods = Array.isArray(obj.periods)
    ? Array.from(
        new Set(
          (obj.periods as unknown[]).filter((p): p is ContactPeriod =>
            PERIOD_ORDER.includes(p as ContactPeriod),
          ),
        ),
      )
    : [...DEFAULT_CONTACT_HOURS.periods];
  const timezone =
    typeof obj.timezone === 'string' && obj.timezone.length > 0
      ? obj.timezone
      : DEFAULT_CONTACT_HOURS.timezone;
  return { days, periods, timezone };
}

/** Verifica se a janela do cliente cabe dentro do horário do prestador. */
export function matchesContactHours(
  hours: ContactHours,
  pref: PreferredWindow | null | undefined,
): 'match' | 'mismatch' | 'unspecified' {
  if (!pref || !PERIOD_ORDER.includes(pref.period) || !Number.isInteger(pref.day)) {
    return 'unspecified';
  }
  if (pref.day < 0 || pref.day > 6) return 'unspecified';
  const ok = hours.days.includes(pref.day) && hours.periods.includes(pref.period);
  return ok ? 'match' : 'mismatch';
}

/**
 * Sugere o próximo slot do prestador a partir de `from`, respeitando o fuso configurado.
 * Espelha `suggest_next_contact_slot` no DB (até 14 dias à frente).
 */
export function suggestNextSlot(
  hours: ContactHours,
  from: Date = new Date(),
): { day: number; period: ContactPeriod; isoDate: string } | null {
  if (hours.days.length === 0 || hours.periods.length === 0) return null;

  // Hora local no fuso do prestador (com fallback no fuso do navegador).
  const tz = hours.timezone || DEFAULT_CONTACT_HOURS.timezone;
  let localHour = from.getHours();
  let baseYear = from.getFullYear();
  let baseMonth = from.getMonth();
  let baseDay = from.getDate();
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(from);
    const get = (t: string) => parts.find((p) => p.type === t)?.value;
    baseYear = Number(get('year')) || baseYear;
    baseMonth = (Number(get('month')) || 1) - 1;
    baseDay = Number(get('day')) || baseDay;
    localHour = Number(get('hour'));
    if (!Number.isFinite(localHour)) localHour = from.getHours();
  } catch {
    /* fallback to local time */
  }

  let todayMinIdx = 0;
  if (localHour >= 21) todayMinIdx = 3;
  else if (localHour >= 18) todayMinIdx = 2;
  else if (localHour >= 12) todayMinIdx = 1;

  for (let offset = 0; offset <= 14; offset += 1) {
    const candidate = new Date(baseYear, baseMonth, baseDay + offset);
    const dow = candidate.getDay();
    if (!hours.days.includes(dow)) continue;
    for (let pIdx = 0; pIdx < PERIOD_ORDER.length; pIdx += 1) {
      if (offset === 0 && pIdx < todayMinIdx) continue;
      const period = PERIOD_ORDER[pIdx];
      if (!hours.periods.includes(period)) continue;
      const yyyy = candidate.getFullYear();
      const mm = String(candidate.getMonth() + 1).padStart(2, '0');
      const dd = String(candidate.getDate()).padStart(2, '0');
      return { day: dow, period, isoDate: `${yyyy}-${mm}-${dd}` };
    }
  }
  return null;
}

/** Texto curto pronto para UI: "Hoje (qua) à tarde" / "Sábado pela manhã". */
export function formatPreferredWindow(
  pref: PreferredWindow | null | undefined,
  now: Date = new Date(),
): string {
  if (!pref || !PERIOD_ORDER.includes(pref.period)) return '';
  const period = PERIOD_LABEL[pref.period].toLowerCase();
  if (pref.iso_date) {
    const target = new Date(`${pref.iso_date}T12:00:00`);
    if (!Number.isNaN(target.getTime())) {
      const diffDays = Math.round(
        (target.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) /
          (24 * 60 * 60 * 1000),
      );
      if (diffDays === 0) return `Hoje pela ${period}`;
      if (diffDays === 1) return `Amanhã pela ${period}`;
      if (diffDays === 2) return `Depois de amanhã pela ${period}`;
    }
  }
  return `${dayLabel(pref.day)} pela ${period}`;
}
