import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type InsumoEntity = {
  id: string;
  nome: string;
  valor: number;
  data: Date;
  categoria: string | null;
  createdAt: Date;
};

function rowToEntity(r: {
  id: string;
  nome: string;
  valor: unknown;
  data: Date;
  categoria: string | null;
  createdAt: Date;
}): InsumoEntity {
  return {
    id: r.id,
    nome: r.nome,
    valor: Number(r.valor),
    data: r.data,
    categoria: r.categoria,
    createdAt: r.createdAt,
  };
}

export async function listInsumos(range?: { gte: Date; lte: Date }): Promise<InsumoEntity[]> {
  const rows = range
    ? await prisma.$queryRaw<
        {
          id: string;
          nome: string;
          valor: unknown;
          data: Date;
          categoria: string | null;
          createdAt: Date;
        }[]
      >`
        SELECT id, nome, valor, data, categoria, "createdAt"
        FROM "Insumo"
        WHERE data >= ${range.gte} AND data <= ${range.lte}
        ORDER BY data DESC, "createdAt" DESC
      `
    : await prisma.$queryRaw<
        {
          id: string;
          nome: string;
          valor: unknown;
          data: Date;
          categoria: string | null;
          createdAt: Date;
        }[]
      >`
        SELECT id, nome, valor, data, categoria, "createdAt"
        FROM "Insumo"
        ORDER BY data DESC, "createdAt" DESC
      `;
  return rows.map(rowToEntity);
}

export async function sumInsumosValor(range: { gte: Date; lte: Date }): Promise<number> {
  const [row] = await prisma.$queryRaw<{ s: unknown }[]>`
    SELECT COALESCE(SUM(valor), 0) AS s
    FROM "Insumo"
    WHERE data >= ${range.gte} AND data <= ${range.lte}
  `;
  const v = row?.s;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  return Number(v ?? 0);
}

export async function findInsumoById(id: string): Promise<InsumoEntity | null> {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      nome: string;
      valor: unknown;
      data: Date;
      categoria: string | null;
      createdAt: Date;
    }[]
  >`
    SELECT id, nome, valor, data, categoria, "createdAt"
    FROM "Insumo"
    WHERE id = ${id}
    LIMIT 1
  `;
  const r = rows[0];
  return r ? rowToEntity(r) : null;
}

export async function createInsumo(input: {
  nome: string;
  valor: number;
  data: Date;
  categoria: string | null;
}): Promise<InsumoEntity> {
  const id = randomUUID();
  const createdAt = new Date();
  await prisma.$executeRaw`
    INSERT INTO "Insumo" (id, nome, valor, data, categoria, "createdAt")
    VALUES (${id}, ${input.nome}, ${input.valor}, ${input.data}, ${input.categoria}, ${createdAt})
  `;
  const created = await findInsumoById(id);
  if (!created) throw new Error("Falha ao ler insumo após inserção.");
  return created;
}

export async function updateInsumo(
  id: string,
  patch: { nome?: string; valor?: number; data?: Date; categoria?: string | null }
): Promise<InsumoEntity | null> {
  const parts: Prisma.Sql[] = [];
  if (patch.nome !== undefined) parts.push(Prisma.sql`nome = ${patch.nome}`);
  if (patch.valor !== undefined) parts.push(Prisma.sql`valor = ${patch.valor}`);
  if (patch.data !== undefined) parts.push(Prisma.sql`data = ${patch.data}`);
  if (patch.categoria !== undefined) parts.push(Prisma.sql`categoria = ${patch.categoria}`);
  if (parts.length === 0) return findInsumoById(id);

  await prisma.$executeRaw`
    UPDATE "Insumo" SET ${Prisma.join(parts, ", ")}
    WHERE id = ${id}
  `;
  return findInsumoById(id);
}

export async function deleteInsumo(id: string): Promise<boolean> {
  const existing = await findInsumoById(id);
  if (!existing) return false;
  await prisma.$executeRaw`DELETE FROM "Insumo" WHERE id = ${id}`;
  return true;
}
