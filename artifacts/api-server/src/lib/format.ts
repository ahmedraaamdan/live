/** Server-side formatting for emails; the app has its own copy in its locale. */
import { formatEGP } from "@workspace/live-core";

const TZ = "Africa/Cairo";

const dateTime = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: TZ,
});

export const fmtDateTime = (d: Date | string) => dateTime.format(new Date(d));
export const fmtMoney = formatEGP;

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} دقيقة`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hours = h === 1 ? "ساعة" : h === 2 ? "ساعتين" : `${h} ساعات`;
  return m ? `${hours} و${m} دقيقة` : hours;
}
