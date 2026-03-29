import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { parseProductRowsFromCsv } from "@/lib/import-products-csv";

export async function POST(req: NextRequest) {
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

  async function collectionIdFor(name: string): Promise<string> {
    const key = name.trim();
    if (!key) throw new Error("Coleção vazia");
    const hit = collectionCache.get(key);
    if (hit) return hit;
    let col = await prisma.collection.findUnique({ where: { name: key } });
    if (!col) {
      col = await prisma.collection.create({ data: { name: key } });
    }
    collectionCache.set(key, col.id);
    return col.id;
  }

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

    const collectionId = await collectionIdFor(collectionName);

    const existing = await prisma.product.findFirst({
      where: { name },
    });

    if (existing) {
      await prisma.product.update({
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
      updated++;
      rowLog.push({ line: lineNumber, name, action: "updated" });
    } else {
      await prisma.product.create({
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
      created++;
      rowLog.push({ line: lineNumber, name, action: "created" });
    }
  }

  const skipped = parsed.parseErrors.length;

  return NextResponse.json({
    created,
    updated,
    skipped,
    parseErrors: parsed.parseErrors,
    rows: rowLog,
    message: `Importação concluída: ${created} produto(s) criado(s), ${updated} atualizado(s).`,
  });
}
