import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createInsumo, listInsumos } from "@/lib/insumo-repository";
import { writeAuditLog } from "@/lib/audit-log";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let range: { gte: Date; lte: Date } | undefined;
  if (from && to) {
    range = {
      gte: new Date(`${from}T00:00:00`),
      lte: new Date(`${to}T23:59:59`),
    };
  } else if (month && year) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    range = {
      gte: new Date(y, m - 1, 1),
      lte: new Date(y, m, 0, 23, 59, 59),
    };
  }

  const rows = await listInsumos(range);

  const list = rows.map((i) => ({
    id: i.id,
    nome: i.nome,
    valor: i.valor,
    data: i.data.toISOString(),
    categoria: i.categoria,
    createdAt: i.createdAt.toISOString(),
  }));

  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let body: { nome: string; valor: number; data: string; categoria?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { nome, valor, data, categoria } = body;
  if (!nome?.trim() || data == null || valor == null || Number.isNaN(Number(valor))) {
    return NextResponse.json({ error: "Preencha nome, valor e data." }, { status: 400 });
  }

  const dataRef = new Date(`${data}T12:00:00`);
  if (Number.isNaN(dataRef.getTime())) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }

  try {
    const created = await createInsumo({
      nome: nome.trim(),
      valor: Number(valor),
      data: dataRef,
      categoria: categoria?.trim() ? categoria.trim() : null,
    });

    await writeAuditLog({
      entity: "Insumo",
      entityId: created.id,
      action: "CREATE",
      session,
      metadata: { categoria: created.categoria },
    });

    return NextResponse.json({
      id: created.id,
      nome: created.nome,
      valor: created.valor,
      data: created.data.toISOString(),
      categoria: created.categoria,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (e) {
    console.error("POST /api/insumos:", e);
    return NextResponse.json({ error: "Não foi possível salvar o insumo." }, { status: 500 });
  }
}
