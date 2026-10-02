import { useFormatter } from "next-intl";

/**
 * Renders an ISO date ("YYYY-MM-DD", shown as-is in UTC so it never shifts a day)
 * or an ISO timestamp (shown in the hospital time zone). Works in server and client components.
 */
export function DateText({ value, withTime = false }: { value: string; withTime?: boolean }) {
  const format = useFormatter();
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(isDateOnly ? `${value}T00:00:00Z` : value);
  const text = isDateOnly
    ? format.dateTime(date, { dateStyle: "medium", timeZone: "UTC" })
    : format.dateTime(date, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
  return <time dateTime={value}>{text}</time>;
}
