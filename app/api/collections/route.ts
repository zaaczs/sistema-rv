import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const list = await withDbRetry(() => prisma.collection.findMany({ orderBy: { name: "asc" } }));
    return NextResponse.json(list);
  } catch (error) {
    console.error("GET /api/collections:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar coleções. Tente novamente em instantes." },
      { status: 500 },
    );
  }
}
