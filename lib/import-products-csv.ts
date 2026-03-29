/**
 * Parser de CSV para importação de produtos (planilhas tipo Reville / Excel export).
 */

export type ImportRowResult =
  | { ok: true; line: number; name: string; action: "created" | "updated" }
  | { ok: false; line: number; reason: string };

export type ImportProductsResult = {
  created: number;
  updated: number;
  skipped: number;
  rows: ImportRowResult[];
};

function normalizeHeader(cell: string): string {
  return cell
    .replace(/\uFEFF/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** Divide uma linha CSV respeitando aspas. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;
  const s = line.replace(/\r$/, "");
  while (i < s.length) {
    const c = s[i];
    if (c === '"') {
      if (inQuotes && s[i + 1] === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  out.push(cur.trim());
  return out;
}

/** Converte texto brasileiro (R$, vírgula decimal, milhar com ponto) em número. */
export function parseBrazilianNumber(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw)
    .replace(/\uFEFF/g, "")
    .trim();
  if (!s) return null;
  s = s.replace(/R\$\s?/gi, "").replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

type ColumnMap = {
  modelo: number;
  custo: number;
  lucroVarejo: number;
  lucroAtacado: number;
  colecao: number;
};

function buildColumnMap(headers: string[]): ColumnMap | null {
  const norm = headers.map((h) => normalizeHeader(h));
  const idx = (labels: string[]) => {
    for (const label of labels) {
      const j = norm.indexOf(normalizeHeader(label));
      if (j !== -1) return j;
    }
    return -1;
  };

  const modelo = idx(["MODELO"]);
  const lucroVarejo = idx(["LUCRO VAREJO"]);
  const lucroAtacado = idx(["LUCRO ATACADO"]);
  const colecao = idx(["COLECAO", "COLEÇÃO"]);
  const custoTotal = idx(["CUSTO TOTAL"]);
  const custoSimples = idx(["CUSTO"]);
  const custo = custoTotal !== -1 ? custoTotal : custoSimples;

  if (modelo === -1 || custo === -1 || lucroVarejo === -1 || lucroAtacado === -1 || colecao === -1) {
    return null;
  }

  return { modelo, custo, lucroVarejo, lucroAtacado, colecao };
}

function isRowEmpty(cells: string[]): boolean {
  return cells.every((c) => !c || !String(c).trim());
}

export function detectHeaderLineIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const map = buildColumnMap(cells);
    if (map) return i;
  }
  return -1;
}

export type ParsedProductRow = {
  name: string;
  collectionName: string;
  custoUnitario: number;
  lucroVarejo: number;
  lucroAtacado: number;
};

export function parseProductRowsFromCsv(csvText: string): {
  map: ColumnMap;
  headerLineIndex: number;
  rows: { lineNumber: number; data: ParsedProductRow }[];
  parseErrors: { line: number; reason: string }[];
  error?: string;
} {
  const lines = csvText.split(/\r?\n/);
  const headerLineIndex = detectHeaderLineIndex(lines);
  if (headerLineIndex === -1) {
    return {
      map: { modelo: 0, custo: 0, lucroVarejo: 0, lucroAtacado: 0, colecao: 0 },
      headerLineIndex: -1,
      rows: [],
      parseErrors: [],
      error:
        "Cabeçalho não encontrado. A planilha deve conter as colunas: MODELO, CUSTO ou CUSTO TOTAL, LUCRO VAREJO, LUCRO ATACADO, COLECAO.",
    };
  }

  const headerCells = parseCsvLine(lines[headerLineIndex]);
  const map = buildColumnMap(headerCells)!;
  const out: { lineNumber: number; data: ParsedProductRow }[] = [];
  const parseErrors: { line: number; reason: string }[] = [];

  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const cells = parseCsvLine(lines[i]);
    if (isRowEmpty(cells)) continue;

    const pad = (idx: number) => (idx < cells.length ? cells[idx] : "");
    const name = pad(map.modelo).trim();
    if (!name) continue;

    const custoUnitario = parseBrazilianNumber(pad(map.custo));
    const lucroVarejo = parseBrazilianNumber(pad(map.lucroVarejo));
    const lucroAtacado = parseBrazilianNumber(pad(map.lucroAtacado));
    const collectionName = pad(map.colecao).trim();

    if (!collectionName) {
      parseErrors.push({ line: lineNum, reason: `Linha ${lineNum}: coleção vazia para "${name}".` });
      continue;
    }
    if (custoUnitario == null) {
      parseErrors.push({ line: lineNum, reason: `Linha ${lineNum}: custo inválido para "${name}".` });
      continue;
    }
    if (lucroVarejo == null) {
      parseErrors.push({ line: lineNum, reason: `Linha ${lineNum}: lucro varejo inválido para "${name}".` });
      continue;
    }
    if (lucroAtacado == null) {
      parseErrors.push({ line: lineNum, reason: `Linha ${lineNum}: lucro atacado inválido para "${name}".` });
      continue;
    }

    out.push({
      lineNumber: lineNum,
      data: {
        name,
        collectionName,
        custoUnitario,
        lucroVarejo,
        lucroAtacado,
      },
    });
  }

  return { map, headerLineIndex, rows: out, parseErrors };
}
