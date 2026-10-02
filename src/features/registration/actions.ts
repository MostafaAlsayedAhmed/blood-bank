"use server";

import { redirect } from "next/navigation";
import { runPublicAction } from "@/server/actions/run-action";
import { registerPublicDonor } from "@/server/services/registration";
import { HONEYPOT_FIELD, registrationSchema } from "@/domain/donor/schemas";
import { formDataToObject } from "@/lib/form-data";
import { hospitalToday } from "@/lib/today";
import type { ActionResult } from "@/lib/action-result";

export type RegistrationState = (ActionResult<"accepted" | "throttled"> & { values?: Record<string, string> }) | null;

/**
 * Public registration (W1). Unauthenticated by design: the form is the only public
 * write. The response never says whether the phone number was already registered.
 */
export async function registerAction(_prev: RegistrationState, formData: FormData): Promise<RegistrationState> {
  const raw = formDataToObject(formData);

  // Honeypot filled: behave exactly like success, store nothing.
  if (raw[HONEYPOT_FIELD]) redirect("/register/thanks");

  const result = await runPublicAction(
    { schema: registrationSchema(hospitalToday()), handler: registerPublicDonor },
    raw,
  );

  if (result.ok && result.data === "accepted") redirect("/register/thanks");
  // Echo back only what the user typed, so the form can be corrected without retyping.
  return { ...result, values: raw };
}
