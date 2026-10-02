import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env automatically; dotenv is imported explicitly above.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Prisma 7 does not seed after migrate; run `pnpm db:seed` explicitly.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Not env("DATABASE_URL"): that throws at config load, which breaks `prisma generate`
    // (postinstall) on a fresh clone with no .env. Commands that connect still fail clearly.
    url: process.env.DATABASE_URL,
    // Only needed by `pnpm db:check-drift` (prisma migrate diff --from-migrations).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
