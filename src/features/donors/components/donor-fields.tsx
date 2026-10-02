"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, fieldErrorsOf, valueOf } from "@/components/shared/form-kit";
import { BLOOD_GROUPS, bloodGroupLabel } from "@/domain/blood-group";
import { CONTACT_METHODS, DONATED_BEFORE } from "@/domain/donor/enums";
import type { ActionResult } from "@/lib/action-result";

export type AreaOption = { id: string; name: string };

type Props = {
  state: (ActionResult<unknown> & { values?: Record<string, string> }) | null;
  areas: readonly AreaOption[];
  /** Initial values (edit form); state.values win after a failed submission. */
  defaults?: Partial<Record<string, string>>;
};

/**
 * Donor detail fields shared by public registration, staff entry and staff edit,
 * so all three validate against the same schema fields (spec §8).
 */
export function DonorFields({ state, areas, defaults = {} }: Props) {
  const t = useTranslations("register");
  const tEnum = useTranslations("enums");
  const value = (name: string) => valueOf(state, name, defaults[name] ?? "");
  const errors = (name: string) => fieldErrorsOf(state, name);
  const [donatedBefore, setDonatedBefore] = useState(value("donatedBefore"));

  return (
    <>
      <Field id="fullName" label={t("fullName")} errors={errors("fullName")}>
        {(aria) => (
          <Input {...aria} name="fullName" autoComplete="name" required maxLength={120} defaultValue={value("fullName")} />
        )}
      </Field>

      <Field id="phone" label={t("phone")} hint={t("phoneHint")} errors={errors("phone")}>
        {(aria) => (
          <Input
            {...aria}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            dir="ltr"
            defaultValue={value("phone")}
          />
        )}
      </Field>

      <Field id="dateOfBirth" label={t("dateOfBirth")} errors={errors("dateOfBirth")}>
        {(aria) => <Input {...aria} name="dateOfBirth" type="date" required defaultValue={value("dateOfBirth")} />}
      </Field>

      <Field id="bloodGroup" label={t("bloodGroup")} hint={t("bloodGroupHint")} errors={errors("bloodGroup")}>
        {(aria) => (
          // React 19 form reset does not restore a select's defaultValue; re-keying remounts it.
          <Select {...aria} key={value("bloodGroup")} name="bloodGroup" required defaultValue={value("bloodGroup")}>
            <option value="" disabled>
              —
            </option>
            <option value="UNKNOWN">{tEnum("bloodGroupUnknown")}</option>
            {BLOOD_GROUPS.map((g) => (
              <option key={g} value={g}>
                {bloodGroupLabel(g)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="city" label={t("city")} errors={errors("city")}>
          {(aria) => (
            <Input {...aria} name="city" autoComplete="address-level2" required maxLength={80} defaultValue={value("city")} />
          )}
        </Field>
        <Field id="areaId" label={t("area")} optional errors={errors("areaId")}>
          {(aria) => (
            <Select {...aria} key={value("areaId")} name="areaId" defaultValue={value("areaId")}>
              <option value="">{t("areaOther")}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("donatedBefore")}</legend>
        <div className="flex flex-wrap gap-4">
          {DONATED_BEFORE.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="donatedBefore"
                value={option}
                required
                defaultChecked={value("donatedBefore") === option}
                onChange={() => setDonatedBefore(option)}
                className="size-4 accent-primary"
              />
              {tEnum(`donatedBefore.${option}`)}
            </label>
          ))}
        </div>
        {errors("donatedBefore") ? <FieldErrorText name="donatedBefore" state={state} /> : null}
      </fieldset>

      {/* Rendered without JS too; the server ignores it unless the answer is YES. */}
      <Field
        id="lastDonationMonth"
        label={t("lastDonationMonth")}
        optional
        errors={errors("lastDonationMonth")}
        className={donatedBefore && donatedBefore !== "YES" ? "hidden" : undefined}
      >
        {(aria) => <Input {...aria} name="lastDonationMonth" type="month" defaultValue={value("lastDonationMonth")} />}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("preferredContact")}</legend>
        <div className="flex flex-wrap gap-4">
          {CONTACT_METHODS.map((method) => (
            <label key={method} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="preferredContact"
                value={method}
                required
                defaultChecked={value("preferredContact") === method}
                className="size-4 accent-primary"
              />
              {tEnum(`contactMethod.${method}`)}
            </label>
          ))}
        </div>
        {errors("preferredContact") ? <FieldErrorText name="preferredContact" state={state} /> : null}
      </fieldset>
    </>
  );
}

function FieldErrorText({ name, state }: { name: string; state: Props["state"] }) {
  const t = useTranslations("fieldErrors");
  const key = fieldErrorsOf(state, name)?.[0] ?? "invalid";
  return <p className="text-sm text-destructive">{t.has(key) ? t(key) : t("invalid")}</p>;
}
