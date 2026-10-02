import "server-only";
import { createPrismaClient, type Db } from "@/server/db-client";

// Reuse one client across hot reloads in development.
const globalForDb = globalThis as unknown as { __bloodBankDb?: Db };

export const db: Db = globalForDb.__bloodBankDb ?? createPrismaClient(process.env.DATABASE_URL);

if (process.env.NODE_ENV !== "production") globalForDb.__bloodBankDb = db;
