"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Field, fieldErrorsOf } from "@/components/shared/form-kit";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm } from "@/features/donors/components/action-form";
import {
  addNoteAction,
  clearReviewAction,
  correctEligibilityAction,
  deactivateDonorAction,
  grantConsentAction,
  reactivateDonorAction,
  recordEligibilityAction,
  rejectDonorAction,
  reopenDonorAction,
  revokeVerificationAction,
  setAvailabilityAction,
  verifyDonorAction,
  withdrawConsentAction,
} from "@/features/donors/actions";
import {
  AVAILABILITIES,
  MANUAL_INACTIVE_REASONS,
  REJECTION_REASONS,
  type ActivityStatus,
  type Availability,
  type ConsentPurpose,
  type EligibilityStatus,
  type VerificationStatus,
} from "@/domain/donor/enums";
import { NOTE_MAX } from "@/domain/donor/schemas";

// ─── Verification (W3) ───────────────────────────────────────────────────────

export function VerificationActions(props: {
  donorId: string;
  status: VerificationStatus;
  needsReview: boolean;
  canVerify: boolean;
  canAdmin: boolean;
}) {
  const t = useTranslations("donors.verification");
  const tEnum = useTranslations("enums");
  const { donorId, status } = props;

  return (
    <div className="flex flex-col gap-4">
      {props.canVerify && status === "PENDING" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ActionForm action={verifyDonorAction} donorId={donorId} submitLabel={t("verify")}>
            {(state) => (
              <Field id={`verify-note-${donorId}`} label={t("note")} optional hint={t("verifyHelp")} errors={fieldErrorsOf(state, "note")}>
                {(aria) => <Textarea {...aria} name="note" maxLength={NOTE_MAX} rows={2} />}
              </Field>
            )}
          </ActionForm>
          <ActionForm
            action={rejectDonorAction}
            donorId={donorId}
            submitLabel={t("reject")}
            confirmText={t("rejectConfirm")}
            variant="destructive"
          >
            {(state) => (
              <>
                <Field id={`reject-reason-${donorId}`} label={t("reason")} errors={fieldErrorsOf(state, "reason")}>
                  {(aria) => (
                    <Select {...aria} name="reason" required defaultValue="">
                      <option value="" disabled>
                        —
                      </option>
                      {REJECTION_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {tEnum(`rejectionReason.${r}`)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field id={`reject-note-${donorId}`} label={t("note")} optional errors={fieldErrorsOf(state, "note")}>
                  {(aria) => <Textarea {...aria} name="note" maxLength={NOTE_MAX} rows={2} />}
                </Field>
              </>
            )}
          </ActionForm>
        </div>
      ) : null}

      {props.canVerify && props.needsReview && status !== "PENDING" ? (
        <ActionForm action={clearReviewAction} donorId={donorId} submitLabel={t("clearReview")} variant="secondary">
          {() => <p className="text-sm text-muted-foreground">{t("clearReviewHelp")}</p>}
        </ActionForm>
      ) : null}

      {props.canAdmin && (status === "REJECTED" || status === "VERIFIED") ? (
        <ActionForm
          action={status === "REJECTED" ? reopenDonorAction : revokeVerificationAction}
          donorId={donorId}
          submitLabel={status === "REJECTED" ? t("reopen") : t("revoke")}
          variant="outline"
        >
          {(state) => (
            <Field id={`admin-note-${donorId}`} label={t("adminReason")} errors={fieldErrorsOf(state, "note")}>
              {(aria) => <Textarea {...aria} name="note" required maxLength={NOTE_MAX} rows={2} />}
            </Field>
          )}
        </ActionForm>
      ) : null}
    </div>
  );
}

// ─── Eligibility (W4) ────────────────────────────────────────────────────────

export function EligibilityForm(props: {
  donorId: string;
  current: EligibilityStatus;
  targets: readonly EligibilityStatus[];
  canRecord: boolean;
  canCorrect: boolean;
}) {
  const t = useTranslations("donors.eligibility");
  const tEnum = useTranslations("enums");
  const recordTargets = props.targets.filter((s) => s !== "UNASSESSED");
  const [target, setTarget] = useState<string>("");

  if (props.current === "PERMANENTLY_INELIGIBLE") {
    if (!props.canCorrect) return null;
    return (
      <ActionForm action={correctEligibilityAction} donorId={props.donorId} submitLabel={t("correct")} variant="outline">
        {(state) => (
          <Field id="eligibility-correct-note" label={t("note")} hint={t("correctHelp")} errors={fieldErrorsOf(state, "note")}>
            {(aria) => <Textarea {...aria} name="note" required maxLength={NOTE_MAX} rows={2} />}
          </Field>
        )}
      </ActionForm>
    );
  }
  if (!props.canRecord) return null;
  if (recordTargets.length === 0) return <p className="text-sm text-muted-foreground">{t("noTransitions")}</p>;

  return (
    <ActionForm action={recordEligibilityAction} donorId={props.donorId} submitLabel={t("record")}>
      {(state) => (
        <>
          <Field id="eligibility-status" label={t("status")} errors={fieldErrorsOf(state, "status")}>
            {(aria) => (
              <Select {...aria} name="status" required value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="" disabled>
                  —
                </option>
                {recordTargets.map((s) => (
                  <option key={s} value={s}>
                    {tEnum(`eligibilityStatus.${s}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {target === "TEMPORARILY_INELIGIBLE" ? (
            <Field id="eligibility-until" label={t("until")} errors={fieldErrorsOf(state, "until")}>
              {(aria) => <Input {...aria} name="until" type="date" required />}
            </Field>
          ) : null}
          <Field
            id="eligibility-note"
            label={t("note")}
            optional={target === "ELIGIBLE"}
            hint={t("noteHint")}
            errors={fieldErrorsOf(state, "note")}
          >
            {(aria) => <Textarea {...aria} name="note" maxLength={NOTE_MAX} rows={2} />}
          </Field>
        </>
      )}
    </ActionForm>
  );
}

// ─── Availability and activity ───────────────────────────────────────────────

export function AvailabilityForm({ donorId, current }: { donorId: string; current: Availability }) {
  const t = useTranslations("donors.availability");
  const tEnum = useTranslations("enums");
  const [value, setValue] = useState<string>(current);
  return (
    <ActionForm action={setAvailabilityAction} donorId={donorId} submitLabel={t("set")} variant="secondary">
      {(state) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="availability" label={t("title")} errors={fieldErrorsOf(state, "availability")}>
            {(aria) => (
              <Select {...aria} name="availability" value={value} onChange={(e) => setValue(e.target.value)}>
                {AVAILABILITIES.map((a) => (
                  <option key={a} value={a}>
                    {tEnum(`availability.${a}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {value === "UNAVAILABLE" ? (
            <Field id="unavailableUntil" label={t("until")} errors={fieldErrorsOf(state, "unavailableUntil")}>
              {(aria) => <Input {...aria} name="unavailableUntil" type="date" />}
            </Field>
          ) : null}
        </div>
      )}
    </ActionForm>
  );
}

export function ActivityForm(props: { donorId: string; status: ActivityStatus; canReactivate: boolean }) {
  const t = useTranslations("donors.activity");
  const tEnum = useTranslations("enums");
  if (props.status === "INACTIVE") {
    return props.canReactivate ? (
      <ActionForm action={reactivateDonorAction} donorId={props.donorId} submitLabel={t("reactivate")} variant="secondary" />
    ) : (
      <p className="text-sm text-muted-foreground">{t("reactivateBlocked")}</p>
    );
  }
  return (
    <ActionForm
      action={deactivateDonorAction}
      donorId={props.donorId}
      submitLabel={t("deactivate")}
      confirmText={t("deactivateConfirm")}
      variant="outline"
    >
      {(state) => (
        <Field id="inactive-reason" label={t("reason")} errors={fieldErrorsOf(state, "reason")}>
          {(aria) => (
            <Select {...aria} name="reason" required defaultValue="">
              <option value="" disabled>
                —
              </option>
              {MANUAL_INACTIVE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {tEnum(`inactiveReason.${r}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
    </ActionForm>
  );
}

// ─── Consent (W9) ────────────────────────────────────────────────────────────

export function ConsentAction(props: {
  donorId: string;
  purpose: ConsentPurpose;
  active: boolean;
  canWithdraw: boolean;
  canGrant: boolean;
}) {
  const t = useTranslations("donors.consent");
  if (props.active && props.canWithdraw) {
    return (
      <ActionForm
        action={withdrawConsentAction}
        donorId={props.donorId}
        submitLabel={t("withdraw")}
        confirmText={t("withdrawConfirm")}
        variant="outline"
      >
        {() => <input type="hidden" name="purpose" value={props.purpose} />}
      </ActionForm>
    );
  }
  if (!props.active && props.canGrant) {
    return (
      <ActionForm action={grantConsentAction} donorId={props.donorId} submitLabel={t("grant")} variant="secondary">
        {() => (
          <>
            <input type="hidden" name="purpose" value={props.purpose} />
            <p className="text-xs text-muted-foreground">{t("grantHelp")}</p>
          </>
        )}
      </ActionForm>
    );
  }
  return null;
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export function NoteForm({ donorId }: { donorId: string }) {
  const t = useTranslations("donors.notes");
  return (
    <ActionForm action={addNoteAction} donorId={donorId} submitLabel={t("add")} variant="secondary">
      {(state) => (
        <Field id="note-body" label={t("body")} errors={fieldErrorsOf(state, "body")}>
          {(aria) => <Textarea {...aria} name="body" required maxLength={NOTE_MAX} rows={3} />}
        </Field>
      )}
    </ActionForm>
  );
}
