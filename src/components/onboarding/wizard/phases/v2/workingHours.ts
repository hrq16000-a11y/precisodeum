/**
 * Working Hours — modelo estruturado estilo Google Meu Negócio.
 *
 * Modelo público (jsonb persistido em providers.working_hours_struct e
 * services.working_hours_struct):
 *
 *   { ranges: [ { days: ["mon","tue",...], start: "08:00", end: "18:00" } ] }
 *
 * Convenções:
 *  - "00:00" → "00:00" representa 24 horas.
 *  - end < start indica faixa que cruza meia-noite (ex.: 22:00 → 06:00).
 *  - Sem texto livre — todos os valores vêm de seleções controladas.
 *
 * Filtros derivados (calculados no DB por trigger):
 *  - opens_weekend: tem sat/sun
 *  - opens_late_night: alguma faixa após 20:00
 *  - opens_overnight: alguma faixa em 00:00–06:00 ou cruzando meia-noite
 *  - is_24h: cobertura completa em algum dia
 */

export const WEEKDAY_OPTIONS = [
  'Seg',
  'Ter',
  'Qua',
  'Qui',
  'Sex',
  'Sáb',
  'Dom',
] as const;

export type WeekdayOption = (typeof WEEKDAY_OPTIONS)[number];

export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

const KEY_BY_LABEL: Record<WeekdayOption, WeekdayKey> = {
  Seg: 'mon', Ter: 'tue', Qua: 'wed', Qui: 'thu',
  Sex: 'fri', Sáb: 'sat', Dom: 'sun',
};
const LABEL_BY_KEY: Record<WeekdayKey, WeekdayOption> = {
  mon: 'Seg', tue: 'Ter', wed: 'Qua', thu: 'Qui',
  fri: 'Sex', sat: 'Sáb', sun: 'Dom',
};
const KEY_ORDER: Record<WeekdayKey, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
};

export function labelToKey(label: string): WeekdayKey | null {
  return (KEY_BY_LABEL as Record<string, WeekdayKey>)[label] ?? null;
}
export function keyToLabel(key: WeekdayKey): WeekdayOption {
  return LABEL_BY_KEY[key];
}

export interface WorkingHoursRange {
  days: WeekdayKey[];
  /** "HH:MM" 00:00–23:30 (passo 30 min). */
  start: string;
  /** "HH:MM" 00:00–24:00 ("00:00" = 24h quando start também 00:00). */
  end: string;
}
export interface WorkingHoursStruct {
  ranges: WorkingHoursRange[];
}

/* ─── Helpers ─── */

export function makeEmptyStruct(): WorkingHoursStruct {
  return { ranges: [] };
}

const sortDays = (days: WeekdayKey[]) => [...new Set(days)].sort((a, b) => KEY_ORDER[a] - KEY_ORDER[b]);

/** Agrupa dias contíguos em ranges legíveis: ["mon","tue","wed"] → "Seg–Qua" */
function formatDays(days: WeekdayKey[]): string {
  const sorted = sortDays(days);
  if (sorted.length === 0) return '';
  if (sorted.length === 7) return 'Todos os dias';
  // weekend short
  if (sorted.length === 2 && sorted[0] === 'sat' && sorted[1] === 'sun') return 'Fim de semana';
  if (sorted.length === 5 && sorted.every((d, i) => d === KEY_ORDER && false)) {
    // unreachable, kept for clarity
  }
  if (
    sorted.length === 5 &&
    ['mon', 'tue', 'wed', 'thu', 'fri'].every((d) => sorted.includes(d as WeekdayKey))
  ) return 'Seg–Sex';

  const groups: WeekdayKey[][] = [];
  let cur: WeekdayKey[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    if (KEY_ORDER[next] === KEY_ORDER[prev] + 1) cur.push(next);
    else { groups.push(cur); cur = [next]; }
  }
  groups.push(cur);
  return groups
    .map((g) => g.length === 1 ? keyToLabel(g[0]) : `${keyToLabel(g[0])}–${keyToLabel(g[g.length - 1])}`)
    .join(', ');
}

function formatHours(start: string, end: string): string {
  if (start === '00:00' && (end === '00:00' || end === '24:00')) return '24 horas';
  return `${start} às ${end}`;
}

export function formatRange(r: WorkingHoursRange): string {
  const days = formatDays(r.days);
  const hours = formatHours(r.start, r.end);
  if (!days && !hours) return '';
  if (!days) return hours;
  if (!hours) return days;
  return `${days} • ${hours}`;
}

export function formatStruct(struct: WorkingHoursStruct | null | undefined): string {
  if (!struct || !Array.isArray(struct.ranges) || struct.ranges.length === 0) return '';
  return struct.ranges.map(formatRange).filter(Boolean).join(' / ');
}

/* ─── Presets ─── */

export interface WorkingHoursPreset {
  id: string;
  label: string;
  description?: string;
  build: () => WorkingHoursStruct;
}

const weekdays: WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
const weekends: WeekdayKey[] = ['sat', 'sun'];
const allDays: WeekdayKey[] = [...weekdays, ...weekends];

