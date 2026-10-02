import Link from "next/link";
import { useTranslations } from "next-intl";
import { DateText } from "@/components/shared/date-text";
import { BloodGroupBadge, DonorStatusBadges } from "@/features/donors/components/status-badges";
import type { DonorRow } from "@/server/queries/donors";

/** Donor table with masked phones (spec §10). Used by the list, search results and review queue. */
export function DonorTable({ rows, caption }: { rows: readonly DonorRow[]; caption: string }) {
  const t = useTranslations("donors");
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[44rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b bg-muted/50 text-start text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-start font-medium">{t("columns.name")}</th>
            <th scope="col" className="px-3 py-2 text-start font-medium">{t("columns.phone")}</th>
            <th scope="col" className="px-3 py-2 text-start font-medium">{t("columns.bloodGroup")}</th>
            <th scope="col" className="px-3 py-2 text-start font-medium">{t("columns.status")}</th>
            <th scope="col" className="px-3 py-2 text-start font-medium">{t("columns.area")}</th>
            <th scope="col" className="px-3 py-2 text-start font-medium">{t("columns.registered")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/30">
              <td className="px-3 py-2">
                <Link href={`/donors/${row.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  {row.fullName}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                {row.maskedPhone}
              </td>
              <td className="px-3 py-2">
                <BloodGroupBadge value={row.bloodGroup} />
              </td>
              <td className="px-3 py-2">
                <DonorStatusBadges {...row} />
              </td>
              <td className="px-3 py-2">{row.areaName ?? t("areaNotListed")}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <DateText value={row.createdAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
