"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

type ProductOption = {
  id: string;
  name: string;
  precoVarejo: number;
  precoAtacado: number;
  lucroVarejo: number;
  lucroAtacado: number;
};

type SaleRow = {
  id: string;
  data: string;
  tipo: string;
  produtoId: string | null;
  produtoNome: string;
  quantidade: number;
  precoUnitarioAplicado: number;
  lucroUnitario: number;
  taxaCartao: number;
  receita: number;
  lucroBruto: number;
  lucroLiquido: number;
  observacao: string | null;
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

function saleDateToInputValue(iso: string) {
  const d = new Date(iso);
  return formatLocalYMD(d);
}

/** Evita artefatos de ponto flutuante em inputs numéricos (ex.: 79,899999…). */
function formatDecimalForInput(n: number) {
  if (!Number.isFinite(n)) return "0";
  return (Math.round(n * 100) / 100).toFixed(2);
}

export default function VendasPage() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [data, setData] = useState(() => formatLocalYMD(new Date()));
  const [tipo, setTipo] = useState<"varejo" | "atacado">("varejo");
  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [precoUnitario, setPrecoUnitario] = useState("0");
  const [taxaCartao, setTaxaCartao] = useState("0");
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<SaleRow | null>(null);
  const [editForm, setEditForm] = useState({
    data: "",
    tipo: "varejo" as "varejo" | "atacado",
    produtoId: "",
    quantidade: "1",
    precoUnitario: "0",
    taxaCartao: "0",
    observacao: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadSales = useCallback(async () => {
    setListLoading(true);
    try {
      const to = new Date();
      const from = new Date();
      from.setMonth(from.getMonth() - 6);
      const res = await fetch(`/api/sales?from=${formatLocalYMD(from)}&to=${formatLocalYMD(to)}`);
      if (!res.ok) return;
      const rows = (await res.json()) as SaleRow[];
      setSales(Array.isArray(rows) ? rows : []);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/skus")
      .then((r) => r.json())
      .then((rows: ProductOption[]) => {
        setProducts(rows);
        if (rows.length > 0) {
          setProdutoId(rows[0].id);
        }
      });
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === produtoId) ?? null,
    [products, produtoId]
  );

  useEffect(() => {
    if (!selectedProduct) return;
    const defaultPrice = tipo === "varejo" ? selectedProduct.precoVarejo : selectedProduct.precoAtacado;
    setPrecoUnitario(String(defaultPrice));
  }, [selectedProduct, tipo]);

  const qtd = parseInt(quantidade, 10) || 0;
  const preco = parseFloat(precoUnitario) || 0;
  const taxa = parseFloat(taxaCartao) || 0;
  const lucroUnitario = selectedProduct
    ? tipo === "varejo"
      ? selectedProduct.lucroVarejo
      : selectedProduct.lucroAtacado
    : 0;

  const receita = qtd * preco;
  const lucroBruto = qtd * lucroUnitario;
  const lucroLiquido = lucroBruto - taxa;

  async function salvarVenda() {
    if (!produtoId || !data || qtd <= 0) {
      toast.error("Preencha data, produto e quantidade.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: new Date(`${data}T12:00:00`).toISOString(),
          tipo,
          produtoId,
          quantidade: qtd,
          precoUnitarioAplicado: preco,
          taxaCartao: taxa,
          observacao: observacao.trim() || null,
        }),
      });

      if (!res.ok) {
        const e = await res.json();
        toast.error(e.error || "Erro ao registrar venda");
        return;
      }

      toast.success("Venda registrada com sucesso.");
      setQuantidade("1");
      setTaxaCartao("0");
      setObservacao("");
      loadSales();
    } finally {
      setLoading(false);
    }
  }

  function openEdit(row: SaleRow) {
    setEditing(row);
    const validPid =
      row.produtoId && products.some((p) => p.id === row.produtoId) ? row.produtoId : products[0]?.id ?? "";
    setEditForm({
      data: saleDateToInputValue(row.data),
      tipo: row.tipo === "atacado" ? "atacado" : "varejo",
      produtoId: validPid,
      quantidade: String(row.quantidade),
      precoUnitario: formatDecimalForInput(row.precoUnitarioAplicado),
      taxaCartao: formatDecimalForInput(row.taxaCartao),
      observacao: row.observacao ?? "",
    });
    setEditOpen(true);
  }

  const editProduct = useMemo(
    () => products.find((p) => p.id === editForm.produtoId) ?? null,
    [products, editForm.produtoId]
  );

  const editQtd = parseInt(editForm.quantidade, 10) || 0;
  const editPreco = parseFloat(editForm.precoUnitario) || 0;
  const editTaxa = parseFloat(editForm.taxaCartao) || 0;
  const editLucroUnit =
    editProduct && editForm.tipo === "varejo"
      ? editProduct.lucroVarejo
      : editProduct && editForm.tipo === "atacado"
        ? editProduct.lucroAtacado
        : 0;
  const editReceita = editQtd * editPreco;
  const editLucroBruto = editQtd * editLucroUnit;
  const editLucroLiq = editLucroBruto - editTaxa;

  async function salvarEdicao() {
    if (!editing || !editForm.produtoId || !editForm.data || editQtd <= 0) {
      toast.error("Preencha data, produto e quantidade.");
      return;
    }

    setEditLoading(true);
    try {
      const res = await fetch(`/api/sales/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: new Date(`${editForm.data}T12:00:00`).toISOString(),
          tipo: editForm.tipo,
          produtoId: editForm.produtoId,
          quantidade: editQtd,
          precoUnitarioAplicado: editPreco,
          taxaCartao: editTaxa,
          observacao: editForm.observacao.trim() || null,
        }),
      });

      if (!res.ok) {
        const e = await res.json();
        toast.error(e.error || "Erro ao atualizar venda");
        return;
      }

      toast.success("Venda atualizada.");
      setEditOpen(false);
      setEditing(null);
      loadSales();
    } finally {
      setEditLoading(false);
    }
  }

  async function apagarVenda() {
    if (!editing) return;
    if (
      !confirm(
        "Excluir esta venda permanentemente? Esta ação não pode ser desfeita."
      )
    ) {
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/sales/${editing.id}`, { method: "DELETE" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        toast.error(typeof e.error === "string" ? e.error : "Erro ao excluir venda");
        return;
      }
      toast.success("Venda excluída.");
      setEditOpen(false);
      setEditing(null);
      loadSales();
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Registro de venda</h1>
        <p className="text-muted-foreground">Venda por modelo com lucro líquido calculado em tempo real.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova venda</CardTitle>
          <CardDescription>Tipo varejo/atacado define preço e lucro unitário padrão do produto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(value: "varejo" | "atacado") => setTipo(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="varejo">Varejo</SelectItem>
                  <SelectItem value="atacado">Atacado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Produto</Label>
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Preço unitário aplicado</Label>
              <Input
                type="number"
                step="0.01"
                value={precoUnitario}
                onChange={(e) => setPrecoUnitario(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Taxa de cartão (opcional)</Label>
              <Input type="number" step="0.01" min={0} value={taxaCartao} onChange={(e) => setTaxaCartao(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <textarea
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              placeholder="Ex.: cliente especial, desconto aplicado, forma de pagamento..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumo em tempo real</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Lucro unitário usado</span>
                <span>{formatMoney(lucroUnitario)}</span>
              </div>
              <div className="flex justify-between">
                <span>Receita</span>
                <span>{formatMoney(receita)}</span>
              </div>
              <div className="flex justify-between">
                <span>Lucro bruto</span>
                <span>{formatMoney(lucroBruto)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxa de cartão</span>
                <span>- {formatMoney(taxa)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Lucro líquido</span>
                <span>{formatMoney(lucroLiquido)}</span>
              </div>
            </CardContent>
          </Card>

          <Button onClick={salvarVenda} disabled={loading}>
            {loading ? "Salvando..." : "Registrar venda"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendas recentes</CardTitle>
          <CardDescription>Últimos 6 meses — clique no lápis para corrigir uma venda.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {listLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando vendas...</p>
          ) : sales.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma venda no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Lucro líq.</TableHead>
                  <TableHead>Obs.</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{new Date(row.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{row.produtoNome}</TableCell>
                    <TableCell className="capitalize">{row.tipo}</TableCell>
                    <TableCell className="text-right">{row.quantidade}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.receita)}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.lucroLiquido)}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-muted-foreground" title={row.observacao ?? undefined}>
                      {row.observacao || "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" type="button" onClick={() => openEdit(row)} aria-label="Editar venda">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar venda</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={editForm.data}
                  onChange={(e) => setEditForm((f) => ({ ...f, data: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={editForm.tipo}
                  onValueChange={(value: "varejo" | "atacado") => setEditForm((f) => ({ ...f, tipo: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="varejo">Varejo</SelectItem>
                    <SelectItem value="atacado">Atacado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select
                value={editForm.produtoId}
                onValueChange={(v) => setEditForm((f) => ({ ...f, produtoId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={editForm.quantidade}
                  onChange={(e) => setEditForm((f) => ({ ...f, quantidade: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Preço unitário</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.precoUnitario}
                  onChange={(e) => setEditForm((f) => ({ ...f, precoUnitario: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Taxa cartão</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editForm.taxaCartao}
                  onChange={(e) => setEditForm((f) => ({ ...f, taxaCartao: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <textarea
                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                placeholder="Ex.: cliente especial, desconto aplicado..."
                value={editForm.observacao}
                onChange={(e) => setEditForm((f) => ({ ...f, observacao: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span>Receita</span>
                <span className="font-medium">{formatMoney(editReceita)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Lucro líquido</span>
                <span className="font-medium">{formatMoney(editLucroLiq)}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
            <Button
              type="button"
              variant="destructive"
              disabled={editLoading || deleteLoading}
              onClick={apagarVenda}
            >
              {deleteLoading ? "Excluindo..." : "Apagar venda"}
            </Button>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                type="button"
                disabled={deleteLoading}
                onClick={() => setEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={salvarEdicao} disabled={editLoading || deleteLoading}>
                {editLoading ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
