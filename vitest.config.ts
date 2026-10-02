import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));
const emptyModule = fileURLToPath(new URL("./tests/support/empty-module.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src,
      // `server-only` throws outside the React Server condition; tests import server modules directly.
      "server-only": emptyModule,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          hookTimeout: 120_000,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
