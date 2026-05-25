import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { writeAuditLog } from "@/lib/audit-log";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  let body: {
    name?: string;
    collectionId?: string;
    tecido?: string;
    custoUnitario?: number;
    lucroVarejo?: number;
    lucroAtacado?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  const data: Record<string, unknown> = {};
  const custo = body.custoUnitario ?? Number(product.custoUnitario);
  const lucroVarejo = body.lucroVarejo ?? Number(product.lucroVarejo);
  const lucroAtacado = body.lucroAtacado ?? Number(product.lucroAtacado);

  if ([custo, lucroVarejo, lucroAtacado].some((v) => v < 0)) {
    return NextResponse.json({ error: "Custo e lucros devem ser maiores ou iguais a 0." }, { status: 400 });
  }

  if (body.name !== undefined) data.name = body.name.trim();
  if (body.collectionId !== undefined) data.collectionId = body.collectionId;
  if (body.tecido !== undefined) data.tecido = body.tecido.trim().toUpperCase();
  if (body.custoUnitario !== undefined) data.custoUnitario = new Decimal(custo);
  if (body.lucroVarejo !== undefined) data.lucroVarejo = new Decimal(lucroVarejo);
  if (body.lucroAtacado !== undefined) data.lucroAtacado = new Decimal(lucroAtacado);

  data.precoVarejo = new Decimal(custo + lucroVarejo);
  data.precoAtacado = new Decimal(custo + lucroAtacado);

  const updated = await prisma.product.update({
    where: { id },
    data: data as never,
    include: { collection: true },
  });

  await writeAuditLog({
    entity: "Product",
    entityId: id,
    action: "UPDATE",
    session,
    metadata: { changedFields: Object.keys(data) },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    collectionId: updated.collectionId,
    collectionName: updated.collection.name,
    tecido: updated.tecido,
    custoUnitario: Number(updated.custoUnitario),
    lucroVarejo: Number(updated.lucroVarejo),
    lucroAtacado: Number(updated.lucroAtacado),
    precoVarejo: Number(updated.precoVarejo),
    precoAtacado: Number(updated.precoAtacado),
  });
}
