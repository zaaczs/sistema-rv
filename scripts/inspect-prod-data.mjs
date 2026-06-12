import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const salesByMonth = await prisma.$queryRaw`
    SELECT date_trunc('month', data) AS mes,
           COUNT(*) FILTER (WHERE "deletedAt" IS NULL)::int AS ativas,
           COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL)::int AS excluidas
    FROM "Sale"
    GROUP BY 1
    ORDER BY 1
  `;
  console.log("=== Vendas por mês (campo data) ===");
  console.table(salesByMonth);

  const insumosByMonth = await prisma.$queryRaw`
    SELECT date_trunc('month', data) AS mes, COUNT(*)::int AS total
    FROM "Insumo"
    WHERE "deletedAt" IS NULL
    GROUP BY 1
    ORDER BY 1
  `;
  console.log("\n=== Insumos por mês ===");
  console.table(insumosByMonth);

  const range = await prisma.$queryRaw`
    SELECT MIN(data) AS min_data, MAX(data) AS max_data,
           COUNT(*) FILTER (WHERE "deletedAt" IS NULL)::int AS ativas
    FROM "Sale"
  `;
  console.log("\n=== Faixa de datas (vendas ativas) ===");
  console.table(range);

  const may2026 = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total,
           COALESCE(SUM(receita), 0)::float AS receita,
           COALESCE(SUM("lucroLiquido"), 0)::float AS lucro,
           COALESCE(SUM(quantidade), 0)::int AS unidades
    FROM "Sale"
    WHERE data >= '2026-05-01' AND data < '2026-06-01'
      AND ("deletedAt" IS NULL OR "deletedAt" IS NOT NULL)
  `;
  console.log("\n=== Maio/2026 (resumo) ===");
  console.table(may2026);

  const may2026Deleted = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total
    FROM "Sale"
    WHERE data >= '2026-05-01' AND data < '2026-06-01' AND "deletedAt" IS NOT NULL
  `;
  console.log("\n=== Maio/2026 (vendas soft-deleted) ===");
  console.table(may2026Deleted);

  const deletes = await prisma.auditLog.findMany({
    where: { entity: "Sale", action: "DELETE" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { createdAt: true, entityId: true, actorEmail: true, metadata: true },
  });
  console.log("\n=== Últimos 20 DELETE em AuditLog (Sale) ===");
  console.table(deletes);

  const byCreated = await prisma.$queryRaw`
    SELECT date_trunc('month', "createdAt") AS mes, COUNT(*)::int AS total
    FROM "Sale"
    GROUP BY 1
    ORDER BY 1
  `;
  console.log("\n=== Vendas por mês (createdAt) ===");
  console.table(byCreated);

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { createdAt: true, entity: true, action: true, actorEmail: true },
  });
  console.log("\n=== Últimos 30 AuditLog ===");
  console.table(logs);

  const prods = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { name: true, createdAt: true },
  });
  console.log("\n=== Produtos mais recentes (createdAt) ===");
  console.table(prods);

  const products = await prisma.product.count();
  const customers = await prisma.customer.count({ where: { deletedAt: null } });
  console.log("\n=== Contagens gerais ===");
  console.log({ products, customers });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
