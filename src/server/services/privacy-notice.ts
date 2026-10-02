import { createHash } from "node:crypto";
import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { PRIVACY_NOTICE_SHA256, PRIVACY_NOTICE_VERSION } from "@/domain/consent/notice";
import { DomainError } from "@/domain/errors";
import type { Locale } from "@/i18n/config";

export type NoticeEvidence = { noticeVersion: string; noticeSha256: string };

const NOTICES: Readonly<Record<Locale, unknown>> = { ar: ar.privacyNotice, en: en.privacyNotice };

/** SHA-256 of the notice text exactly as shown in one language (its "privacyNotice" message block). */
export function computeNoticeSha256(locale: Locale, notice: unknown = NOTICES[locale]): string {
  return createHash("sha256").update(JSON.stringify(notice), "utf8").digest("hex");
}

/**
 * Version and hash to store on a ConsentRecord, for the language the donor saw.
 * Fails closed: if the wording changed without a version bump, no consent can be
 * recorded against it.
 */
export function currentNoticeEvidence(locale: Locale): NoticeEvidence {
  const noticeSha256 = computeNoticeSha256(locale);
  if (PRIVACY_NOTICE_SHA256[PRIVACY_NOTICE_VERSION]?.[locale] !== noticeSha256) {
    throw new DomainError("INTERNAL", `privacy notice (${locale}) changed without a version bump`);
  }
  return { noticeVersion: PRIVACY_NOTICE_VERSION, noticeSha256 };
}
