import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDashboardReportPayload } from "@/lib/dashboard-report-data";
import { withDbRetry } from "@/lib/db-retry";

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

    const payload = await withDbRetry(() =>
      getDashboardReportPayload({ period, month, year, week, quarter, semester, tipo }),
    );

    return NextResponse.json(payload);
  } catch (error) {
    console.error("GET /api/reports/dashboard:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar o dashboard. Tente novamente em instantes." },
      { status: 500 },
    );
  }
}
