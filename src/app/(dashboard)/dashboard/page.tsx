import { getTranslations } from "next-intl/server";
import { requirePagePermission } from "@/server/auth/dal";
import { EmptyState } from "@/components/shared/empty-state";

export default async function DashboardPage() {
  const ctx = await requirePagePermission("dashboard:read");
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.welcome", { name: ctx.name, role: t(`roles.${ctx.role}`) })}
        </p>
      </div>
      {/* KPIs are built in Phase 7 from live queries; no placeholder numbers (brief §26 Phase 9). */}
      <EmptyState title={t("dashboard.emptyTitle")} description={t("dashboard.emptyBody")} />
    </div>
  );
}
