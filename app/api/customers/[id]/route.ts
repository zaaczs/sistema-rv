import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { normalizePhone, validatePhone } from "@/lib/phone";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  let body: { name?: string; phone?: string; customerType?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const customer = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!customer) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.phone !== undefined) {
    const phoneError = validatePhone(body.phone);
    if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 });
    data.phone = normalizePhone(body.phone);
  }
  if (body.customerType !== undefined) data.customerType = body.customerType;
  if (body.notes !== undefined) data.notes = body.notes?.trim() ?? null;

  const updated = await prisma.customer.update({
    where: { id },
    data: data as never,
  });

  await writeAuditLog({
    entity: "Customer",
    entityId: id,
    action: "UPDATE",
    session,
    metadata: { changedFields: Object.keys(data) },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await writeAuditLog({
    entity: "Customer",
    entityId: id,
    action: "DELETE",
    session,
  });

  return NextResponse.json({ ok: true });
}
