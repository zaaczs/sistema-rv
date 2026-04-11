"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, RefreshCw } from "lucide-react";
import { getIsoWeekAndYear, isoWeeksInYear } from "@/lib/iso-week";

type ProductReportRow = {
  productId: string;
  productName: string;
  quantidade: number;
  receita: number;
  lucro: number;
};

type MonthlyData = {
  period: "weekly" | "monthly" | "quarterly" | "semiannual" | "annual";
  month: number;
  year: number;
  week?: number;
  quarter?: number;
  semester?: number;
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
  const now = new Date();
  const nowIso = getIsoWeekAndYear(now);
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"weekly" | "monthly" | "quarterly" | "semiannual" | "annual">("monthly");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [semester, setSemester] = useState(now.getMonth() < 6 ? 1 : 2);
  const [isoYear, setIsoYear] = useState(nowIso.isoYear);
  const [isoWeek, setIsoWeek] = useState(nowIso.week);
  const [tipo, setTipo] = useState<"all" | "varejo" | "atacado">("all");
  const [reloadKey, setReloadKey] = useState(0);
  const fetchGeneration = useRef(0);
  const maxWeek = isoWeeksInYear(isoYear);
  const safeWeek = Math.min(isoWeek, maxWeek);

  useEffect(() => {
    let cancelled = false;
    const gen = ++fetchGeneration.current;
    const qs = new URLSearchParams({
      period,
      tipo,
    });
    if (period === "monthly") {
      qs.set("month", String(month));
      qs.set("year", String(year));
    } else if (period === "quarterly") {
      qs.set("year", String(year));
      qs.set("quarter", String(quarter));
    } else if (period === "semiannual") {
      qs.set("year", String(year));
      qs.set("semester", String(semester));
    } else if (period === "annual") {
      qs.set("year", String(year));
    } else {
      qs.set("year", String(isoYear));
      qs.set("week", String(safeWeek));
    }
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 60000);
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/reports/monthly?${qs}`, { signal: ac.signal });
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
        if (cancelled || gen !== fetchGeneration.current) return;
        setData(j);
      } catch (e) {
        if (cancelled || gen !== fetchGeneration.current) return;
        const err = e as Error;
        if (err.name === "AbortError") {
          setError("Tempo esgotado ao carregar. Verifique a conexão e tente de novo.");
        } else {
          setError(err.message ?? "Falha ao carregar relatório.");
        }
        setData(null);
      } finally {
        clearTimeout(t);
        if (!cancelled && gen === fetchGeneration.current) setLoading(false);
      }
    }
    loadData();

    return () => {
      cancelled = true;
      clearTimeout(t);
      ac.abort();
    };
  }, [period, month, year, quarter, semester, isoYear, safeWeek, tipo, reloadKey]);

  function exportCsv() {
    if (!data) return;
    const periodLabel =
      period === "weekly"
        ? `Semana ${safeWeek}/${isoYear}`
        : period === "monthly"
          ? `${month}/${year}`
          : period === "quarterly"
            ? `${quarter}º trimestre/${year}`
            : period === "semiannual"
              ? `${semester}º semestre/${year}`
              : `Ano ${year}`;
    const rows = [
      ["Relatório por produto", periodLabel, `Tipo: ${tipo}`],
      [],
      ["Resumo do período"],
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
    a.download = `relatorio-produtos-${period}-${year}.csv`;
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
          <Button className="mt-3" variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
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
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm sm:w-auto"
              value={period}
              onChange={(e) => setPeriod(e.target.value as "weekly" | "monthly" | "quarterly" | "semiannual" | "annual")}
            >
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
              <option value="quarterly">Trimestral</option>
              <option value="semiannual">Semestral</option>
              <option value="annual">Anual</option>
            </select>
            {period === "monthly" && (
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
            )}
            {period === "weekly" && (
              <>
                <select
                  className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm sm:w-auto"
                  value={isoYear}
                  onChange={(e) => setIsoYear(Number(e.target.value))}
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <select
                  className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm sm:w-auto"
                  value={safeWeek}
                  onChange={(e) => setIsoWeek(Number(e.target.value))}
                >
                  {Array.from({ length: maxWeek }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      Semana {w}
                    </option>
                  ))}
                </select>
              </>
            )}
            {period === "quarterly" && (
              <select
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm sm:w-auto"
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
              >
                <option value={1}>1º trimestre</option>
                <option value={2}>2º trimestre</option>
                <option value={3}>3º trimestre</option>
                <option value={4}>4º trimestre</option>
              </select>
            )}
            {period === "semiannual" && (
              <select
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm sm:w-auto"
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
              >
                <option value={1}>1º semestre</option>
                <option value={2}>2º semestre</option>
              </select>
            )}
            <select
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm sm:flex-none"
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
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setReloadKey((k) => k + 1)} disabled={loading}>
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
          <CardTitle className="text-base md:text-lg">Resumo do período</CardTitle>
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
