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

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    let body: { name?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Informe o nome da coleção." }, { status: 400 });
    }

    const existing = await withDbRetry(() => prisma.collection.findUnique({ where: { name } }));
    if (existing) return NextResponse.json(existing);

    const created = await withDbRetry(() =>
      prisma.collection.create({
        data: { name },
      }),
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/collections:", error);
    return NextResponse.json(
      { error: "Não foi possível criar coleção. Tente novamente em instantes." },
      { status: 500 },
    );
  }
}
