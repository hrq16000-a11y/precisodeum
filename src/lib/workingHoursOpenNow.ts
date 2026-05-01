/**
 * workingHoursOpenNow — função pura para determinar se um prestador está
 * "aberto agora" a partir do `working_hours_struct`.
 *
 * Suporta faixas que cruzam meia-noite (ex.: 22:00–06:00) computando
 * corretamente a faixa "vinda de ontem".
 *
 * Vazio/null → consideramos "sob agendamento" (NÃO conta como aberto).
 */
import type { WorkingHoursStruct, WeekdayKey } from '@/components/onboarding/wizard/phases/v2/workingHours';

const JS_TO_KEY: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const toMin = (hhmm: string): number => {
  if (hhmm === '24:00') return 1440;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Retorna true se o prestador está aberto no momento `now`. Default: agora.
 * Estruturas vazias retornam `false` (sob agendamento não é "aberto").
 */
export function isOpenNow(struct: WorkingHoursStruct | null | undefined, now: Date = new Date()): boolean {
  if (!struct || !Array.isArray(struct.ranges) || struct.ranges.length === 0) return false;

  const todayKey = JS_TO_KEY[now.getDay()];
  const yesterdayKey = JS_TO_KEY[(now.getDay() + 6) % 7];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const r of struct.ranges) {
    if (!r.days || r.days.length === 0) continue;
    const startM = toMin(r.start);
    const endM = r.end === '24:00' ? 1440 : toMin(r.end);
    const full24 = r.start === '00:00' && (r.end === '00:00' || r.end === '24:00');

    if (full24) {
      if (r.days.includes(todayKey)) return true;
      continue;
    }
    if (endM > startM) {
      // mesma data
      if (r.days.includes(todayKey) && nowMin >= startM && nowMin < endM) return true;
    } else if (endM < startM) {
      // cruza meia-noite
      if (r.days.includes(todayKey) && nowMin >= startM) return true;
      if (r.days.includes(yesterdayKey) && nowMin < endM) return true;
    }
  }
  return false;
}
