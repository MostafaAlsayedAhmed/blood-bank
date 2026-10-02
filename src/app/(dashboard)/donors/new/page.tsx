import { getTranslations } from "next-intl/server";
import { requirePagePermission } from "@/server/auth/dal";
import { listActiveAreas } from "@/server/queries/donors";
import { DonorForm } from "@/features/donors/components/donor-form";

export default async function NewDonorPage() {
  const ctx = await requirePagePermission("donor:create");
  const t = await getTranslations("donors");
  const areas = await listActiveAreas(ctx.hospitalId);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("newTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("newIntro")}</p>
      </div>
      <DonorForm mode="create" areas={areas} />
    </div>
  );
}
