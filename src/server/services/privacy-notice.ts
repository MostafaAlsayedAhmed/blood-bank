import { createHash } from "node:crypto";
import messages from "../../../messages/en.json";
import { PRIVACY_NOTICE_SHA256, PRIVACY_NOTICE_VERSION } from "@/domain/consent/notice";
import { DomainError } from "@/domain/errors";

export type NoticeEvidence = { noticeVersion: string; noticeSha256: string };

/** SHA-256 of the notice text exactly as shown (the "privacyNotice" message block). */
export function computeNoticeSha256(notice: unknown = messages.privacyNotice): string {
  return createHash("sha256").update(JSON.stringify(notice), "utf8").digest("hex");
}

/**
 * Version and hash to store on a ConsentRecord. Fails closed: if the wording
 * changed without a version bump, no consent can be recorded against it.
 */
export function currentNoticeEvidence(): NoticeEvidence {
  const noticeSha256 = computeNoticeSha256();
  if (PRIVACY_NOTICE_SHA256[PRIVACY_NOTICE_VERSION] !== noticeSha256) {
    throw new DomainError("INTERNAL", "privacy notice text changed without a version bump");
  }
  return { noticeVersion: PRIVACY_NOTICE_VERSION, noticeSha256 };
}
