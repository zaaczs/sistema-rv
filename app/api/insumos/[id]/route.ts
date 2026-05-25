import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteInsumo, findInsumoById, updateInsumo } from "@/lib/insumo-repository";
import { writeAuditLog } from "@/lib/audit-log";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  let body: { nome?: string; valor?: number; data?: string; categoria?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const existing = await findInsumoById(id);
  if (!existing) return NextResponse.json({ error: "Insumo não encontrado." }, { status: 404 });

  const patch: { nome?: string; valor?: number; data?: Date; categoria?: string | null } = {};

  if (body.nome !== undefined) {
    const n = String(body.nome).trim();
    if (!n) return NextResponse.json({ error: "Nome não pode ser vazio." }, { status: 400 });
    patch.nome = n;
  }
  if (body.valor !== undefined) {
    if (Number.isNaN(Number(body.valor))) {
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    }
    patch.valor = Number(body.valor);
  }
  if (body.data !== undefined) {
    const d = new Date(`${body.data}T12:00:00`);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    }
    patch.data = d;
  }
  if (body.categoria !== undefined) {
    patch.categoria = body.categoria?.trim() ? String(body.categoria).trim() : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  try {
    const updated = await updateInsumo(id, patch);
    if (!updated) return NextResponse.json({ error: "Insumo não encontrado." }, { status: 404 });

    await writeAuditLog({
      entity: "Insumo",
      entityId: id,
      action: "UPDATE",
      session,
      metadata: { changedFields: Object.keys(patch) },
    });

    return NextResponse.json({
      id: updated.id,
      nome: updated.nome,
      valor: updated.valor,
      data: updated.data.toISOString(),
      categoria: updated.categoria,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (e) {
    console.error("PATCH /api/insumos/[id]:", e);
    return NextResponse.json({ error: "Não foi possível atualizar o insumo." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteInsumo(id);
  if (!ok) return NextResponse.json({ error: "Insumo não encontrado." }, { status: 404 });

  await writeAuditLog({
    entity: "Insumo",
    entityId: id,
    action: "DELETE",
    session,
  });

  return NextResponse.json({ ok: true });
}
