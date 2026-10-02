import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { APP_TIME_ZONE, DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/config";

/**
 * Locale comes from the language-switcher cookie (no locale routing, so URLs stay
 * the same for staff bookmarks and the QR code). Falls back to Arabic.
 */
export default getRequestConfig(async () => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
  return {
    locale,
    timeZone: APP_TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
