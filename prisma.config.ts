import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer loads .env automatically; dotenv is imported explicitly above.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Prisma 7 does not seed after migrate; run `pnpm db:seed` explicitly.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // Only needed by `pnpm db:check-drift` (prisma migrate diff --from-migrations).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
