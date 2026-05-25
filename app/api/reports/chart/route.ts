import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import { listInsumos } from "@/lib/insumo-repository";
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
    const quarter = searchParams.get("quarter") ? parseInt(searchParams.get("quarter")!, 10) : undefined;
    const semester = searchParams.get("semester") ? parseInt(searchParams.get("semester")!, 10) : undefined;
    const tipo = searchParams.get("tipo") ?? "all";

    const result = await withDbRetry(async () => {
      const { startCurrent, endCurrent, labels } = getReportDateContext(period, { month, year, week, quarter, semester });
      const whereTipo = tipo !== "all" ? { tipo } : {};
      const start = startCurrent;
      const end = endCurrent;

      const sales = await prisma.sale.findMany({
        where: { data: { gte: start, lte: end }, deletedAt: null, ...whereTipo },
      });
      const insumosEntities = await listInsumos({ gte: start, lte: end });
      const insumosRows = insumosEntities.map((e) => ({ data: e.data, valor: e.valor }));

      function sumInsumos(rangeStart: Date, rangeEnd: Date) {
        return insumosRows
          .filter((r) => r.data >= rangeStart && r.data <= rangeEnd)
          .reduce((acc, r) => acc + Number(r.valor), 0);
      }

      const data: {
        label: string;
        revenue: number;
        netProfit: number;
        insumos: number;
        realProfit: number;
        units: number;
      }[] = [];

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

      return { data, period };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro em /api/reports/chart:", error);
    return NextResponse.json({ error: "Erro ao montar dados do gráfico.", data: [] }, { status: 500 });
  }
}
