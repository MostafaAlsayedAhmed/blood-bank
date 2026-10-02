"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { revealContactAction } from "@/features/donors/actions";
import { Button } from "@/components/ui/button";

/**
 * Masked phone with an audited reveal (spec §11). The full number is fetched on
 * demand, never sent with the page, and never logged on the client.
 */
export function RevealPhone({ donorId, masked, canReveal }: { donorId: string; masked: string; canReveal: boolean }) {
  const t = useTranslations("donors.profile");
  const tErrors = useTranslations("errors");
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reveal() {
    startTransition(async () => {
      const result = await revealContactAction(donorId);
      if (result.ok) setPhone(result.data.phone);
      else setError(tErrors(result.error));
    });
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-mono" dir="ltr" data-testid="donor-phone">
        {phone ?? masked}
      </span>
      {canReveal && !phone ? (
        <Button size="sm" variant="outline" onClick={reveal} disabled={pending} title={t("revealAudited")}>
          {pending ? t("revealing") : t("reveal")}
        </Button>
      ) : null}
      {error ? (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}
