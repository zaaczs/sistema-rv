import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { normalizePhone, validatePhone } from "@/lib/phone";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";

  const searchWhere = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const list = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      ...searchWhere,
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let body: { name: string; phone?: string; customerType?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { name, phone, customerType = "RETAIL", notes } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const phoneError = validatePhone(phone);
  if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 });

  const customer = await prisma.customer.create({
    data: {
      name: name.trim(),
      phone: normalizePhone(phone),
      customerType: (customerType as "RETAIL" | "WHOLESALE" | "MIXED") || "RETAIL",
      notes: notes?.trim() ?? null,
    },
  });

  await writeAuditLog({
    entity: "Customer",
    entityId: customer.id,
    action: "CREATE",
    session,
    metadata: { customerType: customer.customerType },
  });

  return NextResponse.json(customer);
}
