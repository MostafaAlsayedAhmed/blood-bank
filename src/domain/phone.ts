import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/**
 * Normalizes an Egyptian mobile number to E.164 (+20…), or returns null.
 * Assumption A5 / Open Question O11: only Egyptian mobile numbers are accepted.
 * Accepts local (010…), national (10…) and international (+20…, 0020…) input.
 */
export function normalizeEgyptianMobile(input: string): string | null {
  const cleaned = input.trim().replace(/^00/, "+");
  if (!cleaned) return null;
  const parsed = parsePhoneNumberFromString(cleaned, "EG");
  if (!parsed || parsed.country !== "EG" || !parsed.isValid()) return null;
  const type = parsed.getType();
  if (type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") return null;
  return parsed.number;
}

/**
 * Masks an E.164 number for lists and non-privileged views (spec §11):
 * keeps the Egyptian country code and the last two digits, e.g. "+20 ••••••••12".
 */
export function maskPhone(e164: string): string {
  const national = e164.startsWith("+20") ? e164.slice(3) : e164.replace(/\D/g, "");
  const prefix = e164.startsWith("+20") ? "+20 " : "";
  return `${prefix}${"•".repeat(Math.max(national.length - 2, 0))}${national.slice(-2)}`;
}

/** Readable international format for an authorized reveal, e.g. "+20 10 0000 0012". */
export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
