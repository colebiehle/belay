/**
 * The date formats every page shares, in one place so a date reads the same way on a
 * card, in a log and in a tooltip (STYLE_GUIDE 5.7). A plain module, so server pages
 * (Home) and client components can both import it.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Local midnight, so two times on the same day are zero days apart. */
function dayStart(t: Date | number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Whole calendar days from `from` to `to`, by the local date. Elapsed hours floored
 * said "Oct 5 · today" for an evening entry read the next morning, and two cards both
 * dated Oct 5 read "today" and "1d ago". Counting by date makes the age agree with
 * the date printed beside it. Rounded, because a DST day is 23 or 25 hours.
 */
export function calendarDays(from: Date | number, to: Date | number = Date.now()): number {
  return Math.max(0, Math.round((dayStart(to) - dayStart(from)) / 86_400_000));
}

/** "Oct 3", or "Oct 3, 2025" outside the current year: a date inline on a card. */
export function shortDate(at: Date): string {
  const sameYear = at.getFullYear() === new Date().getFullYear();
  return at.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

/** "Oct 3 · 3d ago", "Oct 6 · today": an absolute date, then how long ago. */
export function dateAndAge(at: Date, now = Date.now()): { date: string; age: string } {
  const days = calendarDays(at, now);
  return { date: shortDate(at), age: days === 0 ? "today" : `${days}d ago` };
}

/**
 * "06 Oct": the fixed date column of a log row (History, Interviews, Notes, Coming
 * up). Built by hand rather than with a locale: en-GB writes September as "Sept",
 * four letters in a column sized for three, and en-US puts the month first.
 */
export function logDate(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
}
