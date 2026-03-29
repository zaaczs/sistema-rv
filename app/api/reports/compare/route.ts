import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sumInsumosValor } from "@/lib/insumo-repository";
import {
  getIsoWeekAndYear,
  isoWeekRange,
  previousIsoWeek,
} from "@/lib/iso-week";

function getDateRange(
  period: string,
  opts: { month?: number; year?: number; week?: number }
) {
  const now = new Date();
  const m = opts.month ?? now.getMonth() + 1;
  const y = opts.year ?? now.getFullYear();

  if (period === "daily") {
    const startCurrent = new Date(now);
    startCurrent.setHours(0, 0, 0, 0);
    const endCurrent = new Date(now);
    endCurrent.setHours(23, 59, 59, 999);
    const startPrevious = new Date(now);
    startPrevious.setDate(now.getDate() - 1);
    startPrevious.setHours(0, 0, 0, 0);
    const endPrevious = new Date(startPrevious);
    endPrevious.setHours(23, 59, 59, 999);
    return { startCurrent, endCurrent, startPrevious, endPrevious };
  }

  if (period === "weekly") {
    let isoYear: number;
    let weekNum: number;
    if (opts.week != null && opts.year != null) {
      isoYear = opts.year;
      weekNum = opts.week;
    } else if (opts.week != null) {
      const cur = getIsoWeekAndYear(now);
      isoYear = cur.isoYear;
      weekNum = opts.week;
    } else {
      const cur = getIsoWeekAndYear(now);
      isoYear = cur.isoYear;
      weekNum = cur.week;
    }
    const { start: startCurrent, end: endCurrent } = isoWeekRange(isoYear, weekNum);
    const prev = previousIsoWeek(isoYear, weekNum);
    const { start: startPrevious, end: endPrevious } = isoWeekRange(prev.isoYear, prev.week);
    return { startCurrent, endCurrent, startPrevious, endPrevious };
  }

  if (period === "annual") {
    const startCurrent = new Date(y, 0, 1);
    const endCurrent = new Date(y, 11, 31, 23, 59, 59);
    const startPrevious = new Date(y - 1, 0, 1);
    const endPrevious = new Date(y - 1, 11, 31, 23, 59, 59);
    return { startCurrent, endCurrent, startPrevious, endPrevious };
  }

  const startCurrent = new Date(y, m - 1, 1);
  const endCurrent = new Date(y, m, 0, 23, 59, 59);
  const startPrevious = new Date(y, m - 2, 1);
  const endPrevious = new Date(y, m - 1, 0, 23, 59, 59);
  return { startCurrent, endCurrent, startPrevious, endPrevious };
}

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

    const { startCurrent, endCurrent, startPrevious, endPrevious } = getDateRange(period, {
      month,
      year,
      week,
    });

    const whereTipo = tipo !== "all" ? { tipo } : {};

    const [current, previous, totalInsumosCurrent, totalInsumosPrevious] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          data: { gte: startCurrent, lte: endCurrent },
          ...whereTipo,
        },
        _sum: { receita: true, lucroLiquido: true, quantidade: true },
      }),
      prisma.sale.aggregate({
        where: {
          data: { gte: startPrevious, lte: endPrevious },
          ...whereTipo,
        },
        _sum: { receita: true, lucroLiquido: true, quantidade: true },
      }),
      sumInsumosValor({ gte: startCurrent, lte: endCurrent }),
      sumInsumosValor({ gte: startPrevious, lte: endPrevious }),
    ]);

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

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Erro em /api/reports/compare:", error);
    return NextResponse.json(
      { error: "Erro ao calcular indicadores. Atualize a página e tente novamente." },
      { status: 500 }
    );
  }
}
