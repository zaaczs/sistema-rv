import { PrismaClient } from "@prisma/client";
import { augmentDatabaseUrlForPooler } from "@/lib/augment-database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseUrl = augmentDatabaseUrlForPooler(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
    datasources: databaseUrl
      ? {
          db: { url: databaseUrl },
        }
      : undefined,
  });

// Em produção (Vercel/serverless) também reutiliza a instância no warm container;
// evita estourar conexões no pooler do Supabase.
globalForPrisma.prisma = prisma;
