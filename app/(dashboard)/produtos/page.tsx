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
  tecido: string;
  custoUnitario: number;
  lucroVarejo: number;
  lucroAtacado: number;
  precoVarejo: number;
  precoAtacado: number;
};

type Collection = { id: string; name: string };
const TECIDOS = ["WONDER", "NAGOYA", "NEW TRIP"] as const;
type ProductFormState = {
  name: string;
  collectionId: string;
  tecido: string;
  custoUnitario: string;
  precoVarejo: string;
  precoAtacado: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
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
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [form, setForm] = useState<ProductFormState>({
    name: "",
    collectionId: "",
    tecido: TECIDOS[0],
    custoUnitario: "",
    precoVarejo: "",
    precoAtacado: "",
  });

  const loadProducts = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (collectionId !== "all") params.set("collectionId", collectionId);
    fetch(`/api/skus?${params}`)
      .then(async (r) => {
        const data = await parseJsonSafe(r);
        if (!r.ok) {
          toast.error(typeof data?.error === "string" ? data.error : "Falha ao carregar produtos.");
          return;
        }
        if (Array.isArray(data)) {
          setProducts(data);
          return;
        }
        setProducts([]);
      })
      .catch(() => {
        toast.error("Falha de rede ao carregar produtos.");
        setProducts([]);
      });
  }, [search, collectionId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const loadCollections = useCallback(() => {
    fetch("/api/collections")
      .then(async (r) => {
        const data = await parseJsonSafe(r);
        if (!r.ok) {
          toast.error(typeof data?.error === "string" ? data.error : "Falha ao carregar coleções.");
          return;
        }
        if (Array.isArray(data)) {
          setCollections(data);
          return;
        }
        setCollections([]);
      })
      .catch(() => {
        toast.error("Falha de rede ao carregar coleções.");
        setCollections([]);
      });
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      collectionId: collections[0]?.id ?? "",
      tecido: TECIDOS[0],
      custoUnitario: "",
      precoVarejo: "",
      precoAtacado: "",
    });
    setNewCollectionName("");
    setOpen(true);
  }

  function openEdit(row: ProductRow) {
    setEditing(row);
    setForm({
      name: row.name,
      collectionId: row.collectionId,
      tecido: row.tecido || TECIDOS[0],
      custoUnitario: String(row.custoUnitario),
      precoVarejo: String(row.precoVarejo),
      precoAtacado: String(row.precoAtacado),
    });
    setNewCollectionName("");
    setOpen(true);
  }

  async function save() {
    const custoUnitario = parseFloat(form.custoUnitario) || 0;
    const precoVarejo = parseFloat(form.precoVarejo) || 0;
    const precoAtacado = parseFloat(form.precoAtacado) || 0;
    const lucroVarejo = precoVarejo - custoUnitario;
    const lucroAtacado = precoAtacado - custoUnitario;

    if (!form.name.trim() || !form.collectionId || !form.tecido) {
      toast.error("Preencha nome, coleção e tecido.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      collectionId: form.collectionId,
      tecido: form.tecido,
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

  async function addCollection() {
    const name = newCollectionName.trim();
    if (!name) {
      toast.error("Digite o nome da coleção.");
      return;
    }

    setCreatingCollection(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Erro ao criar coleção.");
        return;
      }

      if (data?.id && data?.name) {
        setCollections((prev) => {
          const merged = prev.some((c) => c.id === data.id) ? prev : [...prev, { id: data.id, name: data.name }];
          return merged.sort((a, b) => a.name.localeCompare(b.name));
        });
        setForm((f) => ({ ...f, collectionId: data.id }));
      } else {
        loadCollections();
      }
      setNewCollectionName("");
      toast.success("Coleção adicionada.");
    } finally {
      setCreatingCollection(false);
    }
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
        .then(async (r) => {
          const data = await parseJsonSafe(r);
          if (r.ok && Array.isArray(data)) {
            setCollections(data);
          }
        });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  const custo = parseFloat(form.custoUnitario) || 0;
  const precoVarejo = parseFloat(form.precoVarejo) || 0;
  const precoAtacado = parseFloat(form.precoAtacado) || 0;
  const lucroVarejo = precoVarejo - custo;
  const lucroAtacado = precoAtacado - custo;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">Controle por modelo com custo e preços de venda.</p>
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
                <TableHead>Tecido</TableHead>
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
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.collectionName}</TableCell>
                    <TableCell>{row.tecido}</TableCell>
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
            <div className="grid grid-cols-2 gap-4">
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
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova coleção"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-10 w-10"
                    disabled={creatingCollection}
                    onClick={addCollection}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tecido</Label>
                <Select value={form.tecido} onValueChange={(value) => setForm((f) => ({ ...f, tecido: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tecido" />
                  </SelectTrigger>
                  <SelectContent>
                    {TECIDOS.map((tecido) => (
                      <SelectItem key={tecido} value={tecido}>
                        {tecido}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                <Label>Preço varejo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.precoVarejo}
                  onChange={(e) => setForm((f) => ({ ...f, precoVarejo: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Preço atacado (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.precoAtacado}
                onChange={(e) => setForm((f) => ({ ...f, precoAtacado: e.target.value }))}
              />
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span>Lucro varejo</span>
                <span className="font-medium">{formatMoney(lucroVarejo)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Lucro atacado</span>
                <span className="font-medium">{formatMoney(lucroAtacado)}</span>
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
