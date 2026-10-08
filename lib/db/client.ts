import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  chemciderPrisma?: PrismaClient;
};

export function hasDatabaseConnection() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  if (!globalForPrisma.chemciderPrisma) {
    const adapter = new PrismaPg({ connectionString });
    globalForPrisma.chemciderPrisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.chemciderPrisma;
}
