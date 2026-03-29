"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  customerType: string;
  notes: string | null;
};

const typeLabels: Record<string, string> = {
  RETAIL: "Varejo",
  WHOLESALE: "Atacado",
  MIXED: "Misto",
};

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", customerType: "RETAIL", notes: "" });

  const load = useCallback(() => {
    fetch(`/api/customers?search=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then(setCustomers)
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", phone: "", customerType: "RETAIL", notes: "" });
    setOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      customerType: c.customerType,
      notes: c.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (editing) {
      const res = await fetch(`/api/customers/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const e = await res.json();
        toast.error(e.error || "Erro ao salvar");
        return;
      }
      toast.success("Cliente atualizado");
    } else {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const e = await res.json();
        toast.error(e.error || "Erro ao criar");
        return;
      }
      toast.success("Cliente criado");
    }
    setOpen(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Cadastro e busca por nome ou telefone.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo cliente</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Busca</CardTitle>
          <CardDescription>Nome ou telefone</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 max-w-md">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum cliente. Cadastre o primeiro.
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.phone ?? "—"}</TableCell>
                      <TableCell>{typeLabels[c.customerType] ?? c.customerType}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{c.notes ?? "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.customerType} onValueChange={(v) => setForm((f) => ({ ...f, customerType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RETAIL">Varejo</SelectItem>
                  <SelectItem value="WHOLESALE">Atacado</SelectItem>
                  <SelectItem value="MIXED">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
