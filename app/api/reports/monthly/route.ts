import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import { sumInsumosValor } from "@/lib/insumo-repository";
import { getReportDateContext } from "@/lib/report-period-bounds";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") ?? "monthly";
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const week = searchParams.get("week") ? parseInt(searchParams.get("week")!, 10) : undefined;
    const quarter = searchParams.get("quarter") ? parseInt(searchParams.get("quarter")!, 10) : undefined;
    const semester = searchParams.get("semester") ? parseInt(searchParams.get("semester")!, 10) : undefined;
    const tipo = searchParams.get("tipo") ?? "all";

    const { startCurrent: start, endCurrent: end } = getReportDateContext(period, {
      month,
      year,
      week,
      quarter,
      semester,
    });
    const whereTipo = tipo !== "all" ? { tipo } : {};

    const payload = await withDbRetry(async () => {
      const totals = await prisma.sale.aggregate({
        where: { data: { gte: start, lte: end }, ...whereTipo },
        _sum: { receita: true, lucroBruto: true, lucroLiquido: true, taxaCartao: true, quantidade: true },
        _count: true,
      });
      const byTipo = await prisma.sale.groupBy({
        by: ["tipo"],
        where: { data: { gte: start, lte: end } },
        _sum: { receita: true, lucroLiquido: true, quantidade: true },
        _count: true,
      });
      const groupedByProduct = await prisma.sale.groupBy({
        by: ["productId"],
        where: { data: { gte: start, lte: end }, ...whereTipo },
        _sum: { quantidade: true, receita: true, lucroLiquido: true },
      });
      const totalInsumos = await sumInsumosValor({ gte: start, lte: end });

      const netProfitSales = Number(totals._sum.lucroLiquido ?? 0);
      const realProfit = netProfitSales - totalInsumos;

      const productIds = groupedByProduct.map((row) => row.productId).filter(Boolean) as string[];
      const products = productIds.length
        ? await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
          })
        : [];
      const productMap = new Map(products.map((p) => [p.id, p.name]));

      const reportByProduct = groupedByProduct
        .map((row) => ({
          productId: row.productId ?? "sem-produto",
          productName: row.productId ? productMap.get(row.productId) ?? "Produto removido" : "Sem produto",
          quantidade: row._sum.quantidade ?? 0,
          receita: Number(row._sum.receita ?? 0),
          lucro: Number(row._sum.lucroLiquido ?? 0),
        }))
        .sort((a, b) => b.receita - a.receita);

      const rankingUnits = [...reportByProduct]
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 10);
      const rankingProfit = [...reportByProduct]
        .sort((a, b) => b.lucro - a.lucro)
        .slice(0, 10);

      return {
        period,
        month,
        year,
        week,
        quarter,
        semester,
        tipo,
        totals: {
          revenue: Number(totals._sum.receita ?? 0),
          grossProfit: Number(totals._sum.lucroBruto ?? 0),
          cardFee: Number(totals._sum.taxaCartao ?? 0),
          netProfit: netProfitSales,
          totalInsumos,
          realProfit,
          count: totals._count ?? 0,
          units: totals._sum.quantidade ?? 0,
        },
        byTipo: byTipo.map((b) => ({
          tipo: b.tipo,
          revenue: Number(b._sum.receita ?? 0),
          netProfit: Number(b._sum.lucroLiquido ?? 0),
          units: b._sum.quantidade ?? 0,
          count: b._count,
        })),
        byProduct: reportByProduct,
        rankingUnits,
        rankingProfit,
      };
    });

    return NextResponse.json(payload);
  } catch (e) {
    console.error("GET /api/reports/monthly:", e);
    return NextResponse.json(
      { error: "Não foi possível carregar o relatório. Tente novamente." },
      { status: 500 },
    );
  }
}
