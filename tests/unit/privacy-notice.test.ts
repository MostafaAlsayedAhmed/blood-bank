import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import { PRIVACY_NOTICE_SHA256, PRIVACY_NOTICE_VERSION } from "@/domain/consent/notice";
import { LOCALES } from "@/i18n/config";
import { computeNoticeSha256, currentNoticeEvidence } from "@/server/services/privacy-notice";

describe("privacy notice versioning (D13)", () => {
  it.each(LOCALES)("pins the hash of the current %s notice text to its version", (locale) => {
    // If this fails, the notice wording changed: bump PRIVACY_NOTICE_VERSION and pin
    // the new hashes. Consent rows must always point at the exact text the donor saw.
    expect(PRIVACY_NOTICE_SHA256[PRIVACY_NOTICE_VERSION]?.[locale]).toBe(computeNoticeSha256(locale));
  });

  it.each(LOCALES)("returns version and the %s hash as consent evidence", (locale) => {
    expect(currentNoticeEvidence(locale)).toEqual({
      noticeVersion: PRIVACY_NOTICE_VERSION,
      noticeSha256: computeNoticeSha256(locale),
    });
  });

  it("distinguishes the languages, so the hash identifies the text shown", () => {
    expect(computeNoticeSha256("ar")).not.toBe(computeNoticeSha256("en"));
  });

  it("detects any change to the wording", () => {
    const edited = { ...en.privacyNotice, consentContact: `${en.privacyNotice.consentContact} ` };
    expect(computeNoticeSha256("en", edited)).not.toBe(computeNoticeSha256("en"));
  });
});
