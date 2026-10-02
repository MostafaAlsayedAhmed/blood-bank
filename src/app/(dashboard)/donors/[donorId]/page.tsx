import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import * as z from "zod";
import { requirePagePermission } from "@/server/auth/dal";
import { getDonorProfile, type DonorProfile } from "@/server/queries/donors";
import { roleHasPermission } from "@/domain/auth/permissions";
import { ageOn } from "@/domain/dates";
import { isDomainError } from "@/domain/errors";
import { bloodGroupLabel } from "@/domain/blood-group";
import { CONSENT_PURPOSES } from "@/domain/donor/enums";
import { allowedEligibilityTargets } from "@/domain/donor/transitions";
import { BloodGroupBadge, DonorStatusBadges } from "@/features/donors/components/status-badges";
import { RevealPhone } from "@/features/donors/components/reveal-phone";
import {
  ActivityForm,
  AvailabilityForm,
  ConsentAction,
  EligibilityForm,
  NoteForm,
  VerificationActions,
} from "@/features/donors/components/donor-panels";
import { DateText } from "@/components/shared/date-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { hospitalToday } from "@/lib/today";

/** Donor profile (spec §10). Viewing it is recorded as donor.viewed in the audit log. */
export default async function DonorProfilePage({ params }: { params: Promise<{ donorId: string }> }) {
  const ctx = await requirePagePermission("donor:read");
  const { donorId } = await params;
  if (!z.uuid().safeParse(donorId).success) notFound();

  const today = hospitalToday();
  const donor = await getDonorProfile(ctx, donorId, today).catch((error: unknown) => {
    if (isDomainError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  });

  const t = await getTranslations("donors");
  const tEnum = await getTranslations("enums");
  const can = (p: Parameters<typeof roleHasPermission>[1]) => roleHasPermission(ctx.role, p);
  const activeConsents = new Set(donor.consents.filter((c) => !c.withdrawnAt).map((c) => c.purpose));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link href="/donors" className="text-sm text-muted-foreground hover:underline">
            {/* Points back toward the start edge in both directions. */}
            <span aria-hidden="true" className="inline-block rtl:rotate-180">←</span> {t("title")}
          </Link>
          <h1 className="text-2xl font-semibold">{donor.fullName}</h1>
          <DonorStatusBadges {...donor} />
        </div>
        {can("donor:update") ? (
          <Link href={`/donors/${donor.id}/edit`} className={buttonVariants({ variant: "outline" })}>
            {t("editTitle")}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.overview")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Overview donor={donor} today={today} canReveal={can("donor:read_contact")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("verification.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">{t("profile.bloodGroupVerificationBlocked")}</p>
            <VerificationActions
              donorId={donor.id}
              status={donor.verificationStatus}
              needsReview={donor.needsReview}
              canVerify={can("donor:verify")}
              canAdmin={can("donor:verify_admin")}
            />
            <History title={t("verification.history")} empty={t("verification.historyEmpty")}>
              {donor.verifications.map((v) => (
                <li key={v.id} className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {tEnum(`verificationDecision.${v.decision}`)}
                    {v.rejectionReason ? ` · ${tEnum(`rejectionReason.${v.rejectionReason}`)}` : ""}
                  </span>
                  {v.note ? <span className="text-muted-foreground">{v.note}</span> : null}
                  <span className="text-xs text-muted-foreground">
                    <DateText value={v.createdAt} withTime /> · {v.decidedBy}
                  </span>
                </li>
              ))}
            </History>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("eligibility.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Badge>{tEnum(`eligibilityStatus.${donor.eligibilityStatus}`)}</Badge>
              {donor.ineligibleUntil ? (
                <span>
                  {t("profile.ineligibleUntil", { date: donor.ineligibleUntil })}
                </span>
              ) : null}
              {donor.nextEligibleOn ? <span>{t("profile.nextEligibleOn", { date: donor.nextEligibleOn })}</span> : null}
            </p>
            <EligibilityForm
              donorId={donor.id}
              current={donor.eligibilityStatus}
              targets={allowedEligibilityTargets(donor.eligibilityStatus)}
              canRecord={can("donor:set_eligibility")}
              canCorrect={can("donor:eligibility_correct")}
            />
            <History title={t("eligibility.history")} empty={t("eligibility.historyEmpty")}>
              {donor.eligibilityHistory.map((e) => (
                <li key={e.id} className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {tEnum(`eligibilityStatus.${e.status}`)}
                    {e.until ? ` · ${t("profile.ineligibleUntil", { date: e.until })}` : ""}
                  </span>
                  {e.note ? <span className="text-muted-foreground">{e.note}</span> : null}
                  <span className="text-xs text-muted-foreground">
                    <DateText value={e.createdAt} withTime /> · {e.recordedBy}
                  </span>
                </li>
              ))}
            </History>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("availability.title")} · {t("activity.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Badge>{tEnum(`availability.${donor.availability}`)}</Badge>
              {donor.unavailableUntil ? <span>{t("profile.unavailableUntil", { date: donor.unavailableUntil })}</span> : null}
              <Badge tone={donor.activityStatus === "ACTIVE" ? "info" : "negative"}>
                {tEnum(`activityStatus.${donor.activityStatus}`)}
              </Badge>
              {donor.inactiveReason ? <span>{tEnum(`inactiveReason.${donor.inactiveReason}`)}</span> : null}
            </p>
            {can("donor:update") ? (
              <>
                <AvailabilityForm donorId={donor.id} current={donor.availability} />
                <ActivityForm
                  donorId={donor.id}
                  status={donor.activityStatus}
                  canReactivate={activeConsents.has("REGISTRY") && activeConsents.has("CONTACT")}
                />
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("consent.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {CONSENT_PURPOSES.map((purpose) => {
              const records = donor.consents.filter((c) => c.purpose === purpose);
              return (
                <section key={purpose} className="flex flex-col gap-2 border-b pb-4 last:border-b-0 last:pb-0" data-testid={`consent-${purpose}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">{tEnum(`consentPurpose.${purpose}`)}</h3>
                    <Badge tone={activeConsents.has(purpose) ? "positive" : "negative"}>
                      {activeConsents.has(purpose) ? t("consent.active") : t("consent.missing")}
                    </Badge>
                  </div>
                  <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {records.map((c) => (
                      <li key={c.id}>
                        {t("consent.granted")} <DateText value={c.grantedAt} withTime /> ·{" "}
                        {tEnum(`consentChannel.${c.channel}`)} · {t("consent.notice", { version: c.noticeVersion })}
                        {c.withdrawnAt ? (
                          <>
                            {" "}
                            · {t("consent.withdrawn")} <DateText value={c.withdrawnAt} withTime />
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <ConsentAction
                    donorId={donor.id}
                    purpose={purpose}
                    active={activeConsents.has(purpose)}
                    canWithdraw={can("consent:withdraw")}
                    canGrant={can("donor:update")}
                  />
                </section>
              );
            })}
          </CardContent>
        </Card>

        {donor.notes ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("notes.title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <NoteForm donorId={donor.id} />
              <History title={t("notes.title")} empty={t("notes.empty")} hideTitle>
                {donor.notes.map((n) => (
                  <li key={n.id} className="flex flex-col gap-0.5">
                    <span className="whitespace-pre-wrap">{n.body}</span>
                    <span className="text-xs text-muted-foreground">
                      <DateText value={n.createdAt} withTime /> · {n.author}
                    </span>
                  </li>
                ))}
              </History>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

async function Overview({ donor, today, canReveal }: { donor: DonorProfile; today: string; canReveal: boolean }) {
  const t = await getTranslations("donors");
  const tEnum = await getTranslations("enums");
  const rows: Array<[string, React.ReactNode]> = [
    [t("profile.phone"), <RevealPhone key="p" donorId={donor.id} masked={donor.maskedPhone} canReveal={canReveal} />],
    [
      t("profile.dateOfBirth"),
      <span key="d">
        <DateText value={donor.dateOfBirth} /> ({t("profile.age", { age: ageOn(donor.dateOfBirth, today) })})
      </span>,
    ],
    [t("columns.bloodGroup"), <BloodGroupBadge key="b" value={donor.bloodGroup} />],
    [
      t("profile.bloodGroupSelf"),
      donor.selfReportedBloodGroup ? bloodGroupLabel(donor.selfReportedBloodGroup) : tEnum("bloodGroupUnknown"),
    ],
    [t("profile.city"), donor.city],
    [t("profile.area"), donor.areaName ?? t("areaNotListed")],
    [t("profile.preferredContact"), tEnum(`contactMethod.${donor.preferredContact}`)],
    [t("profile.donatedBefore"), tEnum(`donatedBefore.${donor.donatedBefore}`)],
    [t("profile.lastDonationMonth"), donor.selfReportedLastDonationMonth ?? "—"],
    [t("profile.source"), tEnum(`source.${donor.source}`)],
    [t("profile.registered"), <DateText key="r" value={donor.createdAt} withTime />],
  ];
  return (
    <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function History({
  title,
  empty,
  hideTitle,
  children,
}: {
  title: string;
  empty: string;
  hideTitle?: boolean;
  children: React.ReactNode[];
}) {
  return (
    <section className="flex flex-col gap-2 border-t pt-4">
      <h3 className={hideTitle ? "sr-only" : "text-sm font-medium"}>{title}</h3>
      {children.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="flex flex-col gap-3 text-sm">{children}</ol>
      )}
    </section>
  );
}
