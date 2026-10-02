import type { Locale } from "@/i18n/config";

/**
 * Privacy notice versioning (spec D13). The notice and consent wording live in
 * messages/<locale>.json under "privacyNotice". Every ConsentRecord stores the
 * version and the SHA-256 of the exact text the donor saw, in the language shown.
 * Each language is pinned separately; the hash therefore also identifies the language.
 *
 * Changing the wording without bumping the version is a build error: the server
 * refuses to record consent when the computed hash is not the one pinned here,
 * and tests/unit/privacy-notice.test.ts fails first.
 *
 * Legal/Compliance L3/L4: the current text is a DRAFT pending legal approval.
 * Fictional data only until it is approved (A11).
 */
export const PRIVACY_NOTICE_VERSION = "2026-10-draft-1";

export const PRIVACY_NOTICE_SHA256: Readonly<Record<string, Readonly<Record<Locale, string>>>> = {
  "2026-10-draft-1": {
    ar: "05648291e7d6f118970c2854d2ab16e410ba2bb59e4f06021fe02c66e173b1ea",
    en: "a936797c1bfbc1145387f5b335200a21e1530a8a346d0c6cf135e9240b52ed71",
  },
};
