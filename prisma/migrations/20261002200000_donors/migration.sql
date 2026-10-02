-- Phase 2: donors, consent, verification and eligibility history, notes, registration throttle.
-- Prisma-generated DDL followed by hand-written integrity rules.

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('UNASSESSED', 'ELIGIBLE', 'TEMPORARILY_INELIGIBLE', 'PERMANENTLY_INELIGIBLE');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InactiveReason" AS ENUM ('DONOR_OPT_OUT', 'UNREACHABLE', 'CONSENT_WITHDRAWN', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DonatedBefore" AS ENUM ('YES', 'NO', 'UNSURE');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('PHONE', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "DonorSource" AS ENUM ('PUBLIC_FORM', 'STAFF_ENTRY');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('REGISTRY', 'CONTACT');

-- CreateEnum
CREATE TYPE "ConsentChannel" AS ENUM ('PUBLIC_FORM', 'STAFF_ENTRY');

-- CreateEnum
CREATE TYPE "VerificationDecision" AS ENUM ('VERIFIED', 'REJECTED', 'REVOKED', 'REOPENED');

-- CreateEnum
CREATE TYPE "RejectionReason" AS ENUM ('DUPLICATE', 'UNREACHABLE', 'INVALID', 'NOT_MEETING_CRITERIA', 'OTHER');

-- CreateTable
CREATE TABLE "donor" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "city" TEXT NOT NULL,
    "areaId" UUID,
    "preferredContact" "ContactMethod" NOT NULL,
    "selfReportedBloodGroup" "BloodGroup",
    "verifiedBloodGroup" "BloodGroup",
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "eligibilityStatus" "EligibilityStatus" NOT NULL DEFAULT 'UNASSESSED',
    "ineligibleUntil" DATE,
    "nextEligibleOn" DATE,
    "activityStatus" "ActivityStatus" NOT NULL DEFAULT 'ACTIVE',
    "inactiveReason" "InactiveReason",
    "availability" "Availability" NOT NULL DEFAULT 'UNKNOWN',
    "unavailableUntil" DATE,
    "donatedBefore" "DonatedBefore" NOT NULL,
    "selfReportedLastDonationMonth" DATE,
    "source" "DonorSource" NOT NULL,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "anonymisedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "donor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_record" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "noticeSha256" TEXT NOT NULL,
    "channel" "ConsentChannel" NOT NULL,
    "capturedById" TEXT,
    "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMPTZ(3),
    "withdrawnById" TEXT,

    CONSTRAINT "consent_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donor_verification" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "decision" "VerificationDecision" NOT NULL,
    "rejectionReason" "RejectionReason",
    "note" TEXT NOT NULL DEFAULT '',
    "decidedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donor_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_record" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "status" "EligibilityStatus" NOT NULL,
    "until" DATE,
    "note" TEXT NOT NULL DEFAULT '',
    "rulesetVersion" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eligibility_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donor_note" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "donorId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donor_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_attempt" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "donor_hospitalId_verificationStatus_idx" ON "donor"("hospitalId", "verificationStatus");

-- CreateIndex
CREATE INDEX "donor_hospitalId_eligibilityStatus_activityStatus_idx" ON "donor"("hospitalId", "eligibilityStatus", "activityStatus");

-- CreateIndex
CREATE INDEX "donor_hospitalId_verifiedBloodGroup_idx" ON "donor"("hospitalId", "verifiedBloodGroup");

-- CreateIndex
CREATE INDEX "donor_hospitalId_areaId_idx" ON "donor"("hospitalId", "areaId");

-- CreateIndex
CREATE UNIQUE INDEX "donor_hospitalId_phoneE164_key" ON "donor"("hospitalId", "phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "donor_id_hospitalId_key" ON "donor"("id", "hospitalId");

-- CreateIndex
CREATE INDEX "consent_record_donorId_idx" ON "consent_record"("donorId");

-- CreateIndex
CREATE INDEX "donor_verification_donorId_createdAt_idx" ON "donor_verification"("donorId", "createdAt");

-- CreateIndex
CREATE INDEX "eligibility_record_donorId_createdAt_idx" ON "eligibility_record"("donorId", "createdAt");

-- CreateIndex
CREATE INDEX "donor_note_donorId_createdAt_idx" ON "donor_note"("donorId", "createdAt");

-- CreateIndex
CREATE INDEX "registration_attempt_hospitalId_ipHash_createdAt_idx" ON "registration_attempt"("hospitalId", "ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "registration_attempt_createdAt_idx" ON "registration_attempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "area_id_hospitalId_key" ON "area"("id", "hospitalId");

-- AddForeignKey
ALTER TABLE "donor" ADD CONSTRAINT "donor_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donor" ADD CONSTRAINT "donor_areaId_hospitalId_fkey" FOREIGN KEY ("areaId", "hospitalId") REFERENCES "area"("id", "hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_record_donorId_hospitalId_fkey" FOREIGN KEY ("donorId", "hospitalId") REFERENCES "donor"("id", "hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_record_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_record_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donor_verification" ADD CONSTRAINT "donor_verification_donorId_hospitalId_fkey" FOREIGN KEY ("donorId", "hospitalId") REFERENCES "donor"("id", "hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donor_verification" ADD CONSTRAINT "donor_verification_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_record" ADD CONSTRAINT "eligibility_record_donorId_hospitalId_fkey" FOREIGN KEY ("donorId", "hospitalId") REFERENCES "donor"("id", "hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_record" ADD CONSTRAINT "eligibility_record_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donor_note" ADD CONSTRAINT "donor_note_donorId_hospitalId_fkey" FOREIGN KEY ("donorId", "hospitalId") REFERENCES "donor"("id", "hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donor_note" ADD CONSTRAINT "donor_note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Hand-written integrity rules (not expressible in schema.prisma) ─────────

-- Donor: required text is not blank; phone is stored in E.164.
ALTER TABLE "donor" ADD CONSTRAINT "donor_full_name_not_blank" CHECK (length(btrim("fullName")) > 0);
ALTER TABLE "donor" ADD CONSTRAINT "donor_city_not_blank" CHECK (length(btrim("city")) > 0);
ALTER TABLE "donor" ADD CONSTRAINT "donor_phone_e164" CHECK ("phoneE164" ~ '^\+[1-9][0-9]{6,14}$');

-- Donor: dependent fields exist exactly when their status calls for them.
ALTER TABLE "donor" ADD CONSTRAINT "donor_ineligible_until_consistent"
    CHECK (("ineligibleUntil" IS NOT NULL) = ("eligibilityStatus" = 'TEMPORARILY_INELIGIBLE'));
ALTER TABLE "donor" ADD CONSTRAINT "donor_inactive_reason_consistent"
    CHECK (("inactiveReason" IS NOT NULL) = ("activityStatus" = 'INACTIVE'));
ALTER TABLE "donor" ADD CONSTRAINT "donor_unavailable_until_consistent"
    CHECK ("unavailableUntil" IS NULL OR "availability" = 'UNAVAILABLE');
ALTER TABLE "donor" ADD CONSTRAINT "donor_last_donation_month_is_first_day"
    CHECK ("selfReportedLastDonationMonth" IS NULL OR extract(day FROM "selfReportedLastDonationMonth") = 1);

-- Consent: evidence fields are present; staff entry names the capturing user;
-- withdrawal fields are set together.
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_notice_sha256_format" CHECK ("noticeSha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_notice_version_not_blank" CHECK (length(btrim("noticeVersion")) > 0);
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_captured_by_consistent"
    CHECK (("channel" = 'STAFF_ENTRY') = ("capturedById" IS NOT NULL));
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_withdrawal_consistent"
    CHECK (("withdrawnAt" IS NULL) = ("withdrawnById" IS NULL));

-- At most one active (unwithdrawn) consent per donor and purpose.
CREATE UNIQUE INDEX "consent_record_one_active_per_purpose"
    ON "consent_record" ("donorId", "purpose") WHERE "withdrawnAt" IS NULL;

-- Consent rows are evidence: never deleted, and the only allowed change is
-- recording a withdrawal once.
CREATE FUNCTION "consent_record_guard"() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'consent_record rows cannot be deleted' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF OLD."withdrawnAt" IS NOT NULL
       OR NEW."withdrawnAt" IS NULL
       OR (NEW."id", NEW."hospitalId", NEW."donorId", NEW."purpose", NEW."noticeVersion", NEW."noticeSha256",
           NEW."channel", NEW."capturedById", NEW."grantedAt")
          IS DISTINCT FROM
          (OLD."id", OLD."hospitalId", OLD."donorId", OLD."purpose", OLD."noticeVersion", OLD."noticeSha256",
           OLD."channel", OLD."capturedById", OLD."grantedAt") THEN
        RAISE EXCEPTION 'consent_record only allows recording a withdrawal once' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "consent_record_guard_update_delete"
    BEFORE UPDATE OR DELETE ON "consent_record"
    FOR EACH ROW EXECUTE FUNCTION "consent_record_guard"();

-- Verification decisions need a reason exactly when rejecting.
ALTER TABLE "donor_verification" ADD CONSTRAINT "donor_verification_rejection_reason_consistent"
    CHECK (("rejectionReason" IS NOT NULL) = ("decision" = 'REJECTED'));

-- A temporary deferral carries its until-date; other statuses do not.
ALTER TABLE "eligibility_record" ADD CONSTRAINT "eligibility_record_until_consistent"
    CHECK (("until" IS NOT NULL) = ("status" = 'TEMPORARILY_INELIGIBLE'));

ALTER TABLE "donor_note" ADD CONSTRAINT "donor_note_body_not_blank" CHECK (length(btrim("body")) > 0);

-- Verification and eligibility history are append-only (spec D12).
-- Phase 8 anonymisation will need a controlled exception for the note columns.
CREATE FUNCTION "history_block_mutation"() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% is append-only (% blocked)', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "donor_verification_append_only"
    BEFORE UPDATE OR DELETE ON "donor_verification"
    FOR EACH ROW EXECUTE FUNCTION "history_block_mutation"();

CREATE TRIGGER "eligibility_record_append_only"
    BEFORE UPDATE OR DELETE ON "eligibility_record"
    FOR EACH ROW EXECUTE FUNCTION "history_block_mutation"();

