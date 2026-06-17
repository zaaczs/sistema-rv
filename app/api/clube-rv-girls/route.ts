import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calcularCategoria, type ClubeClienteRow } from "@/lib/clube-rv-girls";

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

  const customers = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      ...searchWhere,
    },
    include: {
      clubMember: {
        where: { deletedAt: null },
      },
    },
    orderBy: { name: "asc" },
  });

  const list: ClubeClienteRow[] = customers
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      customerType: customer.customerType,
      pontosTotal: customer.clubMember?.pontosTotal ?? 0,
      categoriaAtual: calcularCategoria(customer.clubMember?.pontosTotal ?? 0),
      clubMemberId: customer.clubMember?.id ?? null,
    }))
    .sort((a, b) => {
      if (b.pontosTotal !== a.pontosTotal) return b.pontosTotal - a.pontosTotal;
      return a.name.localeCompare(b.name, "pt-BR");
    });

  return NextResponse.json(list);
}
