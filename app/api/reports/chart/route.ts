import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listInsumos } from "@/lib/insumo-repository";
import { getIsoWeekAndYear, isoWeekRange } from "@/lib/iso-week";

function getDateRange(
  period: string,
  opts: { month?: number; year?: number; week?: number }
) {
  const now = new Date();
  const m = opts.month ?? now.getMonth() + 1;
  const y = opts.year ?? now.getFullYear();

  if (period === "daily") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end, labels: [now.toLocaleDateString("pt-BR", { weekday: "short" })] };
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
    const { start, end } = isoWeekRange(isoYear, weekNum);
    const labels: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      labels.push(d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" }));
    }
    return { start, end, labels };
  }

  if (period === "annual") {
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31, 23, 59, 59);
    const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return { start, end, labels };
  }

  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);
  const daysInMonth = end.getDate();
  const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
  return { start, end, labels };
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

    const { start, end, labels } = getDateRange(period, { month, year, week });
    const whereTipo = tipo !== "all" ? { tipo } : {};

    const [sales, insumosEntities] = await Promise.all([
      prisma.sale.findMany({
        where: {
          data: { gte: start, lte: end },
          ...whereTipo,
        },
      }),
      listInsumos({ gte: start, lte: end }),
    ]);

    const insumosRows = insumosEntities.map((e) => ({
      data: e.data,
      valor: e.valor,
    }));

  const data: {
    label: string;
    revenue: number;
    netProfit: number;
    insumos: number;
    realProfit: number;
    units: number;
  }[] = [];

  function sumInsumos(rangeStart: Date, rangeEnd: Date) {
    return insumosRows
      .filter((r) => r.data >= rangeStart && r.data <= rangeEnd)
      .reduce((acc, r) => acc + Number(r.valor), 0);
  }

  if (period === "daily") {
    const total = sales.reduce(
      (acc, s) => ({
        revenue: acc.revenue + Number(s.receita),
        netProfit: acc.netProfit + Number(s.lucroLiquido),
        units: acc.units + s.quantidade,
      }),
      { revenue: 0, netProfit: 0, units: 0 }
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
        { revenue: 0, netProfit: 0, units: 0 }
      );
      const insumos = sumInsumos(dayStart, dayEnd);
      data.push({
        label: labels[i],
        ...total,
        insumos,
        realProfit: total.netProfit - insumos,
      });
    }
  } else if (period === "annual") {
    for (let mi = 0; mi < 12; mi++) {
      const monthStart = new Date(start.getFullYear(), mi, 1);
      const monthEnd = new Date(start.getFullYear(), mi + 1, 0, 23, 59, 59);
      const monthSales = sales.filter((s) => s.data >= monthStart && s.data <= monthEnd);
      const total = monthSales.reduce(
        (acc, s) => ({
          revenue: acc.revenue + Number(s.receita),
          netProfit: acc.netProfit + Number(s.lucroLiquido),
          units: acc.units + s.quantidade,
        }),
        { revenue: 0, netProfit: 0, units: 0 }
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
        { revenue: 0, netProfit: 0, units: 0 }
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

    return NextResponse.json({ data, period });
  } catch (error) {
    console.error("Erro em /api/reports/chart:", error);
    return NextResponse.json({ error: "Erro ao montar dados do gráfico.", data: [] }, { status: 500 });
  }
}
