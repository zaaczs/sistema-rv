import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { withDbRetry } from "@/lib/db-retry";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const collectionId = searchParams.get("collectionId") ?? "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.name = { contains: search };
    }
    if (collectionId && collectionId !== "all") {
      where.collectionId = collectionId;
    }

    const products = await withDbRetry(() =>
      prisma.product.findMany({
        where,
        include: {
          collection: true,
        },
        orderBy: [{ name: "asc" }],
      }),
    );

    const list = products.map((p) => ({
      id: p.id,
      name: p.name,
      collectionId: p.collectionId,
      collectionName: p.collection.name,
      custoUnitario: Number(p.custoUnitario),
      lucroVarejo: Number(p.lucroVarejo),
      lucroAtacado: Number(p.lucroAtacado),
      precoVarejo: Number(p.precoVarejo),
      precoAtacado: Number(p.precoAtacado),
    }));

    return NextResponse.json(list);
  } catch (error) {
    console.error("GET /api/skus:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar produtos. Tente novamente em instantes." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    let body: {
      name: string;
      collectionId: string;
      custoUnitario: number;
      lucroVarejo: number;
      lucroAtacado: number;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const { name, collectionId, custoUnitario, lucroVarejo, lucroAtacado } = body;

    if (!name?.trim() || !collectionId) {
      return NextResponse.json({ error: "Preencha nome e coleção." }, { status: 400 });
    }

    if ([custoUnitario, lucroVarejo, lucroAtacado].some((v) => v == null || v < 0)) {
      return NextResponse.json({ error: "Custo e lucros devem ser maiores ou iguais a 0." }, { status: 400 });
    }

    const precoVarejo = custoUnitario + lucroVarejo;
    const precoAtacado = custoUnitario + lucroAtacado;

    const product = await withDbRetry(() =>
      prisma.product.create({
        data: {
          name: name.trim(),
          collectionId,
          custoUnitario: new Decimal(custoUnitario),
          lucroVarejo: new Decimal(lucroVarejo),
          lucroAtacado: new Decimal(lucroAtacado),
          precoVarejo: new Decimal(precoVarejo),
          precoAtacado: new Decimal(precoAtacado),
        },
        include: { collection: true },
      }),
    );

    return NextResponse.json({
      id: product.id,
      name: product.name,
      collectionId: product.collectionId,
      collectionName: product.collection.name,
      custoUnitario: Number(product.custoUnitario),
      lucroVarejo: Number(product.lucroVarejo),
      lucroAtacado: Number(product.lucroAtacado),
      precoVarejo: Number(product.precoVarejo),
      precoAtacado: Number(product.precoAtacado),
    });
  } catch (error) {
    console.error("POST /api/skus:", error);
    return NextResponse.json(
      { error: "Não foi possível salvar produto. Tente novamente em instantes." },
      { status: 500 },
    );
  }
}
