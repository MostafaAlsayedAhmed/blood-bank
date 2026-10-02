import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PRIVACY_NOTICE_VERSION } from "@/domain/consent/notice";
import { DraftBanner } from "../draft-banner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacyNotice");
  return { title: t("title") };
}

const SECTIONS = ["controller", "data", "purpose", "sensitive", "retention", "rights"] as const;

/**
 * Privacy notice. The text is the "privacyNotice" message block, whose SHA-256 is
 * stored with every consent (spec D13). Draft until L3/L4 are resolved.
 */
export default async function PrivacyPage() {
  const t = await getTranslations("privacyNotice");
  const tCommon = await getTranslations("common");
  return (
    <article className="flex flex-col gap-5">
      <DraftBanner />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-xs text-muted-foreground">{tCommon("version", { version: PRIVACY_NOTICE_VERSION })}</p>
      </div>
      <p>{t("intro")}</p>
      {SECTIONS.map((section) => (
        <section key={section} className="flex flex-col gap-1">
          <h2 className="font-semibold">{t(`${section}Heading`)}</h2>
          <p className="text-sm text-muted-foreground">{t(`${section}Body`)}</p>
        </section>
      ))}
      <section className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
        <p>{t("consentRegistry")}</p>
        <p>{t("consentContact")}</p>
      </section>
    </article>
  );
}
