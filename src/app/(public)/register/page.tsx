import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolvePublicHospitalId } from "@/server/public-context";
import { listActiveAreas } from "@/server/queries/donors";
import { RegistrationForm } from "@/features/registration/components/registration-form";
import { DraftBanner } from "../draft-banner";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("register");
  return { title: t("title") };
}

/** Public, unauthenticated registration page (W1), reachable by QR code. */
export default async function RegisterPage() {
  const t = await getTranslations("register");
  const areas = await listActiveAreas(await resolvePublicHospitalId());

  return (
    <div className="flex flex-col gap-6">
      <DraftBanner />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <RegistrationForm areas={areas.map((a) => ({ id: a.id, name: a.name }))} />
    </div>
  );
}
