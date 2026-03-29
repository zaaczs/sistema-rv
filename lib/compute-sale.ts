import type { Product } from "@prisma/client";

export function computeSaleTotals(
  product: Pick<Product, "lucroVarejo" | "lucroAtacado" | "precoVarejo" | "precoAtacado">,
  tipo: "varejo" | "atacado",
  quantidade: number,
  precoUnitarioAplicado: number | undefined,
  taxaCartao: number
) {
  const lucroBase = tipo === "varejo" ? Number(product.lucroVarejo) : Number(product.lucroAtacado);
  const precoPadrao = tipo === "varejo" ? Number(product.precoVarejo) : Number(product.precoAtacado);
  const precoAplicado = precoUnitarioAplicado ?? precoPadrao;
  const receita = quantidade * precoAplicado;
  const lucroBruto = quantidade * lucroBase;
  const lucroLiquido = lucroBruto - taxaCartao;
  return { lucroBase, precoAplicado, receita, lucroBruto, lucroLiquido };
}
