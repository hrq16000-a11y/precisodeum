/**
 * Generates a premium Sponsor ROI PDF report using jsPDF.
 * "Capa de Revista" design — clean, data-driven, professional.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface SponsorPdfData {
  sponsorName: string;
  plan: string;
  totalImpressions: number;
  totalClicks: number;
  ctr: string;
  periodImpressions: number;
  periodClicks: number;
  slotRanking: Array<{ name: string; impressions: number; clicks: number }>;
  pageRanking: Array<{ name: string; impressions: number; clicks: number }>;
  dailyData: Array<{ date: string; impressions: number; clicks: number }>;
}

const BRAND = {
  dark: '#0f172a',
  primary: '#3b82f6',
  accent: '#06b6d4',
  muted: '#94a3b8',
  light: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
};

function fmt(n: number): string {
  return n.toLocaleString('pt-BR');
}

function drawCover(doc: jsPDF, data: SponsorPdfData, dateStr: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Dark header block
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, w, 120, 'F');

  // Accent line
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 120, w, 3, 'F');

  // Brand name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('PRECISO DE UM PROFISSIONAL', 20, 30);

  // Title
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de', 20, 60);
  doc.text('Performance', 20, 75);

  // Subtitle
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Análise de ROI e Visibilidade de Marca', 20, 95);

  // Sponsor name badge
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(data.sponsorName.toUpperCase(), w - 20, 55, { align: 'right' });

  // Plan badge
  doc.setFillColor(59, 130, 246);
  const planText = (data.plan || 'Patrocinador').toUpperCase();
  const planW = doc.getTextWidth(planText) + 16;
  doc.roundedRect(w - 20 - planW, 62, planW, 18, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(planText, w - 20 - planW / 2, 73, { align: 'center' });

  // Date
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(dateStr, w - 20, 105, { align: 'right' });

  // KPI section
  const kpiY = 150;
  const kpiW = (w - 60) / 4;
  const kpis = [
    { label: 'Impressões Totais', value: fmt(data.totalImpressions) },
    { label: 'Cliques Totais', value: fmt(data.totalClicks) },
    { label: 'CTR Geral', value: `${data.ctr}%` },
    { label: 'Impressões (30d)', value: fmt(data.periodImpressions) },
  ];

  kpis.forEach((kpi, i) => {
    const x = 20 + i * (kpiW + 6.6);

    // Card background
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, kpiY, kpiW, 50, 4, 4, 'FD');

    // Value
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.value, x + kpiW / 2, kpiY + 25, { align: 'center' });

    // Label
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.label.toUpperCase(), x + kpiW / 2, kpiY + 40, { align: 'center' });
  });

  // Decorative elements
  doc.setFillColor(59, 130, 246);
  doc.circle(w - 40, h - 40, 20, 'F');
  doc.setFillColor(6, 182, 212);
  doc.circle(w - 55, h - 55, 8, 'F');

  // Footer
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.text('Este relatório é gerado automaticamente pela plataforma Preciso de um Profissional.', w / 2, h - 15, { align: 'center' });
}

function drawSlotRanking(doc: jsPDF, data: SponsorPdfData, startY: number): number {
  const w = doc.internal.pageSize.getWidth();

  // Section header
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Desempenho por Posição', 20, startY);

  doc.setFillColor(59, 130, 246);
  doc.rect(20, startY + 3, 40, 2, 'F');

  if (data.slotRanking.length === 0) {
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(10);
    doc.text('Nenhum dado de posição registrado.', 20, startY + 18);
    return startY + 30;
  }

  const maxImpr = Math.max(...data.slotRanking.map(s => s.impressions), 1);
  let y = startY + 16;

  data.slotRanking.forEach((slot) => {
    const barMaxW = w - 120;
    const barW = Math.max((slot.impressions / maxImpr) * barMaxW, 4);

    // Label
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(slot.name.slice(0, 25), 20, y + 4);

    // Bar background
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(85, y - 2, barMaxW, 10, 2, 2, 'F');

    // Bar fill
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(85, y - 2, barW, 10, 2, 2, 'F');

    // Value
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(slot.impressions), w - 20, y + 4, { align: 'right' });

    y += 16;
  });

  return y + 5;
}

function drawPageRanking(doc: jsPDF, data: SponsorPdfData, startY: number): number {
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Alcance por Página / Cidade', 20, startY);

  doc.setFillColor(6, 182, 212);
  doc.rect(20, startY + 3, 40, 2, 'F');

  if (data.pageRanking.length === 0) {
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(10);
    doc.text('Nenhum dado de página registrado.', 20, startY + 18);
    return startY + 30;
  }

  const tableData = data.pageRanking.map(p => [
    p.name,
    fmt(p.impressions),
    fmt(p.clicks),
    p.impressions > 0 ? ((p.clicks / p.impressions) * 100).toFixed(1) + '%' : '0%',
  ]);

  autoTable(doc, {
    startY: startY + 10,
    head: [['Página', 'Impressões', 'Cliques', 'CTR']],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 20, right: 20 },
  });

  return (doc as any).lastAutoTable.finalY + 10;
}

function drawDailyChart(doc: jsPDF, data: SponsorPdfData, startY: number): number {
  const w = doc.internal.pageSize.getWidth();

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Tendência Diária (30 dias)', 20, startY);

  doc.setFillColor(59, 130, 246);
  doc.rect(20, startY + 3, 40, 2, 'F');

  const filtered = data.dailyData.filter(d => d.impressions > 0 || d.clicks > 0);
  if (filtered.length === 0) {
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(10);
    doc.text('Nenhuma métrica registrada nos últimos 30 dias.', 20, startY + 18);
    return startY + 30;
  }

  const chartX = 20;
  const chartY = startY + 14;
  const chartW = w - 40;
  const chartH = 55;

  // Chart background
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(chartX, chartY, chartW, chartH, 3, 3, 'F');

  const maxVal = Math.max(...data.dailyData.map(d => d.impressions), 1);
  const barWidth = Math.max((chartW - 10) / data.dailyData.length - 1, 1);

  data.dailyData.forEach((d, i) => {
    const barH = Math.max((d.impressions / maxVal) * (chartH - 10), 1);
    const x = chartX + 5 + i * (barWidth + 1);
    const y = chartY + chartH - 5 - barH;

    doc.setFillColor(59, 130, 246);
    doc.rect(x, y, barWidth, barH, 'F');
  });

  // Date labels
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.text(data.dailyData[0]?.date || '', chartX + 5, chartY + chartH + 8);
  doc.text(data.dailyData[data.dailyData.length - 1]?.date || '', chartX + chartW - 5, chartY + chartH + 8, { align: 'right' });

  return chartY + chartH + 15;
}

function drawDetailedTable(doc: jsPDF, data: SponsorPdfData, startY: number): number {
  const filtered = data.dailyData.filter(d => d.impressions > 0 || d.clicks > 0);
  if (filtered.length === 0) return startY;

  // Check if we need a new page
  if (startY > 220) {
    doc.addPage();
    startY = 25;
  }

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Dados Detalhados', 20, startY);

  doc.setFillColor(59, 130, 246);
  doc.rect(20, startY + 3, 40, 2, 'F');

  const tableData = filtered.map(d => [
    d.date,
    fmt(d.impressions),
    fmt(d.clicks),
    d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(1) + '%' : '0%',
  ]);

  autoTable(doc, {
    startY: startY + 10,
    head: [['Data', 'Impressões', 'Cliques', 'CTR']],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 20, right: 20 },
  });

  return (doc as any).lastAutoTable.finalY + 10;
}

function drawFooter(doc: jsPDF, dateStr: string) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    // Footer line
    doc.setDrawColor(226, 232, 240);
    doc.line(20, h - 18, w - 20, h - 18);

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Preciso de um Profissional · Relatório de Performance', 20, h - 10);
    doc.text(`${dateStr} · Página ${i}/${pages}`, w - 20, h - 10, { align: 'right' });
  }
}

export function exportSponsorPdf(data: SponsorPdfData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Page 1: Cover with KPIs
  drawCover(doc, data, dateStr);

  // Page 2: Slot + Page rankings
  doc.addPage();
  let y = 25;
  y = drawSlotRanking(doc, data, y);
  y = drawPageRanking(doc, data, y);

  // Page 3: Daily chart + Detailed table
  doc.addPage();
  y = 25;
  y = drawDailyChart(doc, data, y);
  y = drawDetailedTable(doc, data, y);

  // Footer on all pages
  drawFooter(doc, dateStr);

  // Download
  const filename = `relatorio-${data.sponsorName.toLowerCase().replace(/\s+/g, '-')}-${now.toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
