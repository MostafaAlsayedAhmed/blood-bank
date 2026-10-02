/**
 * Keys that identify personal data. Used by the logger (redaction) and by the audit
 * metadata guard (rejection), so neither logs nor audit rows carry PII values.
 * Matching is case-insensitive on the key name.
 */
export const PII_KEYS: ReadonlySet<string> = new Set([
  "name",
  "fullname",
  "firstname",
  "lastname",
  "email",
  "phone",
  "phonee164",
  "mobile",
  "password",
  "token",
  "secret",
  "dateofbirth",
  "dob",
  "address",
  "note",
  "notes",
  "body",
  "ipaddress",
  "useragent",
  "patientreference",
  "mrn",
]);

export function isPiiKey(key: string): boolean {
  return PII_KEYS.has(key.toLowerCase().replace(/[_-]/g, ""));
}
