import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

// Em produção (Vercel/serverless) também reutiliza a instância no warm container;
// evita estourar conexões no pooler do Supabase.
globalForPrisma.prisma = prisma;
