import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { withDbRetry } from "@/lib/db-retry";

type UpdateStockBody = {
  referencia?: string;
  modeloId?: string;
  tecido?: string;
  cor?: string;
  tamanho?: string;
  quantidade?: number;
  ativo?: boolean;
};

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id } = await params;
    let body: UpdateStockBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const existing = await withDbRetry(() =>
      prisma.sku.findUnique({
        where: { id },
        include: { product: true },
      }),
    );

    if (!existing) {
      return NextResponse.json({ error: "Item de estoque não encontrado." }, { status: 404 });
    }

    const nextModelId = body.modeloId?.trim() || existing.productId;
    const nextFabric = body.tecido?.trim() || existing.product.tecido;
    const nextReference = body.referencia?.trim() || existing.skuCode;
    const nextColor = body.cor?.trim() || existing.color;
    const nextSize = body.tamanho?.trim() || existing.size;

    if (!nextReference || !nextModelId || !nextFabric || !nextColor || !nextSize) {
      return NextResponse.json(
        { error: "Preencha modelo, tecido, referência, cor e tamanho." },
        { status: 400 },
      );
    }

    const quantity = body.quantidade === undefined ? existing.stockQty : Number(body.quantidade);
    if (!Number.isFinite(quantity) || quantity < 0) {
      return NextResponse.json({ error: "Quantidade inválida." }, { status: 400 });
    }

    const nextProduct =
      nextModelId === existing.productId
        ? existing.product
        : await withDbRetry(() => prisma.product.findUnique({ where: { id: nextModelId } }));

    if (!nextProduct) {
      return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });
    }
    const fabricNormalized = nextFabric.toUpperCase();

    const updated = await withDbRetry(() =>
      prisma.sku.update({
        where: { id },
        data: {
          skuCode: nextReference.toUpperCase(),
          productId: nextModelId,
          color: nextColor.toUpperCase(),
          size: nextSize.toUpperCase(),
          stockQty: Math.floor(quantity),
          active: body.ativo ?? existing.active,
          costPrice: new Decimal(nextProduct.custoUnitario),
          retailPrice: new Decimal(nextProduct.precoVarejo),
          wholesalePrice: new Decimal(nextProduct.precoAtacado),
        },
        include: { product: true },
      }),
    );

    return NextResponse.json({
      id: updated.id,
      referencia: updated.skuCode,
      modeloId: updated.productId,
      modelo: updated.product.name,
      tecido: fabricNormalized,
      cor: updated.color,
      tamanho: updated.size,
      quantidade: updated.stockQty,
      ativo: updated.active,
    });
  } catch (error) {
    console.error("PUT /api/estoque/[id]:", error);
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A referência já existe." }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível atualizar item de estoque." }, { status: 500 });
  }
}
