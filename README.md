# Queseir Hospital Blood Bank — Donor Management System

Internal tool for blood-bank staff: donor registry → review → verification → eligibility → blood request → matching → contact → donation → history, with an audit trail.

The full design is in [`docs/mvp-technical-spec.md`](docs/mvp-technical-spec.md). **Status: Phase 1 (foundation).** Staff can sign in and out, dashboard routes are protected, and the permission and audit foundations are in place. Donor and request workflows arrive in Phases 2–7.

> Development uses **fictional data only**. Real donor data needs the legal gates in spec §11 / L1–L4 to be cleared (PDPL licence, hosting location, DPO, consent wording).

## Stack

Next.js 16 (App Router) · React 19.2 · TypeScript · Tailwind CSS 4 · shadcn/ui conventions · PostgreSQL 18 · Prisma 7 · Better Auth 1.7 · Zod 4 · next-intl 4 · Vitest 5 · Playwright.

Versions in `package.json` come from vendor release notes (Oct 2026). Confirm with `pnpm outdated` after the first install, then commit `pnpm-lock.yaml`.

## Setup

Requires Node ≥ 20.19, pnpm 10 and Docker.

```bash
pnpm install                 # also runs `prisma generate`
cp .env.example .env         # fill BETTER_AUTH_SECRET (openssl rand -base64 32) and SEED_STAFF_PASSWORD
pnpm db:up                   # PostgreSQL 18 in Docker
pnpm db:deploy               # apply migrations
pnpm db:seed                 # 1 hospital, 3 placeholder areas, 3 staff accounts
pnpm dev                     # http://localhost:3000
```

Seeded logins (password = `SEED_STAFF_PASSWORD`): `admin@bloodbank.test` (ADMIN), `staff@bloodbank.test` (STAFF), `viewer@bloodbank.test` (VIEWER).

### First-install checks

This code was written in an environment without package-registry access, so these steps have not run yet. Do them once and fix anything they report:

1. `pnpm typecheck && pnpm lint && pnpm test`
2. `npx auth generate --output /tmp/ba-schema.prisma` and compare it with the Better Auth models in `prisma/schema.prisma`. If 1.7 differs, adopt its models and add a migration.
3. `pnpm db:check-drift` (needs `SHADOW_DATABASE_URL`) must report no difference between `schema.prisma` and the hand-written init migration.
4. `pnpm test:integration` (Docker) and `pnpm build && pnpm test:e2e`.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SHADOW_DATABASE_URL` | Empty database used only by `db:check-drift` |
| `BETTER_AUTH_SECRET` | Session signing secret; unique per environment |
| `BETTER_AUTH_URL` | Public base URL; also the only trusted origin |
| `SEED_STAFF_PASSWORD` | Dev seed only (≥ 12 chars); the seed refuses `NODE_ENV=production` |

## Database

- Prisma 7: config in `prisma.config.ts`, client generated to `src/generated/prisma` (git-ignored), `pg` driver adapter.
- Migrations live in `prisma/migrations`. Create new ones with `pnpm db:migrate --create-only`, then add hand-written SQL (CHECKs, partial indexes, triggers) before applying.
- `audit_log` is append-only. A trigger blocks UPDATE, DELETE and TRUNCATE. CHECK constraints enforce the action-name format, object metadata and actor consistency.
- Phase 1 tables: `hospital`, `area`, `staff_membership`, `audit_log`, plus Better Auth's `user`, `session`, `account`, `verification`.

## Architecture (Phase 1 pieces)

| Layer | Location | Rule |
|---|---|---|
| Pure domain | `src/domain` | No I/O. Permissions, error codes, audit action names, PII key list |
| DAL | `src/server/auth/dal.ts` | `verifySession`, `requirePermission`, `requirePagePermission`. Every page, action and route handler calls one |
| Action runner | `src/server/actions` | `runAction({ permission, schema, handler }, input)`: auth → Zod → handler → `ActionResult` |
| Services | `src/server/services` | `recordAudit(tx, entry)` runs in the same transaction as the change; rejects PII metadata keys |
| Proxy | `src/proxy.ts` | Cookie-presence redirect to `/login` only. No DB, no authorization |
| UI | `src/app`, `src/features/*/components`, `src/components` | No Prisma imports (ESLint-enforced) |

Roles and permissions: `src/domain/auth/permissions.ts` (spec §7). The application role is on `StaffMembership`; Better Auth's `user.role` is only `admin`/`user`.

## Tests

```bash
pnpm test               # unit: permission matrix, session verifier, action runner, privacy guards
pnpm test:integration   # Testcontainers postgres:18: migrations + audit-log integrity
pnpm test:e2e           # Playwright: redirect, bad credentials, sign-in/out (needs seeded DB + build)
```

## Phase 1 decisions and open items

- **Technical Decision:** Phase 1 creates only foundation tables. *Reason:* donor/request enums depend on O1, M2 and M7. *Tradeoff:* each later phase adds a migration.
- **Technical Decision:** English only, without locale routing. All strings are in `messages/en.json`, and `dir`/RTL is wired in the root layout. *Tradeoff:* Arabic (O6) adds locale routing in Phase 2.
- **Technical Decision:** shadcn primitives (`button`, `input`, `label`, `card`) are hand-written in shadcn style with no Radix dependency yet. Later components come from `pnpm dlx shadcn@latest add …`.
- **Assumption (O9):** sessions last 8 h and refresh hourly.
- **Assumption (A14):** staff passwords are ≥ 12 characters.
- **Assumption:** login rate limiting uses Better Auth's in-memory store, which is valid for a single instance. Phase 8 moves it to the database.
- **Open Question O5:** the seeded areas are placeholders ("Dev Area North/Center/South").
- Login and logout are audited (`auth.login` via a Better Auth DB hook, `auth.logout` in the sign-out action). Failed logins are not audited yet.

## Never commit

`.env*` (except `.env.example`), secrets, real donor data, production credentials.
