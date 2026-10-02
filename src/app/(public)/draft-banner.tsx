import { getTranslations } from "next-intl/server";

/** Shown until the notice and consent wording are approved (L3/L4). */
export async function DraftBanner() {
  const t = await getTranslations("privacyNotice");
  return (
    <p role="note" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
      {t("draftBanner")}
    </p>
  );
}
