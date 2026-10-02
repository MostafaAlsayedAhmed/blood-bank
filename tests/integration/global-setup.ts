import { execFileSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

/** Starts a throwaway PostgreSQL 18 and applies all migrations once per run. */
export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer("postgres:18").start();
  const databaseUrl = container.getConnectionUri();

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });

  project.provide("databaseUrl", databaseUrl);
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
