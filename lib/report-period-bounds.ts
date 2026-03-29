import { getIsoWeekAndYear, isoWeekRange, previousIsoWeek } from "@/lib/iso-week";

export type ReportPeriodOpts = { month?: number; year?: number; week?: number };

/** Limites do período atual vs anterior (comparativo) + rótulos do gráfico para o período atual. */
export function getReportDateContext(period: string, opts: ReportPeriodOpts) {
  const now = new Date();
  const m = opts.month ?? now.getMonth() + 1;
  const y = opts.year ?? now.getFullYear();

  let startCurrent: Date;
  let endCurrent: Date;
  let startPrevious: Date;
  let endPrevious: Date;

  if (period === "daily") {
    startCurrent = new Date(now);
    startCurrent.setHours(0, 0, 0, 0);
    endCurrent = new Date(now);
    endCurrent.setHours(23, 59, 59, 999);
    startPrevious = new Date(now);
    startPrevious.setDate(now.getDate() - 1);
    startPrevious.setHours(0, 0, 0, 0);
    endPrevious = new Date(startPrevious);
    endPrevious.setHours(23, 59, 59, 999);
  } else if (period === "weekly") {
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
    const cur = isoWeekRange(isoYear, weekNum);
    startCurrent = cur.start;
    endCurrent = cur.end;
    const prev = previousIsoWeek(isoYear, weekNum);
    const p = isoWeekRange(prev.isoYear, prev.week);
    startPrevious = p.start;
    endPrevious = p.end;
  } else if (period === "annual") {
    startCurrent = new Date(y, 0, 1);
    endCurrent = new Date(y, 11, 31, 23, 59, 59);
    startPrevious = new Date(y - 1, 0, 1);
    endPrevious = new Date(y - 1, 11, 31, 23, 59, 59);
  } else {
    startCurrent = new Date(y, m - 1, 1);
    endCurrent = new Date(y, m, 0, 23, 59, 59);
    startPrevious = new Date(y, m - 2, 1);
    endPrevious = new Date(y, m - 1, 0, 23, 59, 59);
  }

  const labels = buildChartLabels(period, startCurrent, endCurrent, now);

  return { startCurrent, endCurrent, startPrevious, endPrevious, labels };
}

function buildChartLabels(period: string, start: Date, end: Date, now: Date): string[] {
  if (period === "daily") {
    return [now.toLocaleDateString("pt-BR", { weekday: "short" })];
  }
  if (period === "weekly") {
    const out: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" }));
    }
    return out;
  }
  if (period === "annual") {
    return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  }
  const daysInMonth = end.getDate();
  return Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
}
