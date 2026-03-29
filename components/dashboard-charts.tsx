"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DollarSign, Package, Percent, Receipt, RefreshCw, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getIsoWeekAndYear, isoWeeksInYear } from "@/lib/iso-week";
import { cn } from "@/lib/utils";

type Period = "weekly" | "monthly" | "annual";

type CompareData = {
  current: {
    revenue: number;
    netProfit: number;
    totalInsumos: number;
    realProfit: number;
    units: number;
  };
  previous: {
    revenue: number;
    netProfit: number;
    totalInsumos: number;
    realProfit: number;
    units: number;
  };
  compare: {
    revenueDiff: number;
    revenueDiffAbs: number;
    profitDiff: number;
    profitDiffAbs: number;
    insumosDiff: number;
    insumosDiffAbs: number;
    realProfitDiff: number;
    realProfitDiffAbs: number;
    unitsDiff: number;
    unitsDiffAbs: number;
  };
};

type ChartPoint = {
  label: string;
  revenue: number;
  netProfit: number;
  insumos: number;
  realProfit: number;
  units: number;
};

function formatMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function shortMoneyAxis(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(Math.round(v));
}

function DiffBadge({ diff }: { diff: number }) {
  const isUp = diff >= 0;
  return (
    <span className={cn("flex items-center gap-1 text-xs", isUp ? "text-green-600" : "text-red-600")}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {diff >= 0 ? "+" : ""}
      {diff.toFixed(1)}%
    </span>
  );
}

const YEAR_OPTIONS = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - 5 + i);

const CHART_COLORS = {
  revenue: "var(--chart-1)",
  profit: "oklch(0.55 0.14 160)",
  insumos: "var(--chart-2)",
  realProfit: "oklch(0.45 0.12 280)",
  units: "var(--chart-3)",
};

