# CLAUDE.md — Queseir Hospital Blood Bank (Donor Management MVP)

You are the senior engineer on an internal blood-donor management system for the Queseir Hospital Blood Bank, Egypt. Single hospital now; multi-hospital later (every row carries `hospitalId`, sourced from the session, never from client input).

**Source of truth:** `docs/mvp-technical-spec.md`. Read the relevant section before changing behaviour. Section numbers below refer to it.

## Core workflow (optimize for this; question anything outside it)

Register → Review → Verify → Eligibility → Donor pool → Blood request → Matching → Contact → Confirmation → Donation → History, with audit throughout. The Definition of Done is the 17-step journey in spec §15 / brief §36.

## Current status

- **Phase 1 (foundation): written, not yet run.** It was built without registry access, so first do the README "First-install checks": `pnpm install`, typecheck, lint, unit tests, `npx auth generate` vs the Better Auth models in `prisma/schema.prisma`, `pnpm db:check-drift`, integration + e2e. Fix what breaks with the smallest change, then commit `pnpm-lock.yaml`.
- **Next: Phase 2**: public `/register` + `/privacy` + ConsentRecord, pending-review queue, donor list/search/filters, profile, create/edit, verification, eligibility records, availability/activity, notes, masked phone + read audit, consent withdrawal (spec §15).

## Non-negotiables

1. **Never invent medical rules.** This covers compatibility tables, eligibility, donation intervals, deferrals and age limits. They live in `src/config/medical-rules` as an approved, versioned ruleset (spec §8). With none approved, matching returns `RULES_NOT_CONFIGURED`. Tests use deliberately synthetic rulesets. Unknown rule → label it **Medical Rule Required** and stop.
2. Self-reported blood group ≠ verified. Public registrations start `PENDING` / `UNASSESSED`.
3. Donor state is three separate fields: `verificationStatus`, `eligibilityStatus`, `activityStatus` (+ `availability`). A match outcome never changes donor global status.
4. **Authorization is server-side in the DAL** (`src/server/auth/dal.ts`). Every page calls `requirePagePermission`. Every Server Action goes through `runAction({ permission, schema, handler }, input)`. Every route handler calls `requirePermission`. `src/proxy.ts` is a cookie-presence redirect only. Layouts make no auth decisions.
5. Permissions come only from `src/domain/auth/permissions.ts` (spec §7). Changes there must match the spec and `tests/unit/permissions.test.ts`.
6. Audit every important write with `recordAudit(tx, …)` in the **same transaction**. Action names go in `src/domain/audit/actions.ts`. Metadata holds ids, field names and status values only, never PII. `audit_log` is append-only (DB trigger).
7. Privacy (Egypt PDPL, Law 8/2021): no PII in logs (use `src/lib/logger.ts`), URLs, audit metadata or client console. Phones are masked in lists, and a reveal is audited. Fictional data only until legal gates L1–L4 clear. Never commit `.env*`, secrets or real donor data.
8. Validate with Zod on the server, always. Schemas live once in `src/domain/*/schemas.ts`.

## Architecture

- `src/domain`: pure TS, no I/O (state machines, matching, schemas, errors). Unit-tested.
- `src/server`: Prisma, DAL, services, actions. Only this layer imports the DB client (ESLint-enforced).
- `src/features/<feature>/{components,actions.ts}`: UI + thin Server Actions.
- `src/app`: routes. `(auth)`, `(dashboard)`, later `(public)`.
- All UI strings are in `messages/en.json` (Arabic later, O6). No hard-coded text in business logic.
- DB: Prisma 7 (`prisma.config.ts`, generated client in `src/generated/prisma`, pg adapter). New migration = `pnpm db:migrate --create-only`, then add CHECKs, partial indexes and triggers by hand. Guarded updates (`WHERE status = :expected`) for state transitions.

## Commands

`pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm test:integration` (Docker) · `pnpm test:e2e` · `pnpm db:up|deploy|migrate|seed|check-drift`

## Working style (owner's preferences)

- Direct and technical. For significant decisions give **Decision / Reason / Tradeoff**.
- Label uncertainty as **Assumption / Open Question / Medical Rule Required / Technical Decision**. Never present an assumption as a requirement. Open questions are tracked in spec §14 (M1–M8, O1–O12, L1–L11).
- Work phase by phase. Focused conventional commits (`feat: add donor registration`).
- At the end of a task, summarize: what changed, files affected, database changes, tests added, anything the owner needs to do.
- Priority order: safety/privacy > medical correctness > data integrity > core workflow > usability > maintainability > performance > polish > extensibility.
