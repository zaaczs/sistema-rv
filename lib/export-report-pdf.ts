import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type ProductReportRow = {
  productId: string;
  productName: string;
  quantidade: number;
  receita: number;
  lucro: number;
};

type ReportTotals = {
  revenue: number;
  netProfit: number;
  totalInsumos?: number;
  realProfit?: number;
  units: number;
};

type ExportReportPdfInput = {
  periodLabel: string;
  tipo: string;
  totals: ReportTotals;
  byProduct: ProductReportRow[];
  rankingUnits: ProductReportRow[];
  rankingProfit: ProductReportRow[];
  filename: string;
  formatMoney: (value: number) => string;
};

const TIPO_LABELS: Record<string, string> = {
  all: "Todos",
  varejo: "Varejo",
  atacado: "Atacado",
};

export function exportReportPdf(input: ExportReportPdfInput) {
  const { periodLabel, tipo, totals, byProduct, rankingUnits, rankingProfit, filename, formatMoney } = input;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Relatório por produto", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Período: ${periodLabel}`, 14, y);
  y += 5;
  doc.text(`Tipo: ${TIPO_LABELS[tipo] ?? tipo}`, 14, y);
  y += 5;
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Resumo do período", 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Faturamento", formatMoney(totals.revenue)],
      ["Lucro (vendas)", formatMoney(totals.netProfit)],
      ["Insumos", formatMoney(totals.totalInsumos ?? 0)],
      ["Lucro real", formatMoney(totals.realProfit ?? totals.netProfit)],
      ["Quantidade vendida", String(totals.units)],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [13, 148, 136] },
    margin: { left: 14, right: 14 },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Relatório por produto", 14, y);
  y += 2;

  autoTable(doc, {
    startY: y + 4,
    head: [["Produto", "Qtd", "Receita", "Lucro"]],
    body:
      byProduct.length === 0
        ? [["Nenhuma venda neste período", "", "", ""]]
        : byProduct.map((row) => [
            row.productName,
            String(row.quantidade),
            formatMoney(row.receita),
            formatMoney(row.lucro),
          ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [13, 148, 136] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: "right", cellWidth: 18 },
      2: { halign: "right", cellWidth: 35 },
      3: { halign: "right", cellWidth: 35 },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  y += 10;

  if (y > 240) {
    doc.addPage();
    y = 16;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Mais vendidos", 14, y);
  y += 2;

  autoTable(doc, {
    startY: y + 4,
    head: [["Produto", "Quantidade"]],
    body:
      rankingUnits.length === 0
        ? [["Sem dados", ""]]
        : rankingUnits.map((row) => [row.productName, String(row.quantidade)]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [13, 148, 136] },
    columnStyles: {
      1: { halign: "right", cellWidth: 30 },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
  y += 10;

  if (y > 250) {
    doc.addPage();
    y = 16;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Mais lucrativos", 14, y);
  y += 2;

  autoTable(doc, {
    startY: y + 4,
    head: [["Produto", "Lucro"]],
    body:
      rankingProfit.length === 0
        ? [["Sem dados", ""]]
        : rankingProfit.map((row) => [row.productName, formatMoney(row.lucro)]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [13, 148, 136] },
    columnStyles: {
      1: { halign: "right", cellWidth: 35 },
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(filename);
}
