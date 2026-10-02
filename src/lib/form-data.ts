/** Single-valued FormData → plain object for Zod. Next.js internal "$ACTION_*" keys are dropped. */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION") || typeof value !== "string") continue;
    result[key] = value;
  }
  return result;
}
