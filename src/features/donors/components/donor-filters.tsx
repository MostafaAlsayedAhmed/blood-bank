import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BLOOD_GROUPS, bloodGroupLabel } from "@/domain/blood-group";
import { ACTIVITY_STATUSES, AVAILABILITIES, ELIGIBILITY_STATUSES, VERIFICATION_STATUSES } from "@/domain/donor/enums";
import type { DonorFilters } from "@/domain/donor/schemas";

type Props = { filters: DonorFilters; areas: readonly { id: string; name: string }[] };

/** Structured filters as a plain GET form: shareable URLs, no JavaScript needed (spec §10). */
export function DonorFiltersForm({ filters, areas }: Props) {
  const t = useTranslations("donors");
  const tEnum = useTranslations("enums");

  const selects: Array<{ name: keyof DonorFilters; label: string; options: Array<[string, string]> }> = [
    { name: "bloodGroup", label: t("columns.bloodGroup"), options: BLOOD_GROUPS.map((g) => [g, bloodGroupLabel(g)]) },
    {
      name: "verification",
      label: t("verification.title"),
      options: VERIFICATION_STATUSES.map((s) => [s, tEnum(`verificationStatus.${s}`)]),
    },
    {
      name: "eligibility",
      label: t("eligibility.title"),
      options: ELIGIBILITY_STATUSES.map((s) => [s, tEnum(`eligibilityStatus.${s}`)]),
    },
    { name: "activity", label: t("activity.title"), options: ACTIVITY_STATUSES.map((s) => [s, tEnum(`activityStatus.${s}`)]) },
    {
      name: "availability",
      label: t("availability.title"),
      options: AVAILABILITIES.map((s) => [s, tEnum(`availability.${s}`)]),
    },
    { name: "areaId", label: t("columns.area"), options: areas.map((a) => [a.id, a.name]) },
  ];

  return (
    <form method="get" action="/donors" className="flex flex-col gap-3 rounded-lg border bg-card p-4" aria-label={t("filters")}>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {selects.map((s) => (
          <div key={s.name} className="flex flex-col gap-1.5">
            <Label htmlFor={`filter-${s.name}`}>{s.label}</Label>
            <Select id={`filter-${s.name}`} name={s.name} defaultValue={(filters[s.name] as string | undefined) ?? ""}>
              <option value="">{t("any")}</option>
              {s.options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="needsReview" value="1" defaultChecked={filters.needsReview === "1"} className="size-4 accent-primary" />
          {t("needsReviewFilter")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="reassessmentDue"
            value="1"
            defaultChecked={filters.reassessmentDue === "1"}
            className="size-4 accent-primary"
          />
          {t("reassessmentDueFilter")}
        </label>
        <div className="ms-auto flex gap-2">
          <Link href="/donors" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {t("resetFilters")}
          </Link>
          <Button type="submit" size="sm" variant="secondary">
            {t("applyFilters")}
          </Button>
        </div>
      </div>
    </form>
  );
}
