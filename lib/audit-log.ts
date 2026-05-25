import type { Session } from "next-auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "IMPORT" | "BACKUP";

type AuditInput = {
  entity: string;
  entityId: string;
  action: AuditAction;
  session?: Session | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditInput) {
  try {
    const actor = input.session?.user as { id?: string; email?: string } | undefined;
    await prisma.auditLog.create({
      data: {
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? null,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (error) {
    console.error("Falha ao registrar auditoria:", error);
  }
}
