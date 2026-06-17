import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const member = await prisma.clubMember.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: true,
      pointHistory: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!member) return NextResponse.json({ error: "Membro do clube não encontrado" }, { status: 404 });

  return NextResponse.json(member);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.clubMember.findFirst({
    where: { id, deletedAt: null },
    include: { customer: true },
  });
  if (!existing) return NextResponse.json({ error: "Membro do clube não encontrado" }, { status: 404 });

  await prisma.clubMember.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await writeAuditLog({
    entity: "ClubMember",
    entityId: id,
    action: "DELETE",
    session,
    metadata: { customerId: existing.customerId, customerName: existing.customer.name },
  });

  return NextResponse.json({ ok: true });
}
