"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

type InsumoRow = {
  id: string;
  nome: string;
  valor: number;
  data: string;
  categoria: string | null;
  createdAt: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatLocalYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToInputValue(iso: string) {
  return formatLocalYMD(new Date(iso));
}

type FilterMode = "month" | "period";

export default function InsumosPage() {
  const [rows, setRows] = useState<InsumoRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("month");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return formatLocalYMD(d);
  });
  const [to, setTo] = useState(() => formatLocalYMD(new Date()));

  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(() => formatLocalYMD(new Date()));
  const [categoria, setCategoria] = useState("");
  const [saving, setSaving] = useState(false);

  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [chartRows, setChartRows] = useState<InsumoRow[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<InsumoRow | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", valor: "", data: "", categoria: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const q =
        filterMode === "month"
          ? `month=${month}&year=${year}`
          : `from=${from}&to=${to}`;
      const res = await fetch(`/api/insumos?${q}`);
      if (!res.ok) return;
      const dataJson = (await res.json()) as InsumoRow[];
      setRows(Array.isArray(dataJson) ? dataJson : []);
    } finally {
      setListLoading(false);
    }
  }, [filterMode, month, year, from, to]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    let cancelled = false;
    async function loadChart() {
      setChartLoading(true);
      const start = `${chartYear}-01-01`;
      const end = `${chartYear}-12-31`;
      try {
        const res = await fetch(`/api/insumos?from=${start}&to=${end}`);
        if (!res.ok) return;
        const dataJson = (await res.json()) as InsumoRow[];
        if (!cancelled) setChartRows(Array.isArray(dataJson) ? dataJson : []);
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    }
    loadChart();
    return () => {
      cancelled = true;
    };
  }, [chartYear]);

  const totalFiltrado = useMemo(() => rows.reduce((acc, r) => acc + r.valor, 0), [rows]);

  const chartData = useMemo(() => {
    const byMonth = Array.from({ length: 12 }, (_, i) => ({
      label: new Date(2000, i, 1).toLocaleString("pt-BR", { month: "short" }).replace(".", ""),
      total: 0,
    }));
    for (const r of chartRows) {
      const d = new Date(r.data);
      if (d.getFullYear() !== chartYear) continue;
      const m = d.getMonth();
      byMonth[m].total += r.valor;
    }
    return byMonth;
  }, [chartRows, chartYear]);

  async function salvarNovo() {
    const v = parseFloat(valor.replace(",", "."));
    if (!nome.trim() || !data || Number.isNaN(v)) {
      toast.error("Preencha nome, valor e data.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/insumos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          valor: v,
          data,
          categoria: categoria.trim() || null,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        toast.error(e.error || "Erro ao salvar");
        return;
      }
      toast.success("Insumo registrado.");
      setNome("");
      setValor("");
      setCategoria("");
      setData(formatLocalYMD(new Date()));
      loadList();
      const start = `${chartYear}-01-01`;
      const end = `${chartYear}-12-31`;
      const cr = await fetch(`/api/insumos?from=${start}&to=${end}`).then((x) => x.json());
      setChartRows(Array.isArray(cr) ? cr : []);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(row: InsumoRow) {
    setEditing(row);
    setEditForm({
      nome: row.nome,
      valor: String(row.valor),
      data: isoToInputValue(row.data),
      categoria: row.categoria ?? "",
    });
    setEditOpen(true);
  }

  async function salvarEdicao() {
    if (!editing) return;
    const v = parseFloat(editForm.valor.replace(",", "."));
    if (!editForm.nome.trim() || !editForm.data || Number.isNaN(v)) {
      toast.error("Preencha nome, valor e data.");
      return;
    }
    setEditLoading(true);
    try {
      const res = await fetch(`/api/insumos/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: editForm.nome.trim(),
          valor: v,
          data: editForm.data,
          categoria: editForm.categoria.trim() || null,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        toast.error(e.error || "Erro ao atualizar");
        return;
      }
      toast.success("Insumo atualizado.");
      setEditOpen(false);
      setEditing(null);
      loadList();
      const start = `${chartYear}-01-01`;
      const end = `${chartYear}-12-31`;
      const cr = await fetch(`/api/insumos?from=${start}&to=${end}`).then((x) => x.json());
      setChartRows(Array.isArray(cr) ? cr : []);
    } finally {
      setEditLoading(false);
    }
  }

  async function apagar() {
    if (!editing) return;
    if (!confirm("Excluir este insumo? Esta ação não pode ser desfeita.")) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/insumos/${editing.id}`, { method: "DELETE" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        toast.error(typeof e.error === "string" ? e.error : "Erro ao excluir");
        return;
      }
      toast.success("Insumo excluído.");
      setEditOpen(false);
      setEditing(null);
      loadList();
      const start = `${chartYear}-01-01`;
      const end = `${chartYear}-12-31`;
      const cr = await fetch(`/api/insumos?from=${start}&to=${end}`).then((x) => x.json());
      setChartRows(Array.isArray(cr) ? cr : []);
    } finally {
      setDeleteLoading(false);
    }
  }

  const yearOptions = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Insumos</h1>
        <p className="text-muted-foreground">
          Despesas gerais por data. O total do período reduz o lucro real no dashboard e nos relatórios.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo insumo</CardTitle>
          <CardDescription>Registre um gasto; ele não fica vinculado a produto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Aluguel, Marketing, Embalagens" />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min={0} value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Categoria (opcional)</Label>
              <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex.: Operacional, Pessoal" />
            </div>
          </div>
          <Button onClick={salvarNovo} disabled={saving}>
            {saving ? "Salvando..." : "Cadastrar insumo"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listagem</CardTitle>
          <CardDescription>Filtre por mês ou por intervalo de datas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={filterMode === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("month")}
            >
              Por mês
            </Button>
            <Button
              type="button"
              variant={filterMode === "period" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("period")}
            >
              Por período
            </Button>
          </div>

          {filterMode === "month" ? (
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          )}

          {listLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum insumo no período.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.nome}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.valor)}</TableCell>
                      <TableCell>{new Date(row.data).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-muted-foreground">{row.categoria ?? "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" type="button" onClick={() => openEdit(row)} aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end border-t pt-3 text-sm">
                <span className="text-muted-foreground">Total no período:&nbsp;</span>
                <span className="font-semibold">{formatMoney(totalFiltrado)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Despesas por mês</CardTitle>
            <CardDescription>Soma dos insumos por mês no ano selecionado.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Ano</Label>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={chartYear}
              onChange={(e) => setChartYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <p className="text-sm text-muted-foreground">Carregando gráfico...</p>
          ) : (
            <div className="h-[280px] w-full min-w-0 [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={48} />
                  <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                  <Tooltip
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
                          <p className="font-medium capitalize">{label}</p>
                          <p className="text-muted-foreground">{formatMoney(Number(payload[0]?.value))}</p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="total" name="Insumos" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar insumo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editForm.nome} onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editForm.valor}
                  onChange={(e) => setEditForm((f) => ({ ...f, valor: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={editForm.data} onChange={(e) => setEditForm((f) => ({ ...f, data: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input value={editForm.categoria} onChange={(e) => setEditForm((f) => ({ ...f, categoria: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
            <Button type="button" variant="destructive" disabled={editLoading || deleteLoading} onClick={apagar}>
              {deleteLoading ? "Excluindo..." : "Excluir"}
            </Button>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:justify-end">
              <Button variant="outline" type="button" disabled={deleteLoading} onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={salvarEdicao} disabled={editLoading || deleteLoading}>
                {editLoading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
