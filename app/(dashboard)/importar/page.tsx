"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ImportarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importação</h1>
        <p className="text-muted-foreground">
          Importe produtos a partir de um CSV exportado da planilha (ex.: Reville). O fluxo principal fica na tela de{" "}
          <Link href="/produtos" className="font-medium text-foreground underline underline-offset-4">
            Produtos
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Colunas esperadas</CardTitle>
          <CardDescription>
            A primeira linha de cabeçalho válida deve incluir: MODELO, LUCRO VAREJO, LUCRO ATACADO, COLECAO e CUSTO ou
            CUSTO TOTAL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Valores podem usar formato brasileiro (vírgula decimal, &quot;R$&quot;). Linhas vazias são ignoradas. Se já
            existir produto com o mesmo nome, os dados são atualizados. Coleções inexistentes são criadas
            automaticamente.
          </p>
          <Button asChild>
            <Link href="/produtos">Ir para Produtos e importar</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
