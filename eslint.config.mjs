import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "src/generated/**", "playwright-report/**", "test-results/**"]),
  {
    // Architecture guard: only the server layer may touch Prisma.
    files: ["src/app/**", "src/components/**", "src/features/**/components/**", "src/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/generated/prisma", "@/generated/prisma/*"], message: "Prisma is only used inside src/server." },
            { group: ["@/server/db", "@/server/db-client"], message: "Use src/server/queries or services, not the DB client." },
          ],
        },
      ],
    },
  },
]);
