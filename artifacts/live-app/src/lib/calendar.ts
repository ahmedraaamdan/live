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
export function cairoSlot(day: string, hour: number): Date {
  if (!Number.isInteger(hour)) throw new RangeError('Calendar hour must be an integer');
  const normalizedDay = addCalendarDays(day, Math.floor(hour / 24));
  const normalizedHour = ((hour % 24) + 24) % 24;
  const wall = new Date(`${normalizedDay}T${String(normalizedHour).padStart(2, '0')}:00:00Z`);
  // Cairo's spring clock change can skip midnight. A day boundary is its first valid instant.
  for (let minute = 0; minute <= 120; minute++) {
    const input = new Date(wall.getTime() + minute * 60000).toISOString().slice(0, 16);
    const instant = fromCairoInput(input);
    if (instant) return instant;
  }
  throw new RangeError('Invalid calendar boundary');
}
export function cairoWeekStart(day: string) { const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); return addCalendarDays(day, -((weekday + 1) % 7)); }
