"use client";

import { useCallback, useEffect, useState, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Search,
  Sparkles,
  Star,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";
import { toast } from "sonner";
import {
  CLUB_CATEGORIES,
  formatCategoriaLabel,
  getCategoriaInfo,
  type ClubeClienteRow,
} from "@/lib/clube-rv-girls";

type PointHistory = {
  id: string;
  pontosAdicionados: number;
  motivo: string | null;
  createdAt: string;
};

const categoryBadgeClass: Record<string, string> = {
  MUSA_RV: "bg-sky-100 text-sky-800 border-sky-200",
  BRONZE: "bg-amber-100 text-amber-900 border-amber-200",
  PRATA: "bg-slate-200 text-slate-800 border-slate-300",
  OURO: "bg-yellow-100 text-yellow-900 border-yellow-300",
  DIAMANTE: "bg-violet-100 text-violet-900 border-violet-200",
};

const typeLabels: Record<string, string> = {
  RETAIL: "Varejo",
  WHOLESALE: "Atacado",
  MIXED: "Misto",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ClubeRvGirlsPage() {
  const [customers, setCustomers] = useState<ClubeClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [pointsOpen, setPointsOpen] = useState(false);
  const [pointsTarget, setPointsTarget] = useState<ClubeClienteRow | null>(null);
  const [pointsForm, setPointsForm] = useState({ pontos: "", motivo: "" });

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/clube-rv-girls?search=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then(setCustomers)
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadHistory(clubMemberId: string) {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/clube-rv-girls/${clubMemberId}/historico`);
      const data = await res.json();
      setHistory(res.ok ? data : []);
    } finally {
      setHistoryLoading(false);
    }
  }

  function toggleExpand(customer: ClubeClienteRow) {
    if (!customer.clubMemberId) {
      toast.info("Esta cliente ainda não possui pontos no clube.");
      return;
    }

    if (expandedId === customer.id) {
      setExpandedId(null);
      setHistory([]);
      return;
    }

    setExpandedId(customer.id);
    loadHistory(customer.clubMemberId);
  }

  function openAddPoints(customer: ClubeClienteRow) {
    setPointsTarget(customer);
    setPointsForm({ pontos: "", motivo: "" });
    setPointsOpen(true);
  }

  async function savePoints() {
    if (!pointsTarget) return;
    const pontos = Number(pointsForm.pontos);
    if (!Number.isFinite(pontos) || pontos === 0) {
      toast.error("Informe uma quantidade de pontos válida");
      return;
    }

    const res = await fetch("/api/clube-rv-girls/pontos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: pointsTarget.id,
        pontos,
        motivo: pointsForm.motivo || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao adicionar pontos");
      return;
    }

    if (data.categoriaMudou) {
      toast.success(
        `Pontos atualizados! ${data.customerName} agora é ${formatCategoriaLabel(data.categoriaAtual)}`
      );
    } else {
      toast.success("Pontos adicionados com sucesso");
    }

    setPointsOpen(false);
    load();

    if (expandedId === pointsTarget.id && data.clubMemberId) {
      loadHistory(data.clubMemberId);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Clube RV Girls
        </h1>
        <p className="text-muted-foreground">
          Clientes cadastradas no sistema — associe pontos e acompanhe categorias e benefícios.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CLUB_CATEGORIES.map((cat) => (
          <Card key={cat.id} className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {cat.emoji} {cat.label}
              </CardTitle>
              <CardDescription className="text-xs">
                A partir de {cat.minPoints} pts
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Busca</CardTitle>
          <CardDescription>Nome ou telefone da cliente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 max-w-md">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
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
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Pontos</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="w-[140px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhuma cliente cadastrada. Cadastre em Clientes para associar pontos ao clube.
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => {
                    const cat = getCategoriaInfo(customer.categoriaAtual);
                    const isExpanded = expandedId === customer.id;
                    const hasPoints = customer.clubMemberId !== null;

                    return (
                      <Fragment key={customer.id}>
                        <TableRow className={isExpanded ? "bg-muted/30" : undefined}>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => toggleExpand(customer)}
                              disabled={!hasPoints}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{customer.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {customer.phone ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {typeLabels[customer.customerType] ?? customer.customerType}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center gap-1 font-semibold text-primary">
                              <Star className="h-4 w-4" />
                              {customer.pontosTotal}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={categoryBadgeClass[customer.categoriaAtual] ?? ""}
                            >
                              {formatCategoriaLabel(customer.categoriaAtual)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => openAddPoints(customer)}>
                              + Pontos
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && hasPoints && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/20 p-4">
                              <div className="grid gap-6 md:grid-cols-2">
                                <div>
                                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    Benefícios — {cat.emoji} {cat.label}
                                  </h3>
                                  <ul className="space-y-1 text-sm text-muted-foreground">
                                    {cat.benefits.map((b) => (
                                      <li key={b} className="flex items-start gap-2">
                                        <span className="text-primary mt-0.5">•</span>
                                        {b}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                                    <History className="h-4 w-4" />
                                    Histórico de pontos
                                  </h3>
                                  {historyLoading ? (
                                    <p className="text-sm text-muted-foreground">Carregando...</p>
                                  ) : history.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                      Nenhum lançamento registrado.
                                    </p>
                                  ) : (
                                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                                      {history.map((h) => (
                                        <li
                                          key={h.id}
                                          className="flex items-center justify-between text-sm border-b border-border/50 pb-2"
                                        >
                                          <div>
                                            <span
                                              className={
                                                h.pontosAdicionados >= 0
                                                  ? "text-green-600 font-medium"
                                                  : "text-red-600 font-medium"
                                              }
                                            >
                                              {h.pontosAdicionados >= 0 ? "+" : ""}
                                              {h.pontosAdicionados} pts
                                            </span>
                                            {h.motivo && (
                                              <span className="text-muted-foreground ml-2">
                                                — {h.motivo}
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                                            {formatDate(h.createdAt)}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={pointsOpen} onOpenChange={setPointsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar pontos</DialogTitle>
          </DialogHeader>
          {pointsTarget && (
            <p className="text-sm text-muted-foreground">
              {pointsTarget.name} — {pointsTarget.pontosTotal} pts (
              {formatCategoriaLabel(pointsTarget.categoriaAtual)})
            </p>
          )}
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Pontos *</Label>
              <Input
                type="number"
                placeholder="Ex: 10 (use negativo para ajuste)"
                value={pointsForm.pontos}
                onChange={(e) => setPointsForm((f) => ({ ...f, pontos: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input
                placeholder="Ex: Compra na loja, indicação, evento..."
                value={pointsForm.motivo}
                onChange={(e) => setPointsForm((f) => ({ ...f, motivo: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPointsOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={savePoints}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
