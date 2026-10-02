import { describe, expect, it, vi } from "vitest";
import * as z from "zod";
import { DomainError } from "@/domain/errors";
import { createActionRunner } from "@/server/actions/action-runner";
import type { AuthContext } from "@/server/auth/session-verifier";

const ctx = { userId: "u1", name: "Dev", hospitalId: "h1", hospitalName: "H", role: "STAFF" } as AuthContext;
const schema = z.object({ units: z.number().int().positive() });

function runnerWith(requirePermission: () => Promise<AuthContext>) {
  const logger = { error: vi.fn() };
  return { runAction: createActionRunner({ requirePermission, logger }), logger };
}

describe("runAction", () => {
  it("returns UNAUTHENTICATED without a session and never runs the handler", async () => {
    const handler = vi.fn();
    const { runAction } = runnerWith(async () => {
      throw new DomainError("UNAUTHENTICATED");
    });

    const result = await runAction({ permission: "request:write", schema, handler }, { units: -1 });

    // Authorization precedes validation: no field errors leak to an anonymous caller.
    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when the role lacks the permission", async () => {
    const { runAction } = runnerWith(async () => {
      throw new DomainError("FORBIDDEN");
    });
    const result = await runAction({ permission: "audit:read", schema, handler: vi.fn() }, { units: 1 });
    expect(result).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("returns VALIDATION with field errors for bad input", async () => {
    const handler = vi.fn();
    const { runAction } = runnerWith(async () => ctx);
    const result = await runAction({ permission: "request:write", schema, handler }, { units: 0 });
    expect(result).toMatchObject({ ok: false, error: "VALIDATION" });
    expect(result.ok === false && result.fieldErrors?.units?.length).toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes the auth context and parsed input to the handler", async () => {
    const { runAction } = runnerWith(async () => ctx);
    const result = await runAction(
      { permission: "request:write", schema, handler: async (c, input) => ({ hospitalId: c.hospitalId, units: input.units }) },
      { units: 2 },
    );
    expect(result).toEqual({ ok: true, data: { hospitalId: "h1", units: 2 } });
  });

  it("maps domain errors raised by the handler to their code", async () => {
    const { runAction } = runnerWith(async () => ctx);
    const result = await runAction(
      {
        permission: "request:write",
        schema,
        handler: async () => {
          throw new DomainError("INVALID_TRANSITION");
        },
      },
      { units: 1 },
    );
    expect(result).toEqual({ ok: false, error: "INVALID_TRANSITION" });
  });

  it("hides unexpected errors as INTERNAL and logs them", async () => {
    const { runAction, logger } = runnerWith(async () => ctx);
    const result = await runAction(
      {
        permission: "request:write",
        schema,
        handler: async () => {
          throw new Error("db connection refused");
        },
      },
      { units: 1 },
    );
    expect(result).toEqual({ ok: false, error: "INTERNAL" });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
