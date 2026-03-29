"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";

type ProductRow = {
  id: string;
  name: string;
  collectionId: string;
  collectionName: string;
  custoUnitario: number;
  lucroVarejo: number;
  lucroAtacado: number;
  precoVarejo: number;
  precoAtacado: number;
};

type Collection = { id: string; name: string };

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function ProdutosPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [search, setSearch] = useState("");
  const [collectionId, setCollectionId] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    collectionId: "",
    custoUnitario: "",
    lucroVarejo: "",
    lucroAtacado: "",
  });

  const loadProducts = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (collectionId !== "all") params.set("collectionId", collectionId);
    fetch(`/api/skus?${params}`)
      .then((r) => r.json())
      .then(setProducts);
  }, [search, collectionId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    fetch("/api/collections").then((r) => r.json()).then(setCollections);
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      collectionId: collections[0]?.id ?? "",
      custoUnitario: "",
      lucroVarejo: "",
      lucroAtacado: "",
    });
    setOpen(true);
  }

  function openEdit(row: ProductRow) {
    setEditing(row);
    setForm({
      name: row.name,
      collectionId: row.collectionId,
      custoUnitario: String(row.custoUnitario),
      lucroVarejo: String(row.lucroVarejo),
      lucroAtacado: String(row.lucroAtacado),
    });
    setOpen(true);
  }

  async function save() {
    const custoUnitario = parseFloat(form.custoUnitario) || 0;
    const lucroVarejo = parseFloat(form.lucroVarejo) || 0;
    const lucroAtacado = parseFloat(form.lucroAtacado) || 0;

    if (!form.name.trim() || !form.collectionId) {
      toast.error("Preencha nome e coleção.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      collectionId: form.collectionId,
      custoUnitario,
      lucroVarejo,
      lucroAtacado,
    };

    const res = await fetch(editing ? `/api/skus/${editing.id}` : "/api/skus", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const e = await res.json();
      toast.error(e.error || "Erro ao salvar produto");
      return;
    }

    toast.success(editing ? "Produto atualizado" : "Produto criado");
    setOpen(false);
    loadProducts();
  }

  async function onImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".csv")) {
      toast.error("Selecione um arquivo .csv");
      e.target.value = "";
      return;
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/products", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Falha na importação");
        return;
      }
      toast.success(data.message || `Importação: ${data.created} criados, ${data.updated} atualizados.`);
      if (Array.isArray(data.parseErrors) && data.parseErrors.length > 0) {
        const sample = data.parseErrors.slice(0, 3).map((x: { reason?: string }) => x.reason).join(" ");
        toast.warning(
          `${data.parseErrors.length} linha(s) não importada(s). ${sample}${data.parseErrors.length > 3 ? "…" : ""}`
        );
      }
      loadProducts();
      fetch("/api/collections")
        .then((r) => r.json())
        .then(setCollections);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  const custo = parseFloat(form.custoUnitario) || 0;
  const lucroVarejo = parseFloat(form.lucroVarejo) || 0;
  const lucroAtacado = parseFloat(form.lucroAtacado) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">Controle por modelo com custo e lucro fixo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onImportCsv}
          />
          <Button type="button" variant="outline" disabled={importing} onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "Importando…" : "Importar planilha"}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo produto
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Busque por modelo e coleção.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex min-w-[200px] flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar modelo..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={collectionId} onValueChange={setCollectionId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Coleção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {collections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead>Coleção</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Lucro varejo</TableHead>
                <TableHead className="text-right">Lucro atacado</TableHead>
                <TableHead className="text-right">Preço varejo</TableHead>
                <TableHead className="text-right">Preço atacado</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.collectionName}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.custoUnitario)}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.lucroVarejo)}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.lucroAtacado)}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.precoVarejo)}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.precoAtacado)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome do modelo</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Coleção</Label>
              <Select value={form.collectionId} onValueChange={(value) => setForm((f) => ({ ...f, collectionId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Custo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.custoUnitario}
                  onChange={(e) => setForm((f) => ({ ...f, custoUnitario: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Lucro varejo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.lucroVarejo}
                  onChange={(e) => setForm((f) => ({ ...f, lucroVarejo: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lucro atacado (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.lucroAtacado}
                onChange={(e) => setForm((f) => ({ ...f, lucroAtacado: e.target.value }))}
              />
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span>Preço varejo</span>
                <span className="font-medium">{formatMoney(custo + lucroVarejo)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Preço atacado</span>
                <span className="font-medium">{formatMoney(custo + lucroAtacado)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
