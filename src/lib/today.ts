import { todayIn } from "@/domain/dates";
import { APP_TIME_ZONE } from "@/i18n/config";

/** Today's date (ISO) in the hospital's time zone (Africa/Cairo, single hospital A1). */
export function hospitalToday(): string {
  return todayIn(APP_TIME_ZONE);
}
