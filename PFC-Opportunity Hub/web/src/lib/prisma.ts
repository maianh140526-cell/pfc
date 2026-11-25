import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/**
 * Database switch (ADR-005):
 * - TURSO_DATABASE_URL set → Turso (libSQL) through Prisma's driver adapter. Use in production / Vercel.
 * - otherwise              → local SQLite file from DATABASE_URL (development, unchanged).
 * Same schema in both cases (provider "sqlite").
 */
export function createPrismaClient(): PrismaClient {
  const log: ("error" | "warn")[] = process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) {
    const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined });
    return new PrismaClient({ adapter, log });
  }
  return new PrismaClient({ log });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