export function DashboardCharts() {
  const [data, setData] = useState<CompareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState<ChartPoint[] | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [period, setPeriod] = useState<Period>("monthly");

  const now = useMemo(() => new Date(), []);
  const initialIso = useMemo(() => getIsoWeekAndYear(now), [now]);

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [isoYear, setIsoYear] = useState(initialIso.isoYear);
  const [isoWeek, setIsoWeek] = useState(initialIso.week);

  const maxWeek = isoWeeksInYear(isoYear);
  const safeWeek = Math.min(isoWeek, maxWeek);

  useEffect(() => {
    if (isoWeek > maxWeek) setIsoWeek(maxWeek);
  }, [isoWeek, maxWeek]);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("period", period);
    if (period === "monthly") {
      params.set("month", String(month));
      params.set("year", String(year));
    } else if (period === "annual") {
      params.set("year", String(year));
    } else {
      params.set("year", String(isoYear));
      params.set("week", String(safeWeek));
    }
    return params;
  }, [period, month, year, isoYear, safeWeek]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      setChartError(null);
      const params = buildParams();
      const url = `/api/reports/dashboard?${params}`;

      const attempts = 4;
      const baseDelay = 500;
      let lastErr = "Não foi possível carregar o dashboard.";

      for (let attempt = 0; attempt < attempts; attempt++) {
        if (cancelled) return;
        try {
          const res = await fetch(url);
          const json: unknown = await res.json().catch(() => null);

          if (cancelled) return;

          if (!res.ok) {
            const msg =
              json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string"
                ? (json as { error: string }).error
                : `Erro ${res.status}`;
            lastErr = msg;
            if (attempt < attempts - 1) {
              await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
              continue;
            }
            setData(null);
            setSeries(null);
            setError(msg);
            setChartError(msg);
            break;
          }

          if (
            !json ||
            typeof json !== "object" ||
            !("current" in json) ||
            !("chart" in json) ||
            typeof (json as { chart: unknown }).chart !== "object"
          ) {
            lastErr = "Resposta inválida do servidor.";
            if (attempt < attempts - 1) {
              await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
              continue;
            }
            setData(null);
            setSeries(null);
            setError(lastErr);
            setChartError(lastErr);
            break;
          }

          const payload = json as CompareData & {
            chart: { data?: ChartPoint[]; period?: string };
          };

          setData({
            current: payload.current,
            previous: payload.previous,
            compare: payload.compare,
          });

          const raw = payload.chart?.data;
          if (Array.isArray(raw)) {
            setSeries(
              raw.map((pt: ChartPoint & { insumos?: number; realProfit?: number }) => ({
                label: pt.label,
                revenue: pt.revenue,
                netProfit: pt.netProfit,
                units: pt.units,
                insumos: typeof pt.insumos === "number" ? pt.insumos : 0,
                realProfit:
                  typeof pt.realProfit === "number"
                    ? pt.realProfit
                    : pt.netProfit - (typeof pt.insumos === "number" ? pt.insumos : 0),
              })),
            );
            setChartError(null);
          } else {
            setSeries(null);
            setChartError("Dados do gráfico indisponíveis.");
          }
          setError(null);
          break;
        } catch {
          lastErr = "Falha de rede. Verifique a conexão.";
          if (attempt < attempts - 1) {
            await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
            continue;
          }
          if (!cancelled) {
            setData(null);
            setSeries(null);
            setError(lastErr);
            setChartError(lastErr);
          }
        }
      }

      if (!cancelled) setLoading(false);
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [buildParams, retryKey]);

  const labels = useMemo(() => {
    if (period === "weekly") {
      return {
        revenue: "Faturamento da semana",
        profit: "Lucro das vendas (semana)",
        insumos: "Insumos da semana",
        realProfit: "Lucro real da semana",
        units: "Quantidade vendida (semana)",
      };
    }
    if (period === "annual") {
      return {
        revenue: "Faturamento do ano",
        profit: "Lucro das vendas (ano)",
        insumos: "Insumos do ano",
        realProfit: "Lucro real do ano",
        units: "Quantidade vendida (ano)",
      };
    }
    return {
      revenue: "Faturamento do mês",
      profit: "Lucro das vendas (mês)",
      insumos: "Insumos do mês",
      realProfit: "Lucro real do mês",
      units: "Quantidade vendida (mês)",
    };
  }, [period]);

  const chartDescription = useMemo(() => {
    if (period === "weekly") return "Por dia da semana selecionada (ISO).";
    if (period === "annual") return "Por mês do ano selecionado.";
    return "Por dia do mês selecionado.";
  }, [period]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Período</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-full min-w-0 sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="annual">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {period === "monthly" && (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Mês</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-full min-w-0 sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {new Date(2000, m - 1).toLocaleString("pt-BR", { month: "long" }).replace(/^\w/, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Ano</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-full min-w-0 sm:w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {period === "annual" && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-full min-w-0 sm:w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {period === "weekly" && (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Ano (ISO)</Label>
              <Select value={String(isoYear)} onValueChange={(v) => setIsoYear(Number(v))}>
                <SelectTrigger className="w-full min-w-0 sm:w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Semana</Label>
              <Select value={String(safeWeek)} onValueChange={(v) => setIsoWeek(Number(v))}>
                <SelectTrigger className="w-full min-w-0 sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxWeek }, (_, i) => i + 1).map((w) => (
                    <SelectItem key={w} value={String(w)}>
                      Semana {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Carregando indicadores e gráficos...</p>
      )}

      {error && (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" className="shrink-0 border-destructive/40" onClick={() => setRetryKey((k) => k + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      )}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{labels.revenue}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(data.current.revenue)}</div>
              <DiffBadge diff={data.compare.revenueDiff} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{labels.profit}</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(data.current.netProfit)}</div>
              <DiffBadge diff={data.compare.profitDiff} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{labels.insumos}</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(data.current.totalInsumos)}</div>
              <DiffBadge diff={data.compare.insumosDiff} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{labels.realProfit}</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(data.current.realProfit)}</div>
              <DiffBadge diff={data.compare.realProfitDiff} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{labels.units}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.current.units}</div>
              <DiffBadge diff={data.compare.unitsDiff} />
            </CardContent>
          </Card>
        </div>
      )}

      {chartError && !error && (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span>{chartError}</span>
          <Button type="button" variant="outline" size="sm" className="shrink-0 border-destructive/40" onClick={() => setRetryKey((k) => k + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      )}

      {series && !chartError && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Faturamento, vendas, insumos e lucro real</CardTitle>
              <CardDescription>{chartDescription}</CardDescription>
            </CardHeader>
            <CardContent className="pl-0">
              <div className="text-muted-foreground h-[300px] w-full min-w-0 [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-legend-item-text]:text-muted-foreground">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={period === "monthly" ? "preserveStartEnd" : 0} />
                    <YAxis tickFormatter={shortMoneyAxis} tick={{ fontSize: 11 }} width={44} />
                    <Tooltip
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
                            <p className="mb-1 font-medium text-foreground">{label}</p>
                            {payload
                              .filter((p) => p.dataKey !== "units")
                              .map((p) => (
                                <p key={String(p.dataKey)} className="text-muted-foreground">
                                  {p.name}: {formatMoney(Number(p.value))}
                                </p>
                              ))}
                          </div>
                        ) : null
                      }
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Faturamento" fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="netProfit" name="Lucro (vendas)" fill={CHART_COLORS.profit} radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="insumos" name="Insumos" fill={CHART_COLORS.insumos} radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Line
                      type="monotone"
                      dataKey="realProfit"
                      name="Lucro real"
                      stroke={CHART_COLORS.realProfit}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quantidade vendida</CardTitle>
              <CardDescription>{chartDescription}</CardDescription>
            </CardHeader>
            <CardContent className="pl-0">
              <div className="text-muted-foreground h-[300px] w-full min-w-0 [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-legend-item-text]:text-muted-foreground">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={period === "monthly" ? "preserveStartEnd" : 0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                    <Tooltip
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
                            <p className="mb-1 font-medium">{label}</p>
                            <p className="text-muted-foreground">Unidades: {payload[0]?.value}</p>
                          </div>
                        ) : null
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="units"
                      name="Unidades"
                      stroke={CHART_COLORS.units}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
