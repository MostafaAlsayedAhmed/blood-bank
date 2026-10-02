import { describe, expect, it } from "vitest";
import messages from "../../messages/en.json";
import { PRIVACY_NOTICE_SHA256, PRIVACY_NOTICE_VERSION } from "@/domain/consent/notice";
import { computeNoticeSha256, currentNoticeEvidence } from "@/server/services/privacy-notice";

describe("privacy notice versioning (D13)", () => {
  it("pins the hash of the current notice text to its version", () => {
    // If this fails, the notice wording changed: bump PRIVACY_NOTICE_VERSION and add
    // the new hash. Consent rows must always point at the exact text the donor saw.
    expect(PRIVACY_NOTICE_SHA256[PRIVACY_NOTICE_VERSION]).toBe(computeNoticeSha256());
  });

  it("returns version and hash as consent evidence", () => {
    expect(currentNoticeEvidence()).toEqual({
      noticeVersion: PRIVACY_NOTICE_VERSION,
      noticeSha256: computeNoticeSha256(),
    });
  });

  it("detects any change to the wording", () => {
    const edited = { ...messages.privacyNotice, consentContact: `${messages.privacyNotice.consentContact} ` };
    expect(computeNoticeSha256(edited)).not.toBe(computeNoticeSha256());
  });
});
