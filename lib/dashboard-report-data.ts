import { prisma } from "@/lib/db";
import { listInsumos, sumInsumosValor } from "@/lib/insumo-repository";
import { getReportDateContext } from "@/lib/report-period-bounds";

type ChartRow = {
  label: string;
  revenue: number;
  netProfit: number;
  insumos: number;
  realProfit: number;
  units: number;
};

export async function getDashboardReportPayload(input: {
  period: string;
  month?: number;
  year?: number;
  week?: number;
  quarter?: number;
  semester?: number;
  tipo: string;
}) {
  const { period, month, year, week, quarter, semester, tipo } = input;
  const { startCurrent, endCurrent, startPrevious, endPrevious, labels } = getReportDateContext(period, {
    month,
    year,
    week,
    quarter,
    semester,
  });
  const whereTipo = tipo !== "all" ? { tipo } : {};

  const current = await prisma.sale.aggregate({
    where: { data: { gte: startCurrent, lte: endCurrent }, deletedAt: null, ...whereTipo },
    _sum: { receita: true, lucroLiquido: true, quantidade: true },
  });
  const previous = await prisma.sale.aggregate({
    where: { data: { gte: startPrevious, lte: endPrevious }, deletedAt: null, ...whereTipo },
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

  const sales = await prisma.sale.findMany({
    where: { data: { gte: startCurrent, lte: endCurrent }, deletedAt: null, ...whereTipo },
  });
  const insumosEntities = await listInsumos({ gte: startCurrent, lte: endCurrent });
  const insumosRows = insumosEntities.map((e) => ({ data: e.data, valor: e.valor }));

  function sumInsumos(rangeStart: Date, rangeEnd: Date) {
    return insumosRows
      .filter((r) => r.data >= rangeStart && r.data <= rangeEnd)
      .reduce((acc, r) => acc + Number(r.valor), 0);
  }

  const start = startCurrent;
  const end = endCurrent;
  const data: ChartRow[] = [];

  if (period === "daily") {
    const total = sales.reduce(
      (acc, s) => ({
        revenue: acc.revenue + Number(s.receita),
        netProfit: acc.netProfit + Number(s.lucroLiquido),
        units: acc.units + s.quantidade,
      }),
      { revenue: 0, netProfit: 0, units: 0 },
    );
    const insumos = sumInsumos(start, end);
    data.push({
      label: labels[0],
      ...total,
      insumos,
      realProfit: total.netProfit - insumos,
    });
  } else if (period === "weekly") {
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(start);
      dayStart.setDate(start.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const daySales = sales.filter((s) => s.data >= dayStart && s.data <= dayEnd);
      const total = daySales.reduce(
        (acc, s) => ({
          revenue: acc.revenue + Number(s.receita),
          netProfit: acc.netProfit + Number(s.lucroLiquido),
          units: acc.units + s.quantidade,
        }),
        { revenue: 0, netProfit: 0, units: 0 },
      );
      const insumos = sumInsumos(dayStart, dayEnd);
      data.push({
        label: labels[i],
        ...total,
        insumos,
        realProfit: total.netProfit - insumos,
      });
    }
  } else if (period === "annual" || period === "quarterly" || period === "semiannual") {
    const monthCount = period === "annual" ? 12 : period === "quarterly" ? 3 : 6;
    for (let mi = 0; mi < monthCount; mi++) {
      const monthStart = new Date(start.getFullYear(), start.getMonth() + mi, 1);
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + mi + 1, 0, 23, 59, 59);
      const monthSales = sales.filter((s) => s.data >= monthStart && s.data <= monthEnd);
      const total = monthSales.reduce(
        (acc, s) => ({
          revenue: acc.revenue + Number(s.receita),
          netProfit: acc.netProfit + Number(s.lucroLiquido),
          units: acc.units + s.quantidade,
        }),
        { revenue: 0, netProfit: 0, units: 0 },
      );
      const insumos = sumInsumos(monthStart, monthEnd);
      data.push({
        label: labels[mi],
        ...total,
        insumos,
        realProfit: total.netProfit - insumos,
      });
    }
  } else {
    const daysInMonth = end.getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStart = new Date(start.getFullYear(), start.getMonth(), d, 0, 0, 0);
      const dayEnd = new Date(start.getFullYear(), start.getMonth(), d, 23, 59, 59);
      const daySales = sales.filter((s) => s.data >= dayStart && s.data <= dayEnd);
      const total = daySales.reduce(
        (acc, s) => ({
          revenue: acc.revenue + Number(s.receita),
          netProfit: acc.netProfit + Number(s.lucroLiquido),
          units: acc.units + s.quantidade,
        }),
        { revenue: 0, netProfit: 0, units: 0 },
      );
      const insumos = sumInsumos(dayStart, dayEnd);
      data.push({
        label: labels[d - 1],
        ...total,
        insumos,
        realProfit: total.netProfit - insumos,
      });
    }
  }

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
    filters: { period, month, year, week, quarter, semester, tipo },
    chart: { data, period },
  };
}
