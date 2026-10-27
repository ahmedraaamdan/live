import { formatEGP } from '@workspace/live-core';

const TZ = 'Africa/Cairo';
// Arabic words, Latin digits: what Egyptian apps and receipts use.
const LOCALE = 'ar-EG-u-nu-latn';

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, ...opts });
const dayMonth = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = fmt({ day: 'numeric', month: 'short' });
const time = fmt({ hour: 'numeric', minute: '2-digit' });
const dateTime = fmt({ weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const money = formatEGP;
export const fmtDay = (d: string | Date) => dayMonth.format(new Date(d));
export const fmtShortDate = (d: string | Date) => shortDate.format(new Date(d));
export const fmtTime = (d: string | Date) => time.format(new Date(d));
export const fmtDateTime = (d: string | Date) => dateTime.format(new Date(d));

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} دقيقة`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hours = h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : `${h} ساعات`;
  return m ? `${hours} و${m} د` : hours;
}

export function fmtMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return 'أقل من دقيقة';
  return fmtDuration(m);
}

/** "كمان 3 ساعات", "بكرة 7:00 م", "من 5 دقيقة". */
export function fmtRelative(d: string | Date, now = Date.now()): string {
  const t = new Date(d).getTime();
  const diffMin = Math.round((t - now) / 60_000);
  const abs = Math.abs(diffMin);
  const future = diffMin >= 0;
  if (abs < 1) return 'دلوقتي';
  if (abs < 60) return future ? `كمان ${abs} دقيقة` : `من ${abs} دقيقة`;
  const hours = Math.round(abs / 60);
  if (hours < 24) {
    const h = hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : `${hours} ساعات`;
    return future ? `كمان ${h}` : `من ${h}`;
  }
  const days = Math.round(hours / 24);
  if (future && days === 1) return `بكرة ${fmtTime(d)}`;
  if (!future && days === 1) return `امبارح ${fmtTime(d)}`;
  return fmtDateTime(d);
}

/** mm:ss or h:mm:ss for a running clock. */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Value for <input type="datetime-local">, in the device's time zone. */
export function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: TZ }).format(new Date()));
  if (h < 12) return 'صباح الخير';
  if (h < 18) return 'مساء الخير';
  return 'مساء النور';
}
