"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, RefreshCw } from "lucide-react";

type ProductReportRow = {
  productId: string;
  productName: string;
  quantidade: number;
  receita: number;
  lucro: number;
};

type MonthlyData = {
  month: number;
  year: number;
  tipo: string;
  totals: {
    revenue: number;
    grossProfit: number;
    cardFee: number;
    netProfit: number;
    totalInsumos: number;
    realProfit: number;
    count: number;
    units: number;
  };
  byProduct: ProductReportRow[];
  rankingUnits: ProductReportRow[];
  rankingProfit: ProductReportRow[];
};

function isMonthlyPayload(j: unknown): j is MonthlyData {
  if (!j || typeof j !== "object") return false;
  const o = j as Record<string, unknown>;
  if (!o.totals || typeof o.totals !== "object") return false;
  if (!Array.isArray(o.byProduct)) return false;
  return true;
}

function formatMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function RelatoriosPage() {
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [tipo, setTipo] = useState<"all" | "varejo" | "atacado">("all");
  const fetchGeneration = useRef(0);

  const load = useCallback((): (() => void) => {
    setLoading(true);
    setError(null);
    const gen = ++fetchGeneration.current;
    const qs = new URLSearchParams({
      month: String(month),
      year: String(year),
      tipo,
    });
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 60000);
    fetch(`/api/reports/monthly?${qs}`, { signal: ac.signal })
      .then(async (r) => {
        const j: unknown = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg =
            typeof j === "object" && j && "error" in j && typeof (j as { error: unknown }).error === "string"
              ? (j as { error: string }).error
              : `Erro ${r.status}`;
          throw new Error(msg);
        }
        if (!isMonthlyPayload(j)) {
          throw new Error("Resposta inválida do servidor.");
        }
        return j;
      })
      .then((j) => {
        if (gen !== fetchGeneration.current) return;
        setData(j);
      })
      .catch((e: Error) => {
        if (gen !== fetchGeneration.current) return;
        if (e.name === "AbortError") {
          setError("Tempo esgotado ao carregar. Verifique a conexão e tente de novo.");
        } else {
          setError(e.message ?? "Falha ao carregar relatório.");
        }
        setData(null);
      })
      .finally(() => {
        clearTimeout(t);
        if (gen === fetchGeneration.current) setLoading(false);
      });
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [month, year, tipo]);

  useEffect(() => {
    const cleanup = load();
    return typeof cleanup === "function" ? cleanup : undefined;
  }, [load]);

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Relatório por produto", `${month}/${year}`, `Tipo: ${tipo}`],
      [],
      ["Resumo do mês"],
      ["Faturamento", formatMoney(data.totals.revenue)],
      ["Lucro (vendas)", formatMoney(data.totals.netProfit)],
      ["Insumos", formatMoney(data.totals.totalInsumos ?? 0)],
      ["Lucro real", formatMoney(data.totals.realProfit ?? data.totals.netProfit)],
      ["Quantidade vendida", String(data.totals.units)],
      [],
      ["Produto", "Quantidade", "Receita", "Lucro líquido"],
      ...data.byProduct.map((r) => [r.productName, String(r.quantidade), formatMoney(r.receita), formatMoney(r.lucro)]),
    ];
    const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-produtos-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
        <p>Carregando relatório…</p>
        <p className="max-w-sm text-center text-xs">Se demorar muito, o banco pode estar ocupado; use &quot;Tentar novamente&quot; abaixo.</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4 p-4 md:p-0">
        <h1 className="text-xl font-bold md:text-2xl">Relatórios</h1>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">{error}</p>
          <Button className="mt-3" variant="secondary" onClick={() => load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold md:text-2xl">Relatórios</h1>
          <p className="text-sm text-muted-foreground md:text-base">Análise por modelo com foco em receita e lucro.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap gap-2">
            <select
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm sm:flex-none"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1).toLocaleString("pt-BR", { month: "long" }).replace(/^\w/, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
            <select
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm sm:w-auto"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm sm:w-auto"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "all" | "varejo" | "atacado")}
            >
              <option value="all">Todos</option>
              <option value="varejo">Varejo</option>
              <option value="atacado">Atacado</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button className="w-full sm:w-auto" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {error}
        </p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">Resumo do mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div>
              <p className="text-xs text-muted-foreground">Faturamento</p>
              <p className="text-lg font-semibold">{formatMoney(data.totals.revenue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lucro (vendas)</p>
              <p className="text-lg font-semibold">{formatMoney(data.totals.netProfit)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Insumos</p>
              <p className="text-lg font-semibold">{formatMoney(data.totals.totalInsumos ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lucro real</p>
              <p className="text-lg font-semibold">{formatMoney(data.totals.realProfit ?? data.totals.netProfit)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Quantidade vendida</p>
              <p className="text-lg font-semibold">{data.totals.units}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">Relatório por produto</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Produto</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byProduct.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhuma venda neste período.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.byProduct.map((row) => (
                    <TableRow key={row.productId}>
                      <TableCell className="max-w-[200px] truncate sm:max-w-none">{row.productName}</TableCell>
                      <TableCell className="text-right">{row.quantidade}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatMoney(row.receita)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatMoney(row.lucro)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg">Mais vendidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.rankingUnits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              data.rankingUnits.map((r) => (
                <div key={`u-${r.productId}`} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0 break-words">{r.productName}</span>
                  <span className="shrink-0 font-medium">{r.quantidade}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg">Mais lucrativos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.rankingProfit.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              data.rankingProfit.map((r) => (
                <div key={`p-${r.productId}`} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0 break-words">{r.productName}</span>
                  <span className="shrink-0 font-medium whitespace-nowrap">{formatMoney(r.lucro)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
