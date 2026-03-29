import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { computeSaleTotals } from "@/lib/compute-sale";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

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

  if (!data || !tipo || !produtoId || quantidade == null) {
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

  const existing = await prisma.sale.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 });
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

  const sale = await prisma.sale.update({
    where: { id },
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
    include: { product: true },
  });

  return NextResponse.json({
    id: sale.id,
    data: sale.data,
    tipo: sale.tipo,
    produtoId: sale.productId,
    produtoNome: sale.product?.name ?? "Produto não vinculado",
    quantidade: sale.quantidade,
    precoUnitarioAplicado: Number(sale.precoUnitarioAplicado),
    lucroUnitario: Number(sale.lucroUnitario),
    taxaCartao: Number(sale.taxaCartao),
    receita: Number(sale.receita),
    lucroBruto: Number(sale.lucroBruto),
    lucroLiquido: Number(sale.lucroLiquido),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.sale.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 });
  }

  await prisma.sale.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
