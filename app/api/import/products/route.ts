import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { parseProductRowsFromCsv } from "@/lib/import-products-csv";
import { withDbRetry } from "@/lib/db-retry";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    let csvText: string;
    const ct = req.headers.get("content-type") ?? "";

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ error: "Envie um arquivo CSV no campo \"file\"." }, { status: 400 });
      }
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Arquivo muito grande (máx. 5 MB)." }, { status: 400 });
      }
      csvText = await file.text();
    } else if (ct.includes("application/json")) {
      let body: { csvText?: string };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
      }
      if (!body.csvText || typeof body.csvText !== "string") {
        return NextResponse.json({ error: "Campo csvText é obrigatório." }, { status: 400 });
      }
      csvText = body.csvText;
    } else {
      return NextResponse.json(
        { error: "Use multipart/form-data com campo \"file\" ou application/json com { \"csvText\": \"...\" }." },
        { status: 415 }
      );
    }

    const parsed = parseProductRowsFromCsv(csvText);
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error, parseErrors: parsed.parseErrors }, { status: 400 });
    }

    const collectionCache = new Map<string, string>();

    let created = 0;
    let updated = 0;
    const rowLog: { line: number; name: string; action: "created" | "updated" }[] = [];

    for (const { lineNumber, data } of parsed.rows) {
      const { name, collectionName, custoUnitario, lucroVarejo, lucroAtacado } = data;
      const precoVarejo = custoUnitario + lucroVarejo;
      const precoAtacado = custoUnitario + lucroAtacado;

      if (custoUnitario < 0 || lucroVarejo < 0 || lucroAtacado < 0) {
        continue;
      }

      const action = await withDbRetry(() =>
        prisma.$transaction(async (tx) => {
          const key = collectionName.trim();
          if (!key) throw new Error("Coleção vazia");
          let collectionId = collectionCache.get(key);
          if (!collectionId) {
            let col = await tx.collection.findUnique({ where: { name: key } });
            if (!col) col = await tx.collection.create({ data: { name: key } });
            collectionId = col.id;
            collectionCache.set(key, collectionId);
          }

          const existing = await tx.product.findFirst({ where: { name } });
          if (existing) {
            await tx.product.update({
              where: { id: existing.id },
              data: {
                collectionId,
                custoUnitario: new Decimal(custoUnitario),
                lucroVarejo: new Decimal(lucroVarejo),
                lucroAtacado: new Decimal(lucroAtacado),
                precoVarejo: new Decimal(precoVarejo),
                precoAtacado: new Decimal(precoAtacado),
              },
            });
            return "updated" as const;
          }

          await tx.product.create({
            data: {
              name,
              collectionId,
              custoUnitario: new Decimal(custoUnitario),
              lucroVarejo: new Decimal(lucroVarejo),
              lucroAtacado: new Decimal(lucroAtacado),
              precoVarejo: new Decimal(precoVarejo),
              precoAtacado: new Decimal(precoAtacado),
            },
          });
          return "created" as const;
        }),
      );

      if (action === "created") created++;
      if (action === "updated") updated++;
      rowLog.push({ line: lineNumber, name, action });
    }

    const skipped = parsed.parseErrors.length;

    await writeAuditLog({
      entity: "ProductImport",
      entityId: "csv",
      action: "IMPORT",
      session,
      metadata: { created, updated, skipped },
    });

    return NextResponse.json({
      created,
      updated,
      skipped,
      parseErrors: parsed.parseErrors,
      rows: rowLog,
      message: `Importação concluída: ${created} produto(s) criado(s), ${updated} atualizado(s).`,
    });
  } catch (error) {
    console.error("POST /api/import/products:", error);
    return NextResponse.json(
      { error: "Falha na importação no servidor. Verifique as variáveis de ambiente e conexão com o banco." },
      { status: 500 },
    );
  }
}
