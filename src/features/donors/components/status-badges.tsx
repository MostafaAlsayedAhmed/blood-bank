import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { bloodGroupLabel, type BloodGroup, type BloodGroupBasis } from "@/domain/blood-group";
import type {
  ActivityStatus,
  Availability,
  EligibilityStatus,
  VerificationStatus,
} from "@/domain/donor/enums";

const VERIFICATION_TONE: Record<VerificationStatus, BadgeTone> = {
  PENDING: "warning",
  VERIFIED: "positive",
  REJECTED: "negative",
};
const ELIGIBILITY_TONE: Record<EligibilityStatus, BadgeTone> = {
  UNASSESSED: "neutral",
  ELIGIBLE: "positive",
  TEMPORARILY_INELIGIBLE: "warning",
  PERMANENTLY_INELIGIBLE: "negative",
};
const AVAILABILITY_TONE: Record<Availability, BadgeTone> = {
  AVAILABLE: "positive",
  UNAVAILABLE: "warning",
  UNKNOWN: "neutral",
};

/** The three independent status axes plus availability (spec D2), never merged into one. */
export function DonorStatusBadges(props: {
  verificationStatus: VerificationStatus;
  eligibilityStatus: EligibilityStatus;
  activityStatus: ActivityStatus;
  availability: Availability;
  needsReview?: boolean;
  reassessmentDue?: boolean;
}) {
  const t = useTranslations("enums");
  const tDonors = useTranslations("donors");
  return (
    <span className="flex flex-wrap gap-1">
      <Badge tone={VERIFICATION_TONE[props.verificationStatus]}>{t(`verificationStatus.${props.verificationStatus}`)}</Badge>
      <Badge tone={ELIGIBILITY_TONE[props.eligibilityStatus]}>{t(`eligibilityStatus.${props.eligibilityStatus}`)}</Badge>
      <Badge tone={props.activityStatus === "ACTIVE" ? "info" : "negative"}>
        {t(`activityStatus.${props.activityStatus}`)}
      </Badge>
      <Badge tone={AVAILABILITY_TONE[props.availability]}>{t(`availability.${props.availability}`)}</Badge>
      {props.needsReview ? <Badge tone="warning">{tDonors("needsReview")}</Badge> : null}
      {props.reassessmentDue ? <Badge tone="warning">{tDonors("reassessmentDue")}</Badge> : null}
    </span>
  );
}

/** Blood group with its source, so a self-reported group is never mistaken for a verified one (D3). */
export function BloodGroupBadge({ value }: { value: { group: BloodGroup; basis: BloodGroupBasis } | null }) {
  const t = useTranslations("enums.bloodGroupBasis");
  const tDonors = useTranslations("donors");
  if (!value) return <span className="text-sm text-muted-foreground">{tDonors("noBloodGroup")}</span>;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-semibold">{bloodGroupLabel(value.group)}</span>
      <Badge tone={value.basis === "VERIFIED" ? "positive" : "neutral"}>{t(value.basis)}</Badge>
    </span>
  );
}
