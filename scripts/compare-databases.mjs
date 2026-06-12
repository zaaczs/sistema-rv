import { PrismaClient } from "@prisma/client";

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
if (!sourceUrl || !targetUrl) {
  console.error("Defina SOURCE_DATABASE_URL (Supabase) e TARGET_DATABASE_URL (Heroku).");
  process.exit(1);
}

async function stats(label, url) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  const hasDeletedAt = await p.$queryRaw`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'Sale' AND column_name = 'deletedAt'
    ) AS ok
  `;
  const filterDeleted = hasDeletedAt[0]?.ok ? `WHERE "deletedAt" IS NULL` : "";
  const salesByMonth = await p.$queryRawUnsafe(`
    SELECT date_trunc('month', data) AS mes, COUNT(*)::int AS total
    FROM "Sale"
    ${filterDeleted}
    GROUP BY 1
    ORDER BY 1
  `);
  const customerFilter = hasDeletedAt[0]?.ok
    ? `(SELECT COUNT(*)::int FROM "Customer" WHERE "deletedAt" IS NULL)`
    : `(SELECT COUNT(*)::int FROM "Customer")`;
  const insumoFilter = await p.$queryRaw`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'Insumo' AND column_name = 'deletedAt'
    ) AS ok
  `;
  const insumosCount = insumoFilter[0]?.ok
    ? `(SELECT COUNT(*)::int FROM "Insumo" WHERE "deletedAt" IS NULL)`
    : `(SELECT COUNT(*)::int FROM "Insumo")`;
  const saleCount = filterDeleted
    ? `(SELECT COUNT(*)::int FROM "Sale" WHERE "deletedAt" IS NULL)`
    : `(SELECT COUNT(*)::int FROM "Sale")`;
  const totals = await p.$queryRawUnsafe(`
    SELECT
      ${saleCount} AS sales,
      (SELECT COUNT(*)::int FROM "Product") AS products,
      ${customerFilter} AS customers,
      ${insumosCount} AS insumos,
      (SELECT COUNT(*)::int FROM "Sku") AS skus
  `);
  await p.$disconnect();
  console.log(`\n=== ${label} ===`);
  console.table(totals);
  console.log("Vendas por mês:");
  console.table(salesByMonth);
}

await stats("SUPABASE (origem)", sourceUrl);
await stats("HEROKU (destino)", targetUrl);
