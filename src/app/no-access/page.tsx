import { getTranslations } from "next-intl/server";
import { signOutAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/features/i18n/components/language-switcher";

/**
 * Shown when a signed-in user has no single active hospital membership.
 * Not under the dashboard group, so the proxy matcher does not loop.
 */
export default async function NoAccessPage() {
  const t = await getTranslations("noAccess");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <LanguageSwitcher />
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("body")}</p>
        <form action={signOutAction}>
          <Button type="submit" variant="outline">
            {t("signOut")}
          </Button>
        </form>
      </div>
    </main>
  );
}
