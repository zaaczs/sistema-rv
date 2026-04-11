import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { withDbRetry } from "@/lib/db-retry";

type CreateStockBody = {
  referencia: string;
  modeloId: string;
  tecido: string;
  cor: string;
  tamanho: string;
  quantidade?: number;
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const modelId = searchParams.get("modelId")?.trim() ?? "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { skuCode: { contains: search, mode: "insensitive" } },
        { color: { contains: search, mode: "insensitive" } },
        { size: { contains: search, mode: "insensitive" } },
        { product: { name: { contains: search, mode: "insensitive" } } },
        { product: { tecido: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (modelId && modelId !== "all") {
      where.productId = modelId;
    }

    const skus = await withDbRetry(() =>
      prisma.sku.findMany({
        where,
        include: { product: true },
        orderBy: [{ createdAt: "desc" }],
      }),
    );

    return NextResponse.json(
      skus.map((sku) => ({
        id: sku.id,
        referencia: sku.skuCode,
        modeloId: sku.productId,
        modelo: sku.product.name,
        tecido: sku.product.tecido,
        cor: sku.color,
        tamanho: sku.size,
        quantidade: sku.stockQty,
        ativo: sku.active,
      })),
    );
  } catch (error) {
    console.error("GET /api/estoque:", error);
    return NextResponse.json({ error: "Não foi possível carregar o estoque." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    let body: CreateStockBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const referencia = body.referencia?.trim() ?? "";
    const modeloId = body.modeloId?.trim() ?? "";
    const tecido = body.tecido?.trim() ?? "";
    const cor = body.cor?.trim() ?? "";
    const tamanho = body.tamanho?.trim() ?? "";
    const quantidade = Number(body.quantidade ?? 0);

    if (!referencia || !modeloId || !tecido || !cor || !tamanho) {
      return NextResponse.json(
        { error: "Preencha modelo, tecido, referência, cor e tamanho." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(quantidade) || quantidade < 0) {
      return NextResponse.json({ error: "Quantidade inválida." }, { status: 400 });
    }

    const product = await withDbRetry(() => prisma.product.findUnique({ where: { id: modeloId } }));
    if (!product) {
      return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });
    }
    const tecidoNormalized = tecido.toUpperCase();

    const created = await withDbRetry(() =>
      prisma.sku.create({
        data: {
          skuCode: referencia.toUpperCase(),
          productId: modeloId,
          color: cor.toUpperCase(),
          size: tamanho.toUpperCase(),
          stockQty: Math.floor(quantidade),
          active: true,
          costPrice: new Decimal(product.custoUnitario),
          retailPrice: new Decimal(product.precoVarejo),
          wholesalePrice: new Decimal(product.precoAtacado),
        },
        include: { product: true },
      }),
    );

    return NextResponse.json({
      id: created.id,
      referencia: created.skuCode,
      modeloId: created.productId,
      modelo: created.product.name,
      tecido: tecidoNormalized,
      cor: created.color,
      tamanho: created.size,
      quantidade: created.stockQty,
      ativo: created.active,
    });
  } catch (error) {
    console.error("POST /api/estoque:", error);
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A referência já existe." }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível criar item de estoque." }, { status: 500 });
  }
}
