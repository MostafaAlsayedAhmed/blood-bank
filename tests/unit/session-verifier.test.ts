import { describe, expect, it, vi } from "vitest";
import { createSessionVerifier, type ActiveMembership } from "@/server/auth/session-verifier";

const membership: ActiveMembership = { hospitalId: "h1", hospitalName: "Test Hospital", role: "STAFF" };

function verifierWith(user: { id: string; name: string } | null, memberships: ActiveMembership[]) {
  const onAmbiguousMembership = vi.fn();
  const verifier = createSessionVerifier({
    getSessionUser: async () => user,
    loadActiveMemberships: async () => memberships,
    onAmbiguousMembership,
  });
  return { ...verifier, onAmbiguousMembership };
}

describe("verifySession", () => {
  it("rejects a request without a session as UNAUTHENTICATED", async () => {
    const { verifySession } = verifierWith(null, [membership]);
    await expect(verifySession()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rejects a signed-in user without an active membership as FORBIDDEN", async () => {
    const { verifySession } = verifierWith({ id: "u1", name: "Dev" }, []);
    await expect(verifySession()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects several active memberships (hospital selection not in MVP)", async () => {
    const { verifySession, onAmbiguousMembership } = verifierWith({ id: "u1", name: "Dev" }, [
      membership,
      { ...membership, hospitalId: "h2" },
    ]);
    await expect(verifySession()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(onAmbiguousMembership).toHaveBeenCalledTimes(1);
  });

  it("returns a hospital-scoped context for one active membership", async () => {
    const { verifySession } = verifierWith({ id: "u1", name: "Dev" }, [membership]);
    await expect(verifySession()).resolves.toMatchObject({
      userId: "u1",
      hospitalId: "h1",
      role: "STAFF",
    });
  });
});

describe("requirePermission", () => {
  it("allows a role that has the permission", async () => {
    const { requirePermission } = verifierWith({ id: "u1", name: "Dev" }, [membership]);
    await expect(requirePermission("donor:verify")).resolves.toMatchObject({ role: "STAFF" });
  });

  it("denies a role that lacks the permission", async () => {
    const { requirePermission } = verifierWith({ id: "u1", name: "Dev" }, [membership]);
    await expect(requirePermission("audit:read")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("checks the session before the permission", async () => {
    const { requirePermission } = verifierWith(null, []);
    await expect(requirePermission("dashboard:read")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
