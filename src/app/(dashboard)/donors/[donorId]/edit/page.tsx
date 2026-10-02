import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import * as z from "zod";
import { requirePagePermission } from "@/server/auth/dal";
import { getDonorForEdit, listActiveAreas } from "@/server/queries/donors";
import { isDomainError } from "@/domain/errors";
import { DonorForm } from "@/features/donors/components/donor-form";

export default async function EditDonorPage({ params }: { params: Promise<{ donorId: string }> }) {
  const ctx = await requirePagePermission("donor:update");
  const { donorId } = await params;
  if (!z.uuid().safeParse(donorId).success) notFound();
  const t = await getTranslations("donors");

  const values = await getDonorForEdit(ctx, donorId).catch((error: unknown) => {
    if (isDomainError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  });
  const areas = await listActiveAreas(ctx.hospitalId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <DonorForm mode="edit" donorId={values.id} areas={areas} defaults={values} />
    </div>
  );
}
