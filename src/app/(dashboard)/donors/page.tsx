import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePagePermission } from "@/server/auth/dal";
import { listActiveAreas, listDonors } from "@/server/queries/donors";
import { roleHasPermission } from "@/domain/auth/permissions";
import { donorFiltersSchema, type DonorFilters } from "@/domain/donor/schemas";
import { DonorFiltersForm } from "@/features/donors/components/donor-filters";
import { DonorSearch } from "@/features/donors/components/donor-search";
import { DonorTable } from "@/features/donors/components/donor-table";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { hospitalToday } from "@/lib/today";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pageHref(filters: DonorFilters, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key !== "page" && typeof value === "string") params.set(key, value);
  }
  params.set("page", String(page));
  return `/donors?${params.toString()}`;
}

export default async function DonorsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePagePermission("donor:read");
  const t = await getTranslations();
  const raw = await searchParams;
  const filters = donorFiltersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const [result, areas] = await Promise.all([
    listDonors(ctx, filters, hospitalToday()),
    listActiveAreas(ctx.hospitalId),
  ]);
  const hasFilters = Object.entries(filters).some(([k, v]) => k !== "page" && v !== undefined);
  const pageLabel = t("common.pageOf", { page: result.page, pages: result.pages });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("donors.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("donors.count", { count: result.total })}</p>
        </div>
        {roleHasPermission(ctx.role, "donor:create") ? (
          <Link href="/donors/new" className={buttonVariants()}>
            {t("donors.add")}
          </Link>
        ) : null}
      </div>

      <DonorFiltersForm filters={filters} areas={areas} />

      <DonorSearch filters={filters}>
        {result.rows.length === 0 ? (
          <EmptyState title={hasFilters ? t("donors.empty") : t("donors.emptyRegistry")} />
        ) : (
          <div className="flex flex-col gap-3">
            <DonorTable rows={result.rows} caption={t("donors.title")} />
            {result.pages > 1 ? (
              <nav aria-label={pageLabel} className="flex items-center gap-3 text-sm">
                {result.page > 1 ? (
                  <Link
                    href={pageHref(filters, result.page - 1)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {t("common.previous")}
                  </Link>
                ) : null}
                <span>{pageLabel}</span>
                {result.page < result.pages ? (
                  <Link
                    href={pageHref(filters, result.page + 1)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {t("common.next")}
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </div>
        )}
      </DonorSearch>
    </div>
  );
}
