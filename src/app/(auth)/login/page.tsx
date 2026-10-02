import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getOptionalAuthContext } from "@/server/auth/dal";
import { LoginForm } from "@/features/auth/components/login-form";
import { LanguageSwitcher } from "@/features/i18n/components/language-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage() {
  if (await getOptionalAuthContext()) redirect("/dashboard");
  const t = await getTranslations();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-12">
      <LanguageSwitcher />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-sm font-medium text-primary">{t("app.name")}</p>
          <CardTitle>{t("login.title")}</CardTitle>
          <CardDescription>{t("login.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
