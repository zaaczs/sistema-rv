import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { calcularCategoria } from "@/lib/clube-rv-girls";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let body: { customerId: string; pontos: number; motivo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { customerId, motivo } = body;
  const pontos = Math.floor(Number(body.pontos));

  if (!customerId?.trim()) {
    return NextResponse.json({ error: "Cliente é obrigatório" }, { status: 400 });
  }
  if (!Number.isFinite(pontos) || pontos === 0) {
    return NextResponse.json(
      { error: "Informe uma quantidade de pontos válida (diferente de zero)" },
      { status: 400 }
    );
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, deletedAt: null },
  });
  if (!customer) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  let member = await prisma.clubMember.findFirst({
    where: { customerId, deletedAt: null },
  });

  if (!member) {
    member = await prisma.clubMember.create({
      data: {
        customerId,
        pontosTotal: 0,
        categoriaAtual: "MUSA_RV",
      },
    });

    await writeAuditLog({
      entity: "ClubMember",
      entityId: member.id,
      action: "CREATE",
      session,
      metadata: { customerId, via: "pontos" },
    });
  }

  const novoTotal = member.pontosTotal + pontos;
  if (novoTotal < 0) {
    return NextResponse.json(
      { error: `Não é possível remover ${Math.abs(pontos)} pontos. Total atual: ${member.pontosTotal}` },
      { status: 400 }
    );
  }

  const categoriaAnterior = member.categoriaAtual;
  const categoriaAtual = calcularCategoria(novoTotal);

  const [updated] = await prisma.$transaction([
    prisma.clubMember.update({
      where: { id: member.id },
      data: { pontosTotal: novoTotal, categoriaAtual },
    }),
    prisma.clubPointHistory.create({
      data: {
        clubMemberId: member.id,
        pontosAdicionados: pontos,
        motivo: motivo?.trim() ?? null,
      },
    }),
  ]);

  await writeAuditLog({
    entity: "ClubMember",
    entityId: member.id,
    action: "UPDATE",
    session,
    metadata: {
      customerId,
      pontosAdicionados: pontos,
      pontosTotal: novoTotal,
      categoriaAnterior,
      categoriaAtual,
      motivo: motivo?.trim() ?? null,
    },
  });

  return NextResponse.json({
    customerId,
    clubMemberId: updated.id,
    pontosTotal: updated.pontosTotal,
    categoriaAtual: updated.categoriaAtual,
    categoriaMudou: categoriaAnterior !== categoriaAtual,
    categoriaAnterior,
    customerName: customer.name,
  });
}
