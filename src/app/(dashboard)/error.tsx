"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// Error boundary for dashboard pages. Shows no technical detail to the user.
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border p-6">
      <p className="font-medium">{t("errors.INTERNAL")}</p>
      <Button variant="outline" onClick={reset}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
