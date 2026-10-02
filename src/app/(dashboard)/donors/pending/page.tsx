import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePagePermission } from "@/server/auth/dal";
import { listPendingReview } from "@/server/queries/donors";
import { roleHasPermission } from "@/domain/auth/permissions";
import { BloodGroupBadge, DonorStatusBadges } from "@/features/donors/components/status-badges";
import { VerificationActions } from "@/features/donors/components/donor-panels";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { hospitalToday } from "@/lib/today";

/** Pending Review queue (W3): verify or reject in place, oldest first. */
export default async function PendingReviewPage() {
  const ctx = await requirePagePermission("donor:verify");
  const t = await getTranslations("donors");
  const rows = await listPendingReview(ctx, hospitalToday());
  const canAdmin = roleHasPermission(ctx.role, "donor:verify_admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("pendingTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("pendingIntro")}</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t("pendingEmpty")} />
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-4 rounded-lg border bg-card p-4" data-testid="pending-donor">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <Link href={`/donors/${row.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {row.fullName}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                    {row.maskedPhone}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("columns.registered")}: <DateText value={row.createdAt} />
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <BloodGroupBadge value={row.bloodGroup} />
                  <DonorStatusBadges {...row} />
                </div>
              </div>
              <VerificationActions
                donorId={row.id}
                status={row.verificationStatus}
                needsReview={row.needsReview}
                canVerify
                canAdmin={canAdmin}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
