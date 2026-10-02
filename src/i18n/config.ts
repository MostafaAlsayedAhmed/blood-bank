/** Locale settings shared by the i18n request config, the root layout and the language switcher. */
export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

// Open Question O6 (recommended answer applied): Arabic is the default, English available.
export const DEFAULT_LOCALE: Locale = "ar";
export const RTL_LOCALES: ReadonlySet<string> = new Set(["ar"]);
export const APP_TIME_ZONE = "Africa/Cairo";

/** Cookie holding the viewer's language choice. Not personal data; no URL locale prefix. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