export const WORKING_HOURS_PRESETS: WorkingHoursPreset[] = [
  {
    id: 'commercial',
    label: 'Comercial (Seg–Sex 08–18h)',
    description: 'Padrão para escritórios e prestação de serviços diurna.',
    build: () => ({ ranges: [{ days: weekdays, start: '08:00', end: '18:00' }] }),
  },
  {
    id: 'commercial_sat',
    label: 'Comercial + Sábado (Seg–Sáb 08–18h)',
    description: 'Inclui sábado meio-período.',
    build: () => ({
      ranges: [
        { days: weekdays, start: '08:00', end: '18:00' },
        { days: ['sat'], start: '08:00', end: '13:00' },
      ],
    }),
  },
  {
    id: 'extended',
    label: 'Estendido (Seg–Sex 08–22h)',
    description: 'Atendimento até a noite em dias de semana.',
    build: () => ({ ranges: [{ days: weekdays, start: '08:00', end: '22:00' }] }),
  },
  {
    id: 'weekend',
    label: 'Apenas fim de semana (10–18h)',
    description: 'Foco em sábado e domingo.',
    build: () => ({ ranges: [{ days: weekends, start: '10:00', end: '18:00' }] }),
  },
  {
    id: 'always',
    label: '24 horas — todos os dias',
    description: 'Plantão / emergência 24/7.',
    build: () => ({ ranges: [{ days: allDays, start: '00:00', end: '00:00' }] }),
  },
  {
    id: 'on_demand',
    label: 'Sob agendamento',
    description: 'Sem horário fixo. Atendimento por agendamento prévio.',
    build: () => ({ ranges: [] }),
  },
];

export function applyPreset(presetId: string): WorkingHoursStruct {
  const p = WORKING_HOURS_PRESETS.find((x) => x.id === presetId);
  return p ? p.build() : makeEmptyStruct();
}

/** Detecta qual preset o struct atual representa (para destacar na UI). */
export function detectPreset(struct: WorkingHoursStruct | null | undefined): string | null {
  if (!struct || struct.ranges.length === 0) return 'on_demand';
  const json = JSON.stringify({
    ranges: struct.ranges.map((r) => ({ days: sortDays(r.days), start: r.start, end: r.end })),
  });
  for (const p of WORKING_HOURS_PRESETS) {
    const built = p.build();
    const builtJson = JSON.stringify({
      ranges: built.ranges.map((r) => ({ days: sortDays(r.days), start: r.start, end: r.end })),
    });
    if (json === builtJson) return p.id;
  }
  return null;
}

/* ─── Time options 00:00–23:30 step 30 ─── */
export const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
})();

/** Para o select de fim, incluímos também "24:00". */
export const TIME_OPTIONS_END: string[] = [...TIME_OPTIONS, '24:00'];

/* ─── Compatibilidade com legado (string livre) ─── */

/**
 * Constrói o resumo legível (gravado em working_hours TEXT) a partir
 * do struct + dias antigos. Mantém compatibilidade com chamadas existentes.
 */
export function buildWorkingHoursSummary(
  hoursOrStruct: string | WorkingHoursStruct | null | undefined,
  legacyDays: string[] = [],
): string {
  if (hoursOrStruct && typeof hoursOrStruct === 'object' && 'ranges' in hoursOrStruct) {
    return formatStruct(hoursOrStruct);
  }
  // Legado: string livre + lista de dias em PT (Seg, Ter, ...).
  const cleanDays = (legacyDays || []).map((d) => d.trim()).filter(Boolean);
  const cleanHours = (typeof hoursOrStruct === 'string' ? hoursOrStruct : '').trim();
  if (cleanDays.length && cleanHours) return `${cleanDays.join(', ')} • ${cleanHours}`;
  if (cleanDays.length) return cleanDays.join(', ');
  return cleanHours;
}

/**
 * Tenta migrar um valor legado (texto livre + lista de dias PT) para struct.
 * Heurística simples: detecta "24 horas", "Comercial", presets nomeados.
 * Não é perfeita — apenas preenche um struct razoável para evitar dado vazio.
 */
export function legacyToStruct(
  hoursText: string | null | undefined,
  legacyDays: string[] | null | undefined,
): WorkingHoursStruct | null {
  const txt = (hoursText || '').toLowerCase().trim();
  if (!txt && (!legacyDays || legacyDays.length === 0)) return null;

  if (/24\s*h/.test(txt)) return applyPreset('always');
  if (/comercial/.test(txt) && /s[áa]b/.test(txt)) return applyPreset('commercial_sat');
  if (/comercial/.test(txt)) return applyPreset('commercial');
  if (/fim\s*de\s*semana/.test(txt) || /finais\s*de\s*semana/.test(txt)) return applyPreset('weekend');
  if (/agendamento/.test(txt)) return applyPreset('on_demand');

  // Fallback: tenta extrair "08h às 18h" / "08:00-18:00"
  const m = txt.match(/(\d{1,2})[h:]?(\d{2})?\D+(\d{1,2})[h:]?(\d{2})?/);
  if (m && legacyDays && legacyDays.length > 0) {
    const start = `${String(+m[1]).padStart(2, '0')}:${m[2] || '00'}`;
    const end = `${String(+m[3]).padStart(2, '0')}:${m[4] || '00'}`;
    const days = legacyDays.map(labelToKey).filter(Boolean) as WeekdayKey[];
    if (days.length > 0) return { ranges: [{ days, start, end }] };
  }
  return null;
}
