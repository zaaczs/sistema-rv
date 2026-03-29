"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";

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

function formatMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function RelatoriosPage() {
  const [data, setData] = useState<MonthlyData | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [tipo, setTipo] = useState<"all" | "varejo" | "atacado">("all");

  useEffect(() => {
    fetch(`/api/reports/monthly?month=${month}&year=${year}&tipo=${tipo}`)
      .then((r) => r.json())
      .then(setData);
  }, [month, year, tipo]);

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

  if (!data) return <div className="p-8">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Análise por modelo com foco em receita e lucro.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="rounded border bg-background px-2 py-1 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1).toLocaleString("pt-BR", { month: "long" }).replace(/^\w/, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
          <select className="rounded border bg-background px-2 py-1 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select className="rounded border bg-background px-2 py-1 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value as "all" | "varejo" | "atacado")}>
            <option value="all">Todos</option>
            <option value="varejo">Varejo</option>
            <option value="atacado">Atacado</option>
          </select>
          <Button onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo do mês</CardTitle>
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
        <CardHeader>
          <CardTitle>Relatório por produto</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byProduct.map((row) => (
                <TableRow key={row.productId}>
                  <TableCell>{row.productName}</TableCell>
                  <TableCell className="text-right">{row.quantidade}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.receita)}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.lucro)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mais vendidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.rankingUnits.map((r) => (
              <div key={`u-${r.productId}`} className="flex items-center justify-between text-sm">
                <span>{r.productName}</span>
                <span className="font-medium">{r.quantidade}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mais lucrativos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.rankingProfit.map((r) => (
              <div key={`p-${r.productId}`} className="flex items-center justify-between text-sm">
                <span>{r.productName}</span>
                <span className="font-medium">{formatMoney(r.lucro)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
