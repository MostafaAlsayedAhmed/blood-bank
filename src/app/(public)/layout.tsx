import { getTranslations } from "next-intl/server";

/** Public pages (/register, /privacy): no session, no dashboard chrome, no analytics. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-xl px-4 py-4">
          <p className="font-semibold text-primary">{t("app.name")}</p>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-6">{children}</main>
    </div>
  );
}
