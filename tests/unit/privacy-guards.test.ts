import { describe, expect, it } from "vitest";
import { assertSafeAuditMetadata } from "@/domain/audit/metadata";
import { redact } from "@/lib/logger";

describe("audit metadata guard", () => {
  it("accepts ids, field names and status values", () => {
    expect(() =>
      assertSafeAuditMetadata({ donorId: "d1", changedFields: ["availability"], from: "PENDING", to: "VERIFIED" }),
    ).not.toThrow();
  });

  it.each(["phone", "fullName", "notes", "email", "phone_e164", "Date-Of-Birth"])("rejects PII key %s", (key) => {
    expect(() => assertSafeAuditMetadata({ [key]: "x" })).toThrow();
  });

  it("rejects nested objects", () => {
    expect(() => assertSafeAuditMetadata({ donor: { id: "d1" } } as never)).toThrow();
  });
});

describe("logger redaction", () => {
  it("redacts PII keys at any depth", () => {
    expect(
      redact({ userId: "u1", phone: "+201000000000", donor: { fullName: "Test Person", status: "PENDING" } }),
    ).toEqual({ userId: "u1", phone: "[REDACTED]", donor: { fullName: "[REDACTED]", status: "PENDING" } });
  });

  it("redacts inside arrays", () => {
    expect(redact([{ email: "a@b.test" }])).toEqual([{ email: "[REDACTED]" }]);
  });

  it("reduces errors to name and a bounded message", () => {
    expect(redact({ error: new Error("boom") })).toEqual({ error: { name: "Error", message: "boom" } });
  });
});
