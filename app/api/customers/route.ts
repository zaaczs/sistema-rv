import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const list = await prisma.customer.findMany({
    where,
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

  const customer = await prisma.customer.create({
    data: {
      name: name.trim(),
      phone: phone?.trim() ?? null,
      customerType: (customerType as "RETAIL" | "WHOLESALE" | "MIXED") || "RETAIL",
      notes: notes?.trim() ?? null,
    },
  });
  return NextResponse.json(customer);
}
