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
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!, 10) : undefined;
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined;
    const week = searchParams.get("week") ? parseInt(searchParams.get("week")!, 10) : undefined;
    const tipo = searchParams.get("tipo") ?? "all";

    const body = await withDbRetry(async () => {
      const { startCurrent, endCurrent, startPrevious, endPrevious } = getReportDateContext(period, {
        month,
        year,
        week,
      });
      const whereTipo = tipo !== "all" ? { tipo } : {};

      const current = await prisma.sale.aggregate({
        where: { data: { gte: startCurrent, lte: endCurrent }, ...whereTipo },
        _sum: { receita: true, lucroLiquido: true, quantidade: true },
      });
      const previous = await prisma.sale.aggregate({
        where: { data: { gte: startPrevious, lte: endPrevious }, ...whereTipo },
        _sum: { receita: true, lucroLiquido: true, quantidade: true },
      });
      const totalInsumosCurrent = await sumInsumosValor({ gte: startCurrent, lte: endCurrent });
      const totalInsumosPrevious = await sumInsumosValor({ gte: startPrevious, lte: endPrevious });

      const revenueCurrent = Number(current._sum.receita ?? 0);
      const revenuePrevious = Number(previous._sum.receita ?? 0);
      const netProfitCurrent = Number(current._sum.lucroLiquido ?? 0);
      const netProfitPrevious = Number(previous._sum.lucroLiquido ?? 0);
      const realProfitCurrent = netProfitCurrent - totalInsumosCurrent;
      const realProfitPrevious = netProfitPrevious - totalInsumosPrevious;
      const unitsCurrent = current._sum.quantidade ?? 0;
      const unitsPrevious = previous._sum.quantidade ?? 0;

      const revenueDiff = revenuePrevious ? ((revenueCurrent - revenuePrevious) / revenuePrevious) * 100 : 0;
      const profitDiff = netProfitPrevious ? ((netProfitCurrent - netProfitPrevious) / netProfitPrevious) * 100 : 0;
      const insumosDiff = totalInsumosPrevious
        ? ((totalInsumosCurrent - totalInsumosPrevious) / totalInsumosPrevious) * 100
        : 0;
      const realProfitDiff = realProfitPrevious
        ? ((realProfitCurrent - realProfitPrevious) / realProfitPrevious) * 100
        : 0;
      const unitsDiff = unitsPrevious ? ((unitsCurrent - unitsPrevious) / unitsPrevious) * 100 : 0;

      return {
        current: {
          revenue: revenueCurrent,
          netProfit: netProfitCurrent,
          totalInsumos: totalInsumosCurrent,
          realProfit: realProfitCurrent,
          units: unitsCurrent,
        },
        previous: {
          revenue: revenuePrevious,
          netProfit: netProfitPrevious,
          totalInsumos: totalInsumosPrevious,
          realProfit: realProfitPrevious,
          units: unitsPrevious,
        },
        compare: {
          revenueDiff,
          revenueDiffAbs: revenueCurrent - revenuePrevious,
          profitDiff,
          profitDiffAbs: netProfitCurrent - netProfitPrevious,
          insumosDiff,
          insumosDiffAbs: totalInsumosCurrent - totalInsumosPrevious,
          realProfitDiff,
          realProfitDiffAbs: realProfitCurrent - realProfitPrevious,
          unitsDiff,
          unitsDiffAbs: unitsCurrent - unitsPrevious,
        },
        filters: { period, month, year, week, tipo },
      };
    });

    return NextResponse.json(body);
  } catch (error) {
    console.error("Erro em /api/reports/compare:", error);
    return NextResponse.json(
      { error: "Erro ao calcular indicadores. Atualize a página e tente novamente." },
      { status: 500 },
    );
  }
}
