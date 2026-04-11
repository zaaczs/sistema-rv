"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";

type StockRow = {
  id: string;
  referencia: string;
  modeloId: string;
  modelo: string;
  tecido: string;
  cor: string;
  tamanho: string;
  quantidade: number;
  ativo: boolean;
};

type ProductOption = {
  id: string;
  name: string;
  tecido: string;
};

const TECIDOS = ["WONDER", "NAGOYA", "NEW TRIP"] as const;
type StockFormState = {
  referencia: string;
  modeloId: string;
  tecido: string;
  cor: string;
  tamanho: string;
  quantidade: string;
  ativo: boolean;
};

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function EstoquePage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [search, setSearch] = useState("");
  const [modelId, setModelId] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StockRow | null>(null);
  const [form, setForm] = useState<StockFormState>({
    referencia: "",
    modeloId: "",
    tecido: TECIDOS[0],
    cor: "",
    tamanho: "",
    quantidade: "0",
    ativo: true,
  });

  const loadModels = useCallback(async () => {
    try {
      const res = await fetch("/api/skus");
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Falha ao carregar modelos.");
        setProducts([]);
        return;
      }

      if (Array.isArray(data)) {
        const mapped = data
          .map((item) => ({
            id: String(item.id ?? ""),
            name: String(item.name ?? ""),
            tecido: String(item.tecido ?? TECIDOS[0]),
          }))
          .filter((item) => item.id && item.name)
          .sort((a, b) => a.name.localeCompare(b.name));
        setProducts(mapped);
        return;
      }

      setProducts([]);
    } catch {
      toast.error("Falha de rede ao carregar modelos.");
      setProducts([]);
    }
  }, []);

  const loadStock = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (modelId !== "all") params.set("modelId", modelId);

    const res = await fetch(`/api/estoque?${params}`);
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      toast.error(typeof data?.error === "string" ? data.error : "Falha ao carregar estoque.");
      setRows([]);
      return;
    }

    if (Array.isArray(data)) {
      setRows(data);
      return;
    }
    setRows([]);
  }, [search, modelId]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  function openCreate() {
    setEditing(null);
    setForm({
      referencia: "",
      modeloId: products[0]?.id ?? "",
      tecido: products[0]?.tecido ?? TECIDOS[0],
      cor: "",
      tamanho: "",
      quantidade: "0",
      ativo: true,
    });
    setOpen(true);
  }

  function openEdit(row: StockRow) {
    setEditing(row);
    setForm({
      referencia: row.referencia,
      modeloId: row.modeloId,
      tecido: row.tecido || TECIDOS[0],
      cor: row.cor,
      tamanho: row.tamanho,
      quantidade: String(row.quantidade),
      ativo: row.ativo,
    });
    setOpen(true);
  }

  async function save() {
    const payload = {
      referencia: form.referencia.trim(),
      modeloId: form.modeloId,
      tecido: form.tecido,
      cor: form.cor.trim(),
      tamanho: form.tamanho.trim(),
      quantidade: Number(form.quantidade || 0),
      ativo: form.ativo,
    };

    if (!payload.referencia || !payload.modeloId || !payload.tecido || !payload.cor || !payload.tamanho) {
      toast.error("Preencha modelo, tecido, referência, cor e tamanho.");
      return;
    }
    if (!Number.isFinite(payload.quantidade) || payload.quantidade < 0) {
      toast.error("Quantidade inválida.");
      return;
    }

    const res = await fetch(editing ? `/api/estoque/${editing.id}` : "/api/estoque", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      toast.error(typeof data?.error === "string" ? data.error : "Erro ao salvar item.");
      return;
    }

    toast.success(editing ? "Item de estoque atualizado." : "Item de estoque criado.");
    setOpen(false);
    loadStock();
  }

  useEffect(() => {
    if (!form.modeloId) return;
    const selected = products.find((p) => p.id === form.modeloId);
    if (!selected) return;
    setForm((current) => {
      if (current.tecido && current.tecido === selected.tecido) return current;
      return { ...current, tecido: selected.tecido || TECIDOS[0] };
    });
  }, [form.modeloId, products]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Estoque</h1>
          <p className="text-muted-foreground">Controle de modelo, tecido, cor, tamanho e referência.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo item
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Busque por referência, modelo, tecido, cor ou tamanho.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar referência, modelo, tecido, cor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Filtrar por modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os modelos</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
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
                <TableHead>Referência</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Tecido</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead className="w-[120px] text-center">Quantidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhum item de estoque encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.referencia}</TableCell>
                    <TableCell>{row.modelo}</TableCell>
                    <TableCell>{row.tecido}</TableCell>
                    <TableCell>{row.cor}</TableCell>
                    <TableCell>{row.tamanho}</TableCell>
                    <TableCell className="text-center">{row.quantidade}</TableCell>
                    <TableCell>{row.ativo ? "Ativo" : "Inativo"}</TableCell>
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
            <DialogTitle>{editing ? "Editar item de estoque" : "Novo item de estoque"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Referência</Label>
              <Input
                placeholder="Ex.: REF-001"
                value={form.referencia}
                onChange={(e) => setForm((f) => ({ ...f, referencia: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={form.modeloId} onValueChange={(value) => setForm((f) => ({ ...f, modeloId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modelo" />
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input value={form.cor} onChange={(e) => setForm((f) => ({ ...f, cor: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Tamanho</Label>
                <Input value={form.tamanho} onChange={(e) => setForm((f) => ({ ...f, tamanho: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={form.quantidade}
                  onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.ativo ? "ativo" : "inativo"}
                  onValueChange={(value) => setForm((f) => ({ ...f, ativo: value === "ativo" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
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
