import { getTranslations } from "next-intl/server";
import { getOptionalAuthContext } from "@/server/auth/dal";
import { roleHasPermission } from "@/domain/auth/permissions";
import { NAV_ITEMS } from "@/features/navigation/nav-items";
import { SidebarNav } from "@/features/navigation/components/sidebar-nav";
import { signOutAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

/**
 * Dashboard shell. It reads the session only to render the nav and user menu;
 * it makes NO authorization decisions — every page calls requirePagePermission().
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOptionalAuthContext();
  const t = await getTranslations();
  const items = ctx ? NAV_ITEMS.filter((item) => roleHasPermission(ctx.role, item.permission)) : [];

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b bg-card md:border-b-0 md:border-e">
        <div className="flex items-center justify-between gap-4 px-4 py-4 md:flex-col md:items-start">
          <div>
            <p className="font-semibold">{t("app.name")}</p>
            <p className="text-xs text-muted-foreground">{ctx?.hospitalName ?? t("app.tagline")}</p>
          </div>
        </div>
        <div className="px-2 pb-3 md:pb-6">
          <SidebarNav items={items} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-end gap-3 border-b bg-card px-4 py-3">
          {ctx ? (
            <>
              <span className="text-sm text-muted-foreground">
                {ctx.name} · {t(`roles.${ctx.role}`)}
              </span>
              <form action={signOutAction}>
                <Button type="submit" variant="outline" size="sm">
                  {t("nav.signOut")}
                </Button>
              </form>
            </>
          ) : null}
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
