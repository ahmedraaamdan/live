/** Calendar dates are explicitly Cairo dates, independent of the device timezone. */
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function parts(date: Date) { return Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value])); }
export function toCairoInput(date: Date) { const p = parts(date); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; }
export const cairoDay = (date = new Date()) => toCairoInput(date).slice(0, 10);
export function addCalendarDays(day: string, count: number) { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10); }
export function fromCairoInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const desired = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  let instant = desired;
  for (let i = 0; i < 4; i++) {
    const p = parts(new Date(instant));
    const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    instant += desired - local;
  }
  const date = new Date(instant);
  return Number.isFinite(instant) && toCairoInput(date) === value ? date : null;
}
export const cairoSlot = (day: string, hour: number) => fromCairoInput(`${day}T${String(hour).padStart(2, '0')}:00`)!;
export function cairoWeekStart(day: string) { const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); return addCalendarDays(day, -((weekday + 1) % 7)); }
