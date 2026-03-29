import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { computeSaleTotals } from "@/lib/compute-sale";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const tipo = searchParams.get("tipo");

  const where: Record<string, unknown> = {};
  if (from && to) {
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T23:59:59`);
    where.data = { gte: start, lte: end };
  } else if (month && year) {
    const start = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const end = new Date(parseInt(year, 10), parseInt(month, 10), 0, 23, 59, 59);
    where.data = { gte: start, lte: end };
  }
  if (tipo && tipo !== "all") where.tipo = tipo;

  const sales = await prisma.sale.findMany({
    where,
    include: {
      product: true,
    },
    orderBy: { data: "desc" },
  });

  const list = sales.map((s) => ({
    id: s.id,
    data: s.data,
    tipo: s.tipo,
    produtoId: s.productId,
    produtoNome: s.product?.name ?? "Produto não vinculado",
    quantidade: s.quantidade,
    precoUnitarioAplicado: Number(s.precoUnitarioAplicado),
    lucroUnitario: Number(s.lucroUnitario),
    taxaCartao: Number(s.taxaCartao),
    receita: Number(s.receita),
    lucroBruto: Number(s.lucroBruto),
    lucroLiquido: Number(s.lucroLiquido),
  }));

  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let body: {
    data: string;
    tipo: "varejo" | "atacado";
    produtoId: string;
    quantidade: number;
    precoUnitarioAplicado?: number;
    taxaCartao?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { data, tipo, produtoId, quantidade, precoUnitarioAplicado, taxaCartao = 0 } = body;

  if (!data || !tipo || !produtoId || !quantidade) {
    return NextResponse.json({ error: "Preencha data, tipo, produto e quantidade." }, { status: 400 });
  }

  if (!["varejo", "atacado"].includes(tipo)) {
    return NextResponse.json({ error: "Tipo deve ser varejo ou atacado." }, { status: 400 });
  }

  if (quantidade <= 0) {
    return NextResponse.json({ error: "Quantidade deve ser maior que zero." }, { status: 400 });
  }
  if (taxaCartao < 0) {
    return NextResponse.json({ error: "Taxa de cartão não pode ser negativa." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: produtoId } });
  if (!product) {
    return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  }

  const { lucroBase, precoAplicado, receita, lucroBruto, lucroLiquido } = computeSaleTotals(
    product,
    tipo,
    quantidade,
    precoUnitarioAplicado,
    taxaCartao
  );

  if (precoAplicado < 0) {
    return NextResponse.json({ error: "Preço aplicado não pode ser negativo." }, { status: 400 });
  }

  const sale = await prisma.sale.create({
    data: {
      data: new Date(data),
      tipo,
      productId: produtoId,
      quantidade,
      precoUnitarioAplicado: new Decimal(precoAplicado),
      lucroUnitario: new Decimal(lucroBase),
      taxaCartao: new Decimal(taxaCartao),
      receita: new Decimal(receita),
      lucroBruto: new Decimal(lucroBruto),
      lucroLiquido: new Decimal(lucroLiquido),
    },
  });

  return NextResponse.json({
    id: sale.id,
    receita: Number(sale.receita),
    lucroLiquido: Number(sale.lucroLiquido),
  });
}
