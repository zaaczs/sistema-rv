import { Prisma } from "@prisma/client";

function isTransientDbError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    const retryable = new Set([
      "P1001", // Can't reach database
      "P1002", // DB server unreachable
      "P1017", // Server closed connection
      "P2024", // Timed out fetching connection from pool
    ]);
    return retryable.has(e.code);
  }
  if (e instanceof Prisma.PrismaClientInitializationError) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("Can't reach database") ||
    msg.includes("connection pool") ||
    msg.includes("Timed out fetching") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("EAI_AGAIN")
  );
}

export async function withDbRetry<T>(fn: () => Promise<T>, options?: { attempts?: number; baseDelayMs?: number }): Promise<T> {
  const attempts = options?.attempts ?? 4;
  const base = options?.baseDelayMs ?? 400;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isTransientDbError(e) || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, base * Math.pow(2, i)));
    }
  }
  throw last;
}
