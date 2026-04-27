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

export function buildWorkingHoursSummary(hours: string, days: string[] = []): string {
  const cleanDays = days.map((day) => day.trim()).filter(Boolean);
  const cleanHours = hours.trim();

  if (cleanDays.length && cleanHours) {
    return `${cleanDays.join(', ')} • ${cleanHours}`;
  }

  if (cleanDays.length) {
    return cleanDays.join(', ');
  }

  return cleanHours;
}