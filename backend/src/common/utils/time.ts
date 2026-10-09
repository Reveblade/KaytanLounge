export const ISTANBUL_TZ = 'Europe/Istanbul';

/** Offset of `tz` from UTC at the given instant, in minutes. */
export function timezoneOffsetMinutes(date: Date, tz = ISTANBUL_TZ): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** "2026-09-14" + "09:00" in Istanbul → the UTC instant. */
export function istanbulLocalToDate(day: string, time: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offset = timezoneOffsetMinutes(guess);
  return new Date(guess.getTime() - offset * 60_000);
}

/** Start of the Istanbul calendar day containing `date`, as a UTC instant. */
export function startOfIstanbulDay(date: Date): Date {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: ISTANBUL_TZ }).format(date);
  return istanbulLocalToDate(day, '00:00');
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
