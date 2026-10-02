import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** Generic confirmation: echoes nothing and is identical for new and existing registrations. */
export default async function RegisterThanksPage() {
  const t = await getTranslations("register");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("thanksTitle")}</h1>
      <p className="text-muted-foreground">{t("thanksBody")}</p>
      <Link href="/register" className="text-sm font-medium text-primary underline underline-offset-4">
        {t("thanksAgain")}
      </Link>
    </div>
  );
}
