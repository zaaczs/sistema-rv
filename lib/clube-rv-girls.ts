export const CLUB_CATEGORIES = [
  {
    id: "MUSA_RV",
    label: "MUSA RV",
    emoji: "🩵",
    minPoints: 0,
    benefits: [
      "Cupom pessoal de 5%",
      "Acesso ao grupo exclusivo",
      "Acesso antecipado aos lançamentos",
      "Participação em sorteios exclusivos",
      'Badge "Fundadora Reville Girl"',
    ],
  },
  {
    id: "BRONZE",
    label: "BRONZE",
    emoji: "🥉",
    minPoints: 30,
    benefits: [
      "Tudo da categoria anterior",
      "Cupom pessoal passa para 7%",
      "Cashback de R$20",
      "Frete grátis em 1 compra",
      "Nome no mural das Reville Girls do mês",
    ],
  },
  {
    id: "PRATA",
    label: "PRATA",
    emoji: "🥈",
    minPoints: 100,
    benefits: [
      "Tudo das categorias anteriores",
      "Cupom pessoal passa para 10%",
      "Cashback de R$50",
      "Brinde exclusivo da marca",
      "Acesso aos lançamentos 24h antes",
    ],
  },
  {
    id: "OURO",
    label: "OURO",
    emoji: "🥇",
    minPoints: 300,
    benefits: [
      "Tudo das categorias anteriores",
      "Cashback de R$100",
      "Peça Reville à escolha, dentro de um valor definido",
      "Acesso aos lançamentos 48h antes",
      "Participação em testes de novas coleções",
    ],
  },
  {
    id: "DIAMANTE",
    label: "DIAMANTE",
    emoji: "💎",
    minPoints: 600,
    benefits: [
      "Tudo das categorias anteriores",
      "Cashback de R$200",
      "Look completo Reville",
      "Cupom pessoal de 15%",
      "Destaque no Instagram da marca",
      "Convite para eventos exclusivos",
    ],
  },
] as const;

export type ClubCategoryId = (typeof CLUB_CATEGORIES)[number]["id"];

export function calcularCategoria(pontos: number): ClubCategoryId {
  const sorted = [...CLUB_CATEGORIES].sort((a, b) => b.minPoints - a.minPoints);
  for (const cat of sorted) {
    if (pontos >= cat.minPoints) return cat.id;
  }
  return "MUSA_RV";
}

export function getCategoriaInfo(categoriaId: string) {
  return CLUB_CATEGORIES.find((c) => c.id === categoriaId) ?? CLUB_CATEGORIES[0];
}

export function formatCategoriaLabel(categoriaId: string): string {
  const cat = getCategoriaInfo(categoriaId);
  return `${cat.emoji} ${cat.label}`;
}

export type ClubeClienteRow = {
  id: string;
  name: string;
  phone: string | null;
  customerType: string;
  pontosTotal: number;
  categoriaAtual: ClubCategoryId;
  clubMemberId: string | null;
};
