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

/* ─── Validação de faixas (anti-conflito dia × hora) ─── */

export const MAX_RANGES = 3;

/** Converte "HH:MM" em minutos absolutos a partir de 00:00. "24:00" = 1440. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Expande uma faixa em pares (dayKey, [startMin, endMin)). Se a faixa cruza
 * meia-noite (end < start), divide em (start..1440) no dia D + (0..end) no
 * dia D+1. Se end === "00:00" e start === "00:00" → 24h (0..1440).
 */
function expandRangeToDayMinutes(r: WorkingHoursRange): Array<{ day: WeekdayKey; from: number; to: number }> {
  const out: Array<{ day: WeekdayKey; from: number; to: number }> = [];
  const startM = toMinutes(r.start);
  const endRaw = r.end === '24:00' ? 1440 : toMinutes(r.end);
  const is24 = r.start === '00:00' && (r.end === '00:00' || r.end === '24:00');
  const days = sortDaysInternal(r.days);
  for (const d of days) {
    if (is24) {
      out.push({ day: d, from: 0, to: 1440 });
    } else if (endRaw > startM) {
      out.push({ day: d, from: startM, to: endRaw });
    } else if (endRaw < startM) {
      // Cruza meia-noite
      out.push({ day: d, from: startM, to: 1440 });
      const nextDay = nextDayKey(d);
      out.push({ day: nextDay, from: 0, to: endRaw });
    }
    // endRaw === startM e não é 24h → faixa vazia, ignora
  }
  return out;
}

function sortDaysInternal(days: WeekdayKey[]): WeekdayKey[] {
  return [...new Set(days)].sort((a, b) => KEY_ORDER[a] - KEY_ORDER[b]);
}

function nextDayKey(d: WeekdayKey): WeekdayKey {
  const order: WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const idx = order.indexOf(d);
  return order[(idx + 1) % 7];
}

export interface RangeValidationIssue {
  /** Índice da faixa que apresenta o problema (a "nova" / segunda em conflito). */
  index: number;
  /** Índice da faixa pré-existente em conflito (quando aplicável). */
  conflictsWith?: number;
  type: 'empty_days' | 'empty_hours' | 'overlap' | 'duplicate' | 'too_many';
  message: string;
}

/**
 * Valida o struct inteiro:
 * - Máximo 3 faixas.
 * - Cada faixa precisa ter ao menos 1 dia e horas válidas.
 * - Faixas não podem se sobrepor: para cada par (faixa A, faixa B), não pode
 *   existir um dia em comum com janela horária que se intersecciona.
 *   "Diferentes em dia OU em hora" é o critério aceitável.
 */
export function validateStruct(struct: WorkingHoursStruct | null | undefined): RangeValidationIssue[] {
  const issues: RangeValidationIssue[] = [];
  if (!struct || !Array.isArray(struct.ranges)) return issues;
  const ranges = struct.ranges;

  if (ranges.length > MAX_RANGES) {
    issues.push({
      index: MAX_RANGES,
      type: 'too_many',
      message: `Máximo ${MAX_RANGES} faixas. Remova alguma para adicionar outra.`,
    });
  }

  // Valida individualmente
  ranges.forEach((r, i) => {
    if (!r.days || r.days.length === 0) {
      issues.push({ index: i, type: 'empty_days', message: `Faixa ${i + 1}: selecione pelo menos um dia.` });
    }
    const startM = toMinutes(r.start);
    const endRaw = r.end === '24:00' ? 1440 : toMinutes(r.end);
    const is24 = r.start === '00:00' && (r.end === '00:00' || r.end === '24:00');
    if (!is24 && startM === endRaw) {
      issues.push({ index: i, type: 'empty_hours', message: `Faixa ${i + 1}: início e fim iguais.` });
    }
  });

  // Valida sobreposição entre pares
  const expanded = ranges.map(expandRangeToDayMinutes);
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      // Duplicata exata?
      if (
        JSON.stringify({ d: sortDaysInternal(ranges[i].days), s: ranges[i].start, e: ranges[i].end }) ===
        JSON.stringify({ d: sortDaysInternal(ranges[j].days), s: ranges[j].start, e: ranges[j].end })
      ) {
        issues.push({
          index: j,
          conflictsWith: i,
          type: 'duplicate',
          message: `Faixa ${j + 1} é igual à faixa ${i + 1}. Diferencie por dia ou por horário.`,
        });
        continue;
      }
      // Sobreposição (mesmo dia + janela com interseção)
      const a = expanded[i];
      const b = expanded[j];
      let overlap = false;
      for (const segA of a) {
        for (const segB of b) {
          if (segA.day !== segB.day) continue;
          const inter = Math.min(segA.to, segB.to) - Math.max(segA.from, segB.from);
          if (inter > 0) { overlap = true; break; }
        }
        if (overlap) break;
      }
      if (overlap) {
        issues.push({
          index: j,
          conflictsWith: i,
          type: 'overlap',
          message: `Faixa ${j + 1} sobrepõe a faixa ${i + 1} (mesmo dia em horários que se cruzam). Ajuste o dia ou o horário.`,
        });
      }
    }
  }

  return issues;
}

export function isStructValid(struct: WorkingHoursStruct | null | undefined): boolean {
  return validateStruct(struct).length === 0;
}

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
