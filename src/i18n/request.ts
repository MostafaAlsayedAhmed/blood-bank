import { getRequestConfig } from "next-intl/server";
import { APP_TIME_ZONE, DEFAULT_LOCALE } from "@/i18n/config";

/**
 * Phase 1: English only, without locale routing (Assumption A2).
 * All UI strings already live in messages/<locale>.json, so adding Arabic
 * (Open Question O6) is a content + routing change, not a UI rewrite.
 */
export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  return {
    locale,
    timeZone: APP_TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
