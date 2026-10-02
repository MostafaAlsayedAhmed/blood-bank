/**
 * Calendar-date helpers. Dates are ISO "YYYY-MM-DD" strings in the hospital's
 * time zone, so "today" and ages do not shift with the server's UTC clock.
 */

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_MONTH = /^\d{4}-\d{2}$/;

/** Today's calendar date in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** True when the string is a real calendar date (rejects 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Whole years between a birth date and a reference date (both ISO). */
export function ageOn(dateOfBirth: string, onDate: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number) as [number, number, number];
  const [y, m, d] = onDate.split("-").map(Number) as [number, number, number];
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/** "YYYY-MM" → "YYYY-MM-01". */
export function monthToFirstDay(month: string): string {
  return `${month}-01`;
}

/** Date column value → ISO date string (Prisma returns @db.Date as UTC midnight). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** ISO date string → Date for a @db.Date column. */
export function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}
